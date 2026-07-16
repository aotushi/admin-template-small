import type { MenuType } from "@admin-backend-3/admin-api-contract/permissions";

import { requestClient } from "@/api/request";

export interface AdminMenuNode {
  auth_code: null | string;
  children: AdminMenuNode[];
  component: null | string;
  id: number;
  path: null | string;
  pid: null | number;
  sort: number;
  status: 0 | 1;
  title: string;
  type: MenuType;
}

export interface MenuPayload {
  auth_code?: null | string;
  component?: null | string;
  path?: null | string;
  pid?: null | number;
  sort?: number;
  status?: 0 | 1;
  title: string;
  type: MenuType;
}

export function getMenusTreeApi() {
  return requestClient.get<AdminMenuNode[]>("/api/menus/tree");
}

export function createMenuApi(payload: MenuPayload) {
  return requestClient.post<{ id: number }, MenuPayload>("/api/menus", payload);
}

export function updateMenuApi(menuId: number, payload: MenuPayload) {
  return requestClient.put<null, MenuPayload>(`/api/menus/${menuId}`, payload);
}

export function deleteMenuApi(menuId: number) {
  return requestClient.delete<null>(`/api/menus/${menuId}`);
}
