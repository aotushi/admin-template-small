import type { AdminUserListItem } from "@/api/modules/users";

/** 表单里的角色选项：与后端角色码（roles.code）同名 */
export type UserRoleOption = "admin" | "super" | "user";

export const USER_ROLE_OPTIONS: ReadonlyArray<{ label: string; value: UserRoleOption }> = [
  { label: "超级管理员", value: "super" },
  { label: "管理员", value: "admin" },
  { label: "普通用户", value: "user" },
];

/** users.role/admin_level → 角色选项（归一规则与后端 toRoleCode 一致） */
export function toRoleOption(
  user: Pick<AdminUserListItem, "admin_level" | "role">,
): UserRoleOption {
  if (user.role === "admin" && user.admin_level === "super") {
    return "super";
  }

  if (user.role === "admin") {
    return "admin";
  }

  return "user";
}

/** 角色选项 → 提交给后端的 role/admin_level 字段 */
export function toRoleFields(option: UserRoleOption): {
  admin_level: null | "sub" | "super";
  role: "admin" | "user";
} {
  if (option === "super") {
    return { admin_level: "super", role: "admin" };
  }

  if (option === "admin") {
    return { admin_level: "sub", role: "admin" };
  }

  return { admin_level: null, role: "user" };
}
