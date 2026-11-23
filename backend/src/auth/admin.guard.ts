import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AccessPayload } from './auth.types.js';

export type AuthedRequest = Request & { user: AccessPayload };

/** Requires a valid access token; `admin` routes additionally require the ADMIN role. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }
    try {
      request.user = await this.auth.verifyAccess(token);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}

@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext) {
    await super.canActivate(context);
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException();
    }
    return true;
  }
}
