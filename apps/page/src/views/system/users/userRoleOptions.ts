import type { AdminUserListItem } from "@/api/modules/users";

/** 表单里的角色选项：与后端角色码（roles.code）同名 */
export type UserRoleOption = "admin" | "super" | "user";

export const USER_ROLE_OPTIONS: ReadonlyArray<{ label: string; value: UserRoleOption }> = [
  { label: "超级管理员", value: "super" },
  { label: "管理员", value: "admin" },
  { label: "普通用户", value: "user" },
];

/** 用户的 role_code → 表单角色选项（自定义角色码或无绑定归入 user 展示） */
export function toRoleOption(user: Pick<AdminUserListItem, "role_code">): UserRoleOption {
  if (user.role_code === "super" || user.role_code === "admin") {
    return user.role_code;
  }

  return "user";
}
