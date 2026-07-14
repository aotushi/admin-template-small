import { describe, expect, it } from "vitest";

import type { AdminDepartmentTreeItem } from "@/api/modules/users";
import {
  ALL_DEPARTMENTS_KEY,
  createDepartmentKey,
  getSelectedDepartmentIds,
} from "./departmentTree";

const departments: AdminDepartmentTreeItem[] = [
  {
    children: [
      {
        children: [],
        code: "finance-accounting",
        id: 2,
        name: "会计核算组",
        parent_id: 1,
        sort_order: 10,
        user_count: 1,
      },
      {
        children: [],
        code: "finance-cost",
        id: 3,
        name: "成本控制组",
        parent_id: 1,
        sort_order: 20,
        user_count: 1,
      },
    ],
    code: "finance",
    id: 1,
    name: "财务部",
    parent_id: null,
    sort_order: 10,
    user_count: 0,
  },
];

describe("departmentTree", () => {
  it("leaves all departments unfiltered", () => {
    expect(getSelectedDepartmentIds(departments, ALL_DEPARTMENTS_KEY)).toBeUndefined();
  });

  it("includes descendant departments when a parent is selected", () => {
    expect(getSelectedDepartmentIds(departments, createDepartmentKey(1))).toEqual([1, 2, 3]);
  });

  it("selects only a leaf department", () => {
    expect(getSelectedDepartmentIds(departments, createDepartmentKey(2))).toEqual([2]);
  });
});
