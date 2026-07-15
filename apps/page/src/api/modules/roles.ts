import { requestClient } from "@/api/request";

export interface AdminPermissionItem {
  code: string;
  id: number;
  name: string;
  type: "api" | "button" | "field" | "menu";
}

export interface AdminRoleItem {
  code: string;
  data_scope: "all" | "dept" | "self";
  id: number;
  name: string;
  permission_codes: string[];
  user_count: number;
}

export interface AdminRolesResult {
  permissions: AdminPermissionItem[];
  roles: AdminRoleItem[];
}

export interface UpdateRolePayload {
  data_scope?: AdminRoleItem["data_scope"];
  permission_codes?: string[];
}

export function getRolesApi() {
  return requestClient.get<AdminRolesResult>("/api/roles");
}

export function updateRoleApi(roleId: number, payload: UpdateRolePayload) {
  return requestClient.put<null, UpdateRolePayload>(`/api/roles/${roleId}`, payload);
}
