/** Redis key of one refresh session; use `'*'` as jti to match all sessions of a user. */
export const refreshKey = (userId: string, jti: string) =>
  `refresh:${userId}:${jti}`;
