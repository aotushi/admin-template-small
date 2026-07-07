/**
 * 权限检查中间件和工具函数
 */

export interface UserPayload {
  id: number;
  username: string;
  role: string;
  admin_level?: string | null;
  created_by?: number | null;
}

/**
 * 检查是否为总管理员
 */
export const isSuperAdmin = (user: UserPayload): boolean => {
  return user.role === 'admin' && user.admin_level === 'super';
};

/**
 * 检查是否为子管理员
 */
export const isSubAdmin = (user: UserPayload): boolean => {
  return user.role === 'admin' && user.admin_level === 'sub';
};

/**
 * 检查是否为任意级别的管理员
 */
export const isAnyAdmin = (user: UserPayload): boolean => {
  return user.role === 'admin';
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
 * 3. 不能删除系统 vben 账户
 */
export const canDeleteUser = (
  currentUser: UserPayload,
  targetUserId: number,
  targetUsername: string
): boolean => {
  // 只有总管理员可以删除
  if (!isSuperAdmin(currentUser)) {
    return false;
  }

  // 不能删除自己
  if (currentUser.id === targetUserId) {
    return false;
  }

  // 不能删除系统 vben 账户
  if (targetUsername === 'vben') {
    return false;
  }

  return true;
};
