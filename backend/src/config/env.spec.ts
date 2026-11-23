import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://x',
  DIRECT_URL: 'postgresql://x',
  REDIS_URL: 'redis://x',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('fails fast when a required variable is missing', () => {
    expect(() => validateEnv({ ...base, REDIS_URL: '' })).toThrow(/REDIS_URL/);
  });

  it('rejects short JWT secrets', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('enables secure cookies in production by default', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(
      true,
    );
    expect(validateEnv(base).COOKIE_SECURE).toBe(false);
  });
});
