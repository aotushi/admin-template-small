// 响应外壳类型已归入 http 套件，这里保留同名导出以兼容既有引用。
export type { ApiFailure, ApiResponse, ApiSuccess } from "@/api/http/types";

export interface CurrentUser {
  avatar?: string;
  created_at?: string;
  created_by?: null | number;
  department_id?: null | number;
  email?: string;
  id: number | string;
  is_active?: boolean | number;
  is_system?: boolean;
  /** RBAC 权限码（后端 login/refresh/profile 下发），按钮显隐与路由 meta.permission 消费 */
  permissions?: string[];
  /** 角色码列表（user_roles 表实时解析下发），仅用于展示与 super 专属规则判定 */
  roles?: string[];
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
