import type { AdminUserListItem } from "@/api/users";
import type { UserFilters, UserPagination } from "@/views/system/users/types";

export function createDefaultUserFilters(): UserFilters {
  return {
    adminLevel: "all",
    createdRange: [],
    remark: "",
    role: "all",
    status: "all",
    userId: "",
    username: "",
  };
}

export function filterUsers(users: readonly AdminUserListItem[], filters: UserFilters) {
  const username = normalizeSearchText(filters.username);
  const userId = normalizeSearchText(filters.userId);
  const remark = normalizeSearchText(filters.remark);

  return users.filter((user) => {
    return (
      matchesUsername(user, username) &&
      matchesUserId(user, userId) &&
      matchesStatus(user, filters.status) &&
      matchesRemark(user, remark) &&
      matchesCreatedRange(user, filters.createdRange) &&
      matchesRole(user, filters.role) &&
      matchesAdminLevel(user, filters.adminLevel)
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

export function getUserRemark(user: AdminUserListItem) {
  if (user.role === "admin" && user.admin_level === "super") {
    return "Super 管理员";
  }

  if (user.role === "admin") {
    return "Admin 管理员";
  }

  return "普通用户";
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

function matchesRemark(user: AdminUserListItem, remark: string) {
  if (!remark) {
    return true;
  }

  return normalizeSearchText(getUserRemark(user)).includes(remark);
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
  return role === "all" || user.role === role;
}

function matchesAdminLevel(user: AdminUserListItem, adminLevel: UserFilters["adminLevel"]) {
  if (adminLevel === "all") {
    return true;
  }

  if (adminLevel === "none") {
    return !user.admin_level;
  }

  return user.admin_level === adminLevel;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}
