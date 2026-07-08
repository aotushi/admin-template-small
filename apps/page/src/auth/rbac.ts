import type { CurrentUser } from "@/api/types";

export const accessRoles = ["super", "admin", "user"] as const;

export type AccessRole = (typeof accessRoles)[number];

export function resolveUserAccessRole(user: CurrentUser | null): AccessRole | null {
  if (!user) {
    return null;
  }

  if (user.role === "admin" && user.admin_level === "super") {
    return "super";
  }

  if (user.role === "admin") {
    return "admin";
  }

  return "user";
}

export function hasAnyRole(user: CurrentUser | null, allowedRoles?: readonly AccessRole[]) {
  if (!allowedRoles?.length) {
    return true;
  }

  const role = resolveUserAccessRole(user);

  return role ? allowedRoles.includes(role) : false;
}
