import { requestClient } from "@/api/request";

/** 用户绑定的单个角色（roles.code / roles.name） */
export interface AdminUserRoleItem {
  code: string;
  name: string;
}

export interface AdminUserListItem {
  created_at?: null | string;
  created_by?: null | number | string;
  created_by_username?: null | string;
  department_id?: null | number;
  department_name?: null | string;
  department_parent_name?: null | string;
  email?: null | string;
  id: number | string;
  is_system?: boolean | number;
  is_active?: boolean | number;
  /** 角色码数组（与 roles 同序），无绑定时为空数组 */
  role_codes?: string[];
  /** 用户绑定的角色（多对多，经 user_roles 关联） */
  roles?: AdminUserRoleItem[];
  username: string;
}

export interface AdminDepartmentTreeItem {
  children: AdminDepartmentTreeItem[];
  code: string;
  id: number;
  name: string;
  parent_id: null | number;
  sort_order: number;
  user_count: number;
}

/** roles 为角色码数组（roles.code），后端按 roles 表校验；选项构建见 userRoleOptions.ts */
export interface CreateUserPayload {
  department_id?: null | number;
  email?: string;
  password: string;
  roles?: string[];
  username: string;
}

export interface UpdateUserPayload {
  department_id?: null | number;
  email?: string;
  is_active?: boolean;
  password?: string;
  roles?: string[];
}

export function getUsersApi() {
  return requestClient.get<AdminUserListItem[]>("/api/users/list");
}

export function getDepartmentsTreeApi() {
  return requestClient.get<AdminDepartmentTreeItem[]>("/api/departments/tree");
}

/** 按当前用户数据范围过滤的部门树（dept 档只含本部门及子部门），用户表单的部门选择器专用 */
export function getAssignableDepartmentsTreeApi() {
  return requestClient.get<AdminDepartmentTreeItem[]>("/api/departments/tree?scope=data");
}

export function createUserApi(payload: CreateUserPayload) {
  return requestClient.post<AdminUserListItem, CreateUserPayload>("/api/users/create", payload);
}

export function updateUserApi(userId: number | string, payload: UpdateUserPayload) {
  return requestClient.put<null, UpdateUserPayload>(`/api/users/${userId}`, payload);
}

export function deleteUserApi(userId: number | string) {
  return requestClient.delete<null>(`/api/users/${userId}`);
}
