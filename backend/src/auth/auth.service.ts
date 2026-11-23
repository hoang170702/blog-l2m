import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { AppEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { deleteByPattern } from '../redis/delete-by-pattern.js';
import { REDIS } from '../redis/redis.module.js';
import type { AccessPayload, AuthUser, RefreshPayload } from './auth.types.js';
import { refreshKey } from './refresh-key.js';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * How long a rotated refresh token is remembered. Two browser tabs refreshing at the
 * same moment send the same cookie; the slower one must not look like token theft.
 */
export const ROTATION_GRACE_SECONDS = 30;
const ACTIVE = '1';
const ROTATED = 'rotated';

// Returns the previous state ('1', 'rotated' or nil) and marks an active token as
// rotated in one step, so two concurrent refreshes cannot both succeed.
const ROTATE_SCRIPT = `
local state = redis.call('GET', KEYS[1])
if state == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) end
return state
`;

/** The refresh token was rotated moments ago by a concurrent request; the session stays valid. */
export class RefreshRaceException extends UnauthorizedException {
  constructor() {
    super('Refresh token was just rotated by another request');
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Verify against a dummy hash when the user is missing to keep timing similar.
    const valid = await verify(
      user?.passwordHash ?? DUMMY_HASH,
      password,
    ).catch(() => false);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const tokens = await this.issueTokens(user.id, user.role);
    return { ...tokens, user: toAuthUser(user) };
  }

  /**
   * Rotates a refresh token. Replaying a token after the rotation grace period revokes
   * every session of that user; within the grace period the request is only rejected.
   */
  async refresh(refreshToken: string | undefined) {
    const payload = await this.verifyRefresh(refreshToken);
    const previous = (await this.redis.eval(
      ROTATE_SCRIPT,
      1,
      refreshKey(payload.sub, payload.jti),
      ACTIVE,
      ROTATED,
      ROTATION_GRACE_SECONDS,
    )) as string | null;
    if (previous === ROTATED) {
      throw new RefreshRaceException();
    }
    if (previous !== ACTIVE) {
      await this.revokeAll(payload.sub);
      throw new UnauthorizedException('Refresh token is no longer valid');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.issueTokens(user.id, user.role);
  }

  async logout(refreshToken: string | undefined) {
    const payload = await this.verifyRefresh(refreshToken).catch(() => null);
    if (payload) {
      await this.redis.del(refreshKey(payload.sub, payload.jti));
    }
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return toAuthUser(user);
  }

  verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  private async issueTokens(
    userId: string,
    role: string,
  ): Promise<IssuedTokens> {
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ sub: userId, role } satisfies AccessPayload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: ACCESS_TTL_SECONDS,
      }),
      this.jwt.signAsync({ sub: userId, jti } satisfies RefreshPayload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: REFRESH_TTL_SECONDS,
      }),
    ]);
    await this.redis.set(
      refreshKey(userId, jti),
      ACTIVE,
      'EX',
      REFRESH_TTL_SECONDS,
    );
    return { accessToken, refreshToken };
  }

  private async verifyRefresh(
    token: string | undefined,
  ): Promise<RefreshPayload> {
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException();
    }
  }

  private revokeAll(userId: string) {
    return deleteByPattern(this.redis, refreshKey(userId, '*'));
  }
}

// argon2id hash of a random string; only used to equalize login timing.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$WYJJatX8sZ3HPHoZXJnBtQ$p7eUaUIPaBqFnkT7M5yOKQn0lCgi0Dt/dN/9SQQOKpE';

function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
