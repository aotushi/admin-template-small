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

export function getUsersApi() {
  return requestClient.get<AdminUserListItem[]>("/api/users/list");
}

export function getDepartmentsTreeApi() {
  return requestClient.get<AdminDepartmentTreeItem[]>("/api/departments/tree");
}
