import { beforeEach, describe, expect, it } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/api/session";
import { AUTH_MUTATION_KEYS, AUTH_QUERY_KEYS, currentUserQueryOptions } from "@/queries/auth";

function getEnabledValue() {
  return currentUserQueryOptions().enabled;
}

describe("auth query options", () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it("uses stable namespaced query keys", () => {
    expect(AUTH_QUERY_KEYS.root).toEqual(["auth"]);
    expect(AUTH_QUERY_KEYS.currentUser()).toEqual(["auth", "current-user"]);
    expect(AUTH_MUTATION_KEYS.login()).toEqual(["auth", "login"]);
  });

  it("does not request the current user before a token exists", () => {
    expect(getEnabledValue()).toBe(false);
  });

  it("allows the current user request after a token exists", () => {
    saveAuthSession({
      accessToken: "access-token",
      expires: "2026-07-14T03:15:00.000Z",
      sessionExpires: "2026-07-21T03:00:00.000Z",
      tokenType: "Bearer",
      user: {
        id: 1,
        roles: ["admin"],
        username: "vben",
      },
    });

    expect(getEnabledValue()).toBe(true);
  });
});
