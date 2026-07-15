import type { Directive } from "vue";

import { hasPermission } from "@/auth/permissions";
import { useAuthStore } from "@/stores/auth";

// 按钮级权限指令：v-permission="'system:user:create'"
// 缺少权限码时直接移除元素（非隐藏，避免被样式复原）。
// 权限变更走登录/刷新重建页面，无需在指令内做响应式更新。

function applyPermission(el: HTMLElement, code: string | undefined) {
  const authStore = useAuthStore();
  if (!hasPermission(authStore.currentUser, code)) {
    el.parentNode?.removeChild(el);
  }
}

export const permissionDirective: Directive<HTMLElement, string | undefined> = {
  mounted(el, binding) {
    applyPermission(el, binding.value);
  },
};
