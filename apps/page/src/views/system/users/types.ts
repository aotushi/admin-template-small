export type UserRoleFilter = "admin" | "all" | "super" | "user";
export type UserStatusFilter = "all" | "disabled" | "enabled";
export type UserCreatedRange = [] | [string, string];

export interface UserFilters {
  createdRange: UserCreatedRange;
  role: UserRoleFilter;
  status: UserStatusFilter;
  userId: string;
  username: string;
}

export interface UserPagination {
  page: number;
  pageSize: number;
}
