export interface AccessPayload {
  sub: string;
  role: string;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}
