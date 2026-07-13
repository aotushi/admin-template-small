import type { AdminUserListItem } from "@/api/users";
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

export function getUserStatus() {
  return "enabled";
}

export function getUserStatusLabel() {
  return "启用";
}

export function getUserRoleLabel(user: AdminUserListItem) {
  if (user.role === "admin" && user.admin_level === "super") {
    return "超级管理员";
  }

  if (user.role === "admin") {
    return "管理员";
  }

  return "普通用户";
}

export function getUserRoleTagType(user: AdminUserListItem): "danger" | "info" | "warning" {
  if (user.role === "admin" && user.admin_level === "super") {
    return "danger";
  }

  return user.role === "admin" ? "warning" : "info";
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

function matchesStatus(_user: AdminUserListItem, status: UserFilters["status"]) {
  return status === "all" || getUserStatus() === status;
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

  if (role === "super") {
    return user.role === "admin" && user.admin_level === "super";
  }

  if (role === "admin") {
    return user.role === "admin" && user.admin_level !== "super";
  }

  return user.role === "user";
}

function matchesDepartment(user: AdminUserListItem, allowedDepartmentIds?: ReadonlySet<string>) {
  return !allowedDepartmentIds || allowedDepartmentIds.has(String(user.department_id));
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}
