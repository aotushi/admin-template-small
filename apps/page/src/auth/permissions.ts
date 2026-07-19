import type { CurrentUser } from "@/api/types";

// 权限码判定纯函数：数据源是后端下发的 user.permissions（登录/刷新/资料接口实时解析）。
// 路由与按钮显隐统一由权限码判定；角色码（user.roles）只用于展示与 super 专属规则。

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
