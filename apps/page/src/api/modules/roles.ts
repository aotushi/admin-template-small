import { requestClient } from "@/api/request";

export interface AdminRoleItem {
  code: string;
  created_at: string;
  data_scope: "all" | "dept" | "self";
  id: number;
  menu_ids: number[];
  name: string;
  remark: string;
  status: 0 | 1;
  user_count: number;
}

export interface AdminRolesResult {
  roles: AdminRoleItem[];
}

export interface RolePayload {
  data_scope?: AdminRoleItem["data_scope"];
  menu_ids?: number[];
  name?: string;
  remark?: string;
  status?: 0 | 1;
}

export function getRolesApi() {
  return requestClient.get<AdminRolesResult>("/api/roles");
}

export function createRoleApi(payload: RolePayload) {
  return requestClient.post<{ id: number }, RolePayload>("/api/roles", payload);
}

export function updateRoleApi(roleId: number, payload: RolePayload) {
  return requestClient.put<null, RolePayload>(`/api/roles/${roleId}`, payload);
}

export function deleteRoleApi(roleId: number) {
  return requestClient.delete<null>(`/api/roles/${roleId}`);
}
