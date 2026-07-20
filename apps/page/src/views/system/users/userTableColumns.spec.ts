import { describe, expect, it } from "vitest";

import type { AdminUserListItem } from "@/api/modules/users";
import type { AdminTableColumn } from "@/components/common";
import { userTableColumns } from "./userTableColumns";

const row: AdminUserListItem = {
  created_at: "invalid-date",
  department_name: "产品研发组",
  department_parent_name: "技术部",
  id: 9,
  role_codes: ["admin"],
  roles: [{ code: "admin", name: "子管理员" }],
  username: "tech.research",
};

function getColumn(key: string): AdminTableColumn<AdminUserListItem> {
  const column = userTableColumns.find((item) => item.key === key);

  if (!column) {
    throw new Error(`Missing user table column: ${key}`);
  }

  return column;
}

function formatColumn(key: string) {
  const column = getColumn(key);
  return column.formatter?.({ column, index: 0, row, value: undefined });
}

describe("userTableColumns", () => {
  it("keeps the user table structure explicit and ordered", () => {
    expect(userTableColumns.map((column) => column.key)).toEqual([
      "username",
      "id",
      "status",
      "department",
      "role",
      "createdAt",
      "actions",
    ]);
  });

  it("formats display-only department and date values without changing the API row", () => {
    expect(formatColumn("department")).toBe("技术部 / 产品研发组");
    expect(formatColumn("createdAt")).toBe("invalid-date");
    expect(row).toMatchObject({ department_name: "产品研发组", department_parent_name: "技术部" });
  });
});
