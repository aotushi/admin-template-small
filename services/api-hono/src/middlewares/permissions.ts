import { ROLE_CODES } from '@admin-backend-3/admin-api-contract/permissions';

/**
 * 权限检查中间件和工具函数
 * 角色归属唯一来源是 user_roles 表，payload.role_codes 由 authMiddleware 每请求实时解析。
 */

export interface UserPayload {
  id: number;
  username: string;
  /** 用户绑定的启用角色码（来自 user_roles × roles.status=1） */
  role_codes: string[];
  created_by?: number | null;
}

export interface ManagedUserPayload {
  id: number;
  is_system?: boolean | number | null;
}

/**
 * 检查是否为总管理员（内置角色码 super）
 */
export const isSuperAdmin = (user: UserPayload): boolean => {
  return user.role_codes.includes(ROLE_CODES.super);
};

/**
 * 检查是否为子管理员（内置角色码 admin）
 */
export const isSubAdmin = (user: UserPayload): boolean => {
  return user.role_codes.includes(ROLE_CODES.admin);
};

/**
 * 检查是否为任意级别的管理员
 */
export const isAnyAdmin = (user: UserPayload): boolean => {
  return isSuperAdmin(user) || isSubAdmin(user);
};

/**
 * 检查用户是否有权管理目标用户
 * @param currentUser 当前操作的用户
 * @param targetUserId 目标用户ID
 * @param targetCreatedBy 目标用户的创建者ID
 */
export const canManageUser = (
  currentUser: UserPayload,
  targetUserId: number,
  targetCreatedBy?: number | null
): boolean => {
  // 总管理员可以管理所有用户
  if (isSuperAdmin(currentUser)) {
    return true;
  }

  // 子管理员只能管理自己创建的用户
  if (isSubAdmin(currentUser)) {
    return targetCreatedBy === currentUser.id;
  }

  // 普通用户无管理权限
  return false;
};

/**
 * 检查是否可以删除用户
 * 规则：
 * 1. 只有总管理员可以删除
 * 2. 不能删除自己
 * 3. 不能删除受保护的系统账户
 */
export const canDeleteUser = (
  currentUser: UserPayload,
  targetUser: ManagedUserPayload
): boolean => {
  // 只有总管理员可以删除
  if (!isSuperAdmin(currentUser)) {
    return false;
  }

  // 不能删除自己
  if (currentUser.id === targetUser.id) {
    return false;
  }

  // 不能删除受保护的系统账户
  if (Boolean(targetUser.is_system)) {
    return false;
  }

  return true;
};
