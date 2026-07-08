export interface ApiSuccess<T> {
  data: T;
  success: true;
}

export interface ApiFailure {
  code?: number | string;
  error?: string;
  message?: string;
  success?: false;
}

export type ApiResponse<T> = ApiFailure | ApiSuccess<T> | T;

export interface CurrentUser {
  admin_level?: null | string;
  avatar?: string;
  created_at?: string;
  created_by?: null | number;
  email?: string;
  id: number | string;
  role: string;
  username: string;
}

export interface LoginPayload {
  password: string;
  username: string;
}

export interface LoginResult {
  accessToken: string;
  expires?: string;
  refreshExpires?: string;
  refreshToken?: string;
  tokenType?: "Bearer";
  user?: CurrentUser;
}

export interface TokenRefreshPayload {
  refreshToken: string;
}

export interface TokenRefreshResult {
  accessToken: string;
  expires: string;
  refreshExpires: string;
  refreshToken: string;
  tokenType: "Bearer";
}
