import { requestClient } from "@/api/request";

export interface AdminDepartmentNode {
  children: AdminDepartmentNode[];
  code: string;
  id: number;
  name: string;
  parent_id: null | number;
  remark: null | string;
  sort_order: number;
  status: 0 | 1;
  user_count: number;
}

export interface DepartmentPayload {
  name: string;
  parent_id?: null | number;
  remark?: null | string;
  sort_order?: number;
  status?: 0 | 1;
}

export function getDepartmentsTreeApi() {
  return requestClient.get<AdminDepartmentNode[]>("/api/departments/tree");
}

export function createDepartmentApi(payload: DepartmentPayload) {
  return requestClient.post<{ id: number }, DepartmentPayload>("/api/departments", payload);
}

export function updateDepartmentApi(deptId: number, payload: DepartmentPayload) {
  return requestClient.put<null, DepartmentPayload>(`/api/departments/${deptId}`, payload);
}

export function deleteDepartmentApi(deptId: number) {
  return requestClient.delete<null>(`/api/departments/${deptId}`);
}
