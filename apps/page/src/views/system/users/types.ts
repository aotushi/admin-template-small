export type AdminLevelFilter = "all" | "none" | "sub" | "super";
export type UserRoleFilter = "admin" | "all" | "user";
export type UserStatusFilter = "all" | "disabled" | "enabled";
export type UserCreatedRange = [] | [string, string];

export interface UserFilters {
  adminLevel: AdminLevelFilter;
  createdRange: UserCreatedRange;
  remark: string;
  role: UserRoleFilter;
  status: UserStatusFilter;
  userId: string;
  username: string;
}

export interface UserPagination {
  page: number;
  pageSize: number;
}
