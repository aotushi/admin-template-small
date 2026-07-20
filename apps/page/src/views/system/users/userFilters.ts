import type { AdminUserListItem, AdminUserRoleItem } from "@/api/modules/users";
import type { UserFilters, UserPagination } from "@/views/system/users/types";

export function createDefaultUserFilters(): UserFilters {
  return {
    createdRange: [],
    role: "all",
    status: "all",
    userId: "",
    username: "",
  };
}

export function filterUsers(
  users: readonly AdminUserListItem[],
  filters: UserFilters,
  departmentIds?: readonly number[],
) {
  const username = normalizeSearchText(filters.username);
  const userId = normalizeSearchText(filters.userId);
  const allowedDepartmentIds = departmentIds ? new Set(departmentIds.map(String)) : undefined;

  return users.filter((user) => {
    return (
      matchesUsername(user, username) &&
      matchesUserId(user, userId) &&
      matchesDepartment(user, allowedDepartmentIds) &&
      matchesStatus(user, filters.status) &&
      matchesCreatedRange(user, filters.createdRange) &&
      matchesRole(user, filters.role)
    );
  });
}

export function paginateUsers(users: readonly AdminUserListItem[], pagination: UserPagination) {
  const page = Math.max(1, pagination.page);
  const pageSize = Math.max(1, pagination.pageSize);
  const start = (page - 1) * pageSize;

  return users.slice(start, start + pageSize);
}

export function getUserStatus(user: AdminUserListItem) {
  return Number(user.is_active ?? 1) === 1 ? "enabled" : "disabled";
}

export function getUserStatusLabel(user: AdminUserListItem) {
  return getUserStatus(user) === "enabled" ? "启用" : "停用";
}

/** 列表角色标签数据源：多角色逐个展示，无绑定兜底"普通用户" */
export function getUserRoleItems(user: AdminUserListItem): AdminUserRoleItem[] {
  if (user.roles && user.roles.length > 0) {
    return user.roles;
  }

  return [{ code: "user", name: "普通用户" }];
}

export function getRoleTagType(roleCode: string): "danger" | "info" | "warning" {
  if (roleCode === "super") {
    return "danger";
  }

  return roleCode === "admin" ? "warning" : "info";
}

function matchesUsername(user: AdminUserListItem, username: string) {
  if (!username) {
    return true;
  }

  return [user.username, user.email]
    .filter(Boolean)
    .some((value) => normalizeSearchText(String(value)).includes(username));
}

function matchesUserId(user: AdminUserListItem, userId: string) {
  if (!userId) {
    return true;
  }

  return String(user.id).includes(userId);
}

function matchesStatus(user: AdminUserListItem, status: UserFilters["status"]) {
  return status === "all" || getUserStatus(user) === status;
}

function matchesCreatedRange(user: AdminUserListItem, createdRange: UserFilters["createdRange"]) {
  if (createdRange.length !== 2 || !user.created_at) {
    return true;
  }

  const createdTime = new Date(user.created_at).getTime();
  const startTime = new Date(`${createdRange[0]}T00:00:00`).getTime();
  const endTime = new Date(`${createdRange[1]}T23:59:59`).getTime();

  if ([createdTime, startTime, endTime].some((time) => Number.isNaN(time))) {
    return true;
  }

  return createdTime >= startTime && createdTime <= endTime;
}

function matchesRole(user: AdminUserListItem, role: UserFilters["role"]) {
  if (role === "all") {
    return true;
  }

  const codes = user.role_codes ?? [];

  if (role === "super" || role === "admin") {
    return codes.includes(role);
  }

  // user 档兜住纯自定义角色与无绑定（含 admin/super 的归上面两档）
  return !codes.includes("super") && !codes.includes("admin");
}

function matchesDepartment(user: AdminUserListItem, allowedDepartmentIds?: ReadonlySet<string>) {
  return !allowedDepartmentIds || allowedDepartmentIds.has(String(user.department_id));
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}
