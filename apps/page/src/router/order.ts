import type { RouteRecordRaw } from "vue-router";

// 未声明 order 的路由排在同级最后（sort 稳定，保持声明顺序），避免新页面漏标 order 时插队到菜单最前。
const UNORDERED_LAST = Number.MAX_SAFE_INTEGER;

// 同级路由排序比较器：菜单生成与分组 redirect 改投共用，保证两处顺序一致。
export function compareRouteOrder(left: RouteRecordRaw, right: RouteRecordRaw) {
  return (left.meta?.order ?? UNORDERED_LAST) - (right.meta?.order ?? UNORDERED_LAST);
}
