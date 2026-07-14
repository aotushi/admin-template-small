import type { AdminUserListItem } from "@/api/modules/users";
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

function getDepartmentLabel(user: AdminUserListItem) {
  if (user.department_parent_name && user.department_name) {
    return `${user.department_parent_name} / ${user.department_name}`;
  }

  return user.department_name ?? "未分配";
}

export const userTableColumns = [
  {
    align: "center",
    key: "username",
    label: "用户名",
    minWidth: 150,
    slot: "username",
  },
  { align: "center", field: "id", key: "id", label: "用户ID", minWidth: 88 },
  { align: "center", key: "status", label: "状态", minWidth: 88, slot: "status" },
  {
    align: "center",
    formatter: ({ row }) => getDepartmentLabel(row),
    key: "department",
    label: "部门",
    minWidth: 190,
  },
  { align: "center", key: "role", label: "角色", minWidth: 118, slot: "role" },
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
] satisfies AdminTableColumn<AdminUserListItem>[];
