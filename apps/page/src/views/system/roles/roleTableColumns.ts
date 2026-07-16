import type { AdminRoleItem } from "@/api/modules/roles";
import type { AdminTableColumn } from "@/components/common";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value?: null | string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export const DATA_SCOPE_LABELS: Record<AdminRoleItem["data_scope"], string> = {
  all: "全部数据",
  dept: "本部门及子部门",
  self: "仅本人创建",
};

export const roleTableColumns = [
  { align: "center", key: "name", label: "角色名称", minWidth: 140, slot: "name" },
  { align: "center", field: "code", key: "code", label: "角色标识", minWidth: 120 },
  { align: "center", key: "status", label: "状态", minWidth: 88, slot: "status" },
  {
    align: "center",
    formatter: ({ row }) => DATA_SCOPE_LABELS[row.data_scope],
    key: "dataScope",
    label: "数据范围",
    minWidth: 130,
  },
  { align: "center", field: "user_count", key: "userCount", label: "成员数", minWidth: 88 },
  {
    align: "center",
    formatter: ({ row }) => row.remark || "-",
    key: "remark",
    label: "备注",
    minWidth: 160,
  },
  {
    align: "center",
    formatter: ({ row }) => formatDate(row.created_at),
    key: "createdAt",
    label: "创建时间",
    minWidth: 160,
  },
  {
    align: "center",
    fixed: "right",
    key: "actions",
    label: "操作",
    slot: "actions",
    width: 128,
  },
] satisfies AdminTableColumn<AdminRoleItem>[];
