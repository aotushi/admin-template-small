import { describe, expect, it } from "vitest";

import type { AdminUserListItem } from "@/api/users";
import { createDefaultUserFilters, filterUsers, paginateUsers } from "./userFilters";

const users: AdminUserListItem[] = [
  {
    admin_level: "super",
    created_at: "2026-01-01T08:00:00.000Z",
    created_by_username: null,
    email: "vben@example.com",
    id: 1,
    role: "admin",
    username: "vben",
  },
  {
    admin_level: "sub",
    created_at: "2026-01-02T08:00:00.000Z",
    created_by_username: "vben",
    email: "admin@example.com",
    id: 2,
    role: "admin",
    username: "admin",
  },
  {
    admin_level: null,
    created_at: "2026-01-03T08:00:00.000Z",
    created_by_username: "admin",
    email: "jack@example.com",
    id: 3,
    role: "user",
    username: "jack",
  },
];

describe("userFilters", () => {
  it("filters by role and admin level", () => {
    expect(
      filterUsers(users, {
        ...createDefaultUserFilters(),
        adminLevel: "sub",
        role: "admin",
      }),
    ).toEqual([users[1]]);
  });

  it("matches username against username and email", () => {
    expect(
      filterUsers(users, {
        ...createDefaultUserFilters(),
        username: "admin",
      }),
    ).toEqual([users[1]]);
  });

  it("filters by user id, remark, and created range", () => {
    expect(
      filterUsers(users, {
        ...createDefaultUserFilters(),
        createdRange: ["2026-01-02", "2026-01-03"],
        remark: "普通",
        userId: "3",
      }),
    ).toEqual([users[2]]);
  });

  it("paginates a filtered result without mutating source data", () => {
    expect(paginateUsers(users, { page: 2, pageSize: 1 })).toEqual([users[1]]);
    expect(users).toHaveLength(3);
  });
});
