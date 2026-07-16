import type { AdminDepartmentNode } from "@/api/modules/departments";
import type { AdminTableColumn } from "@/components/common";

export const deptTableColumns = [
  { key: "name", label: "部门名称", minWidth: 220, slot: "name" },
  { field: "code", key: "code", label: "部门编码", minWidth: 120 },
  { align: "center", key: "status", label: "状态", minWidth: 88, slot: "status" },
  { align: "center", field: "user_count", key: "userCount", label: "用户数", minWidth: 88 },
  { align: "center", field: "sort_order", key: "sortOrder", label: "排序", minWidth: 72 },
  {
    formatter: ({ row }) => row.remark ?? "-",
    key: "remark",
    label: "备注",
    minWidth: 180,
    showOverflowTooltip: true,
  },
  {
    align: "center",
    fixed: "right",
    key: "actions",
    label: "操作",
    slot: "actions",
    width: 128,
  },
] satisfies AdminTableColumn<AdminDepartmentNode>[];
