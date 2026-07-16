import type { MenuType } from "@admin-backend-3/admin-api-contract/permissions";

import type { AdminMenuNode } from "@/api/modules/menus";
import type { AdminTableColumn } from "@/components/common";

export const MENU_TYPE_LABELS: Record<MenuType, string> = {
  button: "按钮",
  catalog: "目录",
  menu: "菜单",
};

export const MENU_TYPE_TAG_TYPES: Record<MenuType, "info" | "primary" | "warning"> = {
  button: "info",
  catalog: "warning",
  menu: "primary",
};

export const menuTableColumns = [
  { key: "title", label: "菜单名称", minWidth: 220, slot: "title" },
  { align: "center", key: "type", label: "类型", minWidth: 88, slot: "type" },
  {
    formatter: ({ row }) => row.auth_code ?? "-",
    key: "authCode",
    label: "权限标识",
    minWidth: 180,
  },
  {
    formatter: ({ row }) => row.path ?? "-",
    key: "path",
    label: "路由地址",
    minWidth: 140,
  },
  {
    formatter: ({ row }) => row.component ?? "-",
    key: "component",
    label: "组件路径",
    minWidth: 240,
    showOverflowTooltip: true,
  },
  { align: "center", key: "status", label: "状态", minWidth: 88, slot: "status" },
  { align: "center", field: "sort", key: "sort", label: "排序", minWidth: 72 },
  {
    align: "center",
    fixed: "right",
    key: "actions",
    label: "操作",
    slot: "actions",
    width: 128,
  },
] satisfies AdminTableColumn<AdminMenuNode>[];
