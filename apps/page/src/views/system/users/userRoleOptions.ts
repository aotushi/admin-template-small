import { ROLE_CODES } from "@admin-backend-3/admin-api-contract/permissions";

import type { AdminRoleItem } from "@/api/modules/roles";
import type { AdminUserListItem } from "@/api/modules/users";

/** 用户表单角色多选的选项：value 为角色码（roles.code） */
export interface UserRoleOption {
  label: string;
  value: string;
}

/** 启用中的角色 → 表单多选选项（来自 /api/roles，含自定义角色） */
export function buildRoleOptions(roles: readonly AdminRoleItem[]): UserRoleOption[] {
  return roles
    .filter((role) => role.status === 1)
    .map((role) => ({ label: role.name, value: role.code }));
}

/** 用户当前绑定的角色码；无绑定回退 user（与后端创建默认一致） */
export function getUserRoleCodes(user: Pick<AdminUserListItem, "role_codes">): string[] {
  if (user.role_codes && user.role_codes.length > 0) {
    return [...user.role_codes];
  }

  return [ROLE_CODES.user];
}

/** 角色集合比较（忽略顺序与重复），用于编辑时判断角色是否有变化 */
export function isSameRoleSelection(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  return setA.size === setB.size && [...setA].every((code) => setB.has(code));
}

/**
 * super 不可与其他角色叠加（与后端校验一致）：
 * 新勾选 super 时只保留 super；已是 super 再勾选其他角色时移除 super。
 */
export function normalizeRoleSelection(
  next: readonly string[],
  previous: readonly string[],
): string[] {
  if (!next.includes(ROLE_CODES.super) || next.length <= 1) {
    return [...next];
  }

  return previous.includes(ROLE_CODES.super)
    ? next.filter((code) => code !== ROLE_CODES.super)
    : [ROLE_CODES.super];
}
