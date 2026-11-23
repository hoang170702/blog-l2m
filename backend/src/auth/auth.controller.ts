import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { AppEnv } from '../config/env.js';
import { JwtAuthGuard, type AuthedRequest } from './admin.guard.js';
import {
  AuthService,
  REFRESH_TTL_SECONDS,
  RefreshRaceException,
} from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

export const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.login(
      dto.email,
      dto.password,
    );
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
    return { accessToken, user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { accessToken, refreshToken } = await this.auth.refresh(
        req.cookies?.[REFRESH_COOKIE],
      );
      res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
      return { accessToken };
    } catch (error) {
      // In a refresh race the browser already holds the newer cookie; keep it.
      if (!(error instanceof RefreshRaceException)) {
        res.clearCookie(REFRESH_COOKIE, this.cookieOptions(false));
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions(false));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.sub);
  }

  private cookieOptions(withMaxAge = true): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'strict',
      path: '/api/auth',
      ...(withMaxAge ? { maxAge: REFRESH_TTL_SECONDS * 1000 } : {}),
    };
  }
}
