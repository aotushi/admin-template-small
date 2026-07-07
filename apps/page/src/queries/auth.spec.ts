import { describe, expect, it } from "vitest";

import { ACCESS_TOKEN_KEY } from "@/api/session";
import { AUTH_MUTATION_KEYS, AUTH_QUERY_KEYS, currentUserQueryOptions } from "@/queries/auth";

function getEnabledValue() {
  return currentUserQueryOptions().enabled;
}

describe("auth query options", () => {
  it("uses stable namespaced query keys", () => {
    expect(AUTH_QUERY_KEYS.root).toEqual(["auth"]);
    expect(AUTH_QUERY_KEYS.currentUser()).toEqual(["auth", "current-user"]);
    expect(AUTH_MUTATION_KEYS.login()).toEqual(["auth", "login"]);
  });

  it("does not request the current user before a token exists", () => {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);

    expect(getEnabledValue()).toBe(false);
  });

  it("allows the current user request after a token exists", () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");

    expect(getEnabledValue()).toBe(true);
  });
});
