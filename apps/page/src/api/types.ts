// 响应外壳类型已归入 http 套件，这里保留同名导出以兼容既有引用。
export type { ApiFailure, ApiResponse, ApiSuccess } from "@/api/http/types";

export interface CurrentUser {
  admin_level?: null | string;
  avatar?: string;
  created_at?: string;
  created_by?: null | number;
  department_id?: null | number;
  email?: string;
  id: number | string;
  is_active?: boolean | number;
  is_system?: boolean;
  role: string;
  username: string;
}

export interface LoginPayload {
  password: string;
  username: string;
}

export interface AuthSessionResult {
  accessToken: string;
  expires: string;
  sessionExpires: string;
  tokenType: "Bearer";
  user: CurrentUser;
}

export type LoginResult = AuthSessionResult;

export type TokenRefreshResult = AuthSessionResult;
