const REQUIRED = [
  'DATABASE_URL',
  'DIRECT_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

const MIN_SECRET_LENGTH = 32;

export interface AppEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  DIRECT_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CORS_ORIGIN: string;
  UPLOAD_DIR: string;
  COOKIE_SECURE: boolean;
}

/** Validates process env at startup so a misconfigured deploy fails fast. */
export function validateEnv(raw: Record<string, string | undefined>): AppEnv {
  const missing = REQUIRED.filter((key) => !raw[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if ((raw[key] ?? '').length < MIN_SECRET_LENGTH) {
      throw new Error(
        `${key} must be at least ${MIN_SECRET_LENGTH} characters`,
      );
    }
  }
  const nodeEnv = raw.NODE_ENV ?? 'development';
  return {
    NODE_ENV: nodeEnv,
    PORT: Number(raw.PORT ?? 3000),
    DATABASE_URL: raw.DATABASE_URL as string,
    DIRECT_URL: raw.DIRECT_URL as string,
    REDIS_URL: raw.REDIS_URL as string,
    JWT_ACCESS_SECRET: raw.JWT_ACCESS_SECRET as string,
    JWT_REFRESH_SECRET: raw.JWT_REFRESH_SECRET as string,
    CORS_ORIGIN: raw.CORS_ORIGIN ?? '',
    UPLOAD_DIR: raw.UPLOAD_DIR ?? './uploads',
    COOKIE_SECURE:
      raw.COOKIE_SECURE !== undefined
        ? raw.COOKIE_SECURE === 'true'
        : nodeEnv === 'production',
  };
}
