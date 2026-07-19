import { describe, expect, it } from "vitest";

import type { AdminUserListItem } from "@/api/modules/users";
import { createDefaultUserFilters, filterUsers, paginateUsers } from "./userFilters";

const users: AdminUserListItem[] = [
  {
    created_at: "2026-01-01T08:00:00.000Z",
    created_by_username: null,
    department_id: null,
    department_name: null,
    department_parent_name: null,
    email: "vben@example.com",
    id: 1,
    role_code: "super",
    role_name: "总管理员",
    username: "vben",
  },
  {
    created_at: "2026-01-02T08:00:00.000Z",
    created_by_username: "vben",
    department_id: 21,
    department_name: "信息化运维组",
    department_parent_name: "技术部",
    email: "admin@example.com",
    id: 2,
    is_active: 0,
    role_code: "admin",
    role_name: "子管理员",
    username: "admin",
  },
  {
    created_at: "2026-01-03T08:00:00.000Z",
    created_by_username: "admin",
    department_id: 9,
    department_name: "客户服务组",
    department_parent_name: "销售部",
    email: "jack@example.com",
    id: 3,
    role_code: "user",
    role_name: "普通用户",
    username: "jack",
  },
];

describe("userFilters", () => {
  it("distinguishes super administrators from regular administrators", () => {
    expect(
      filterUsers(users, {
        ...createDefaultUserFilters(),
        role: "admin",
      }),
    ).toEqual([users[1]]);

    expect(
      filterUsers(users, {
        ...createDefaultUserFilters(),
        role: "super",
      }),
    ).toEqual([users[0]]);
  });

  it("matches username against username and email", () => {
    expect(
      filterUsers(users, {
        ...createDefaultUserFilters(),
        username: "admin",
      }),
    ).toEqual([users[1]]);
  });

  it("filters by user id and created range", () => {
    expect(
      filterUsers(users, {
        ...createDefaultUserFilters(),
        createdRange: ["2026-01-02", "2026-01-03"],
        userId: "3",
      }),
    ).toEqual([users[2]]);
  });

  it("filters users by selected department ids", () => {
    expect(filterUsers(users, createDefaultUserFilters(), [9])).toEqual([users[2]]);
    expect(filterUsers(users, createDefaultUserFilters(), [20, 21])).toEqual([users[1]]);
  });

  it("filters users by their persisted account status", () => {
    expect(
      filterUsers(users, {
        ...createDefaultUserFilters(),
        status: "disabled",
      }),
    ).toEqual([users[1]]);
  });

  it("paginates a filtered result without mutating source data", () => {
    expect(paginateUsers(users, { page: 2, pageSize: 1 })).toEqual([users[1]]);
    expect(users).toHaveLength(3);
  });
});
