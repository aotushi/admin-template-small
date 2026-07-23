import { describe, expect, it, vi } from "vitest";

import { onRequest } from "../../functions/assets/[[path]]";

describe("Pages asset fallback", () => {
  it("converts an HTML SPA fallback into a non-cacheable 404", async () => {
    const response = await onRequest({
      next: vi.fn().mockResolvedValue(
        new Response("<!doctype html>", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
          status: 200,
        }),
      ),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("");
  });

  it("keeps an existing JavaScript asset response unchanged", async () => {
    const assetResponse = new Response("export default {};", {
      headers: { "Content-Type": "application/javascript" },
      status: 200,
    });

    const response = await onRequest({
      next: vi.fn().mockResolvedValue(assetResponse),
    });

    expect(response).toBe(assetResponse);
  });

  it("normalizes an existing asset 404 as non-cacheable", async () => {
    const response = await onRequest({
      next: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
