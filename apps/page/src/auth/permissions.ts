import type { CurrentUser } from "@/api/types";

// 权限码判定纯函数：数据源是后端下发的 user.permissions（登录/刷新/资料接口实时解析）。
// 与 rbac.ts 的角色判定并存：角色控粗粒度路由，权限码控按钮与细粒度路由。

export function hasPermission(user: CurrentUser | null, code?: string): boolean {
  if (!code) {
    return true;
  }

  return user?.permissions?.includes(code) ?? false;
}

export function hasAnyPermission(user: CurrentUser | null, codes?: readonly string[]): boolean {
  if (!codes?.length) {
    return true;
  }

  return codes.some((code) => hasPermission(user, code));
}
