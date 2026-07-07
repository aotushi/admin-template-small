import { describe, expect, it } from "vitest";

import { resolvePostLoginRedirect } from "./redirect";

describe("resolvePostLoginRedirect", () => {
  it("uses dashboard as the default post-login target", () => {
    expect(resolvePostLoginRedirect(undefined)).toBe("/dashboard");
    expect(resolvePostLoginRedirect(null)).toBe("/dashboard");
  });

  it("keeps internal protected paths with query strings", () => {
    expect(resolvePostLoginRedirect("/dashboard")).toBe("/dashboard");
    expect(resolvePostLoginRedirect("/users?page=1")).toBe("/users?page=1");
  });

  it("uses the first redirect value when query parsing returns an array", () => {
    expect(resolvePostLoginRedirect(["/dashboard", "/users"])).toBe("/dashboard");
  });

  it("rejects external or login-page redirects", () => {
    expect(resolvePostLoginRedirect("https://example.com")).toBe("/dashboard");
    expect(resolvePostLoginRedirect("//example.com")).toBe("/dashboard");
    expect(resolvePostLoginRedirect("/login")).toBe("/dashboard");
    expect(resolvePostLoginRedirect("/login?redirect=/users")).toBe("/dashboard");
    expect(resolvePostLoginRedirect("/login/mobile")).toBe("/dashboard");
  });
});
