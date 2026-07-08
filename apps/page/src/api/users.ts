import { requestClient } from "@/api/request";

export interface AdminUserListItem {
  admin_level?: null | string;
  created_at?: null | string;
  created_by?: null | number | string;
  created_by_username?: null | string;
  email?: null | string;
  id: number | string;
  role: string;
  username: string;
}

export function getUsersApi() {
  return requestClient.get<AdminUserListItem[]>("/api/users/list");
}
