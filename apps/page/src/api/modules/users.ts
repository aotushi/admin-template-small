import { requestClient } from "@/api/request";

export interface AdminUserListItem {
  admin_level?: null | string;
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
  role: string;
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

/** 前端角色选项与后端 role/admin_level 的映射见 userRoleOptions.ts */
export interface CreateUserPayload {
  admin_level?: null | "sub" | "super";
  department_id?: null | number;
  email?: string;
  password: string;
  role?: "admin" | "user";
  username: string;
}

export interface UpdateUserPayload {
  admin_level?: null | "sub" | "super";
  department_id?: null | number;
  email?: string;
  password?: string;
  role?: "admin" | "user";
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
