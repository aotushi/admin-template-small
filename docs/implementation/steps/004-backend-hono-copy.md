# 004 Backend Hono Copy

## Purpose

Replace the placeholder Hono backend folder with the real backend implementation from `admin-backend-2`.

The backend does not need to be recreated from scratch at this stage. Project 2 already has the first Cloudflare Workers backend implementation, so project 3 can reuse it directly.

## What Was Done

Copied the Hono backend from:

```text
admin-backend-2/services/api-hono
```

to:

```text
admin-backend-3/services/api-hono
```

The copy includes:

- Hono Worker entry
- routes
- middleware
- models
- services
- utilities
- migrations
- Wrangler config
- package config
- backend README files

The copy excludes generated dependency/output folders such as `node_modules`, `.wrangler`, and `dist`.

## Project Identity Adjustment

The backend package name was changed from the project 2 name to the project 3 name:

```text
@admin-backend-3/api-hono
```

The Worker name in `wrangler.toml` was also changed to:

```text
admin-backend-3-api-hono
```

The backend behavior itself was not redesigned in this step.

## Why This Direction

The current learning goal is focused on frontend Vue admin structure and multi-language backend comparison.

The Hono backend already exists in `admin-backend-2`, so copying it keeps the first Cloudflare Workers backend available while avoiding unnecessary backend rework.

## Verification

Ran the root backend build command:

```text
pnpm build:api:hono
```

The command ran Wrangler in dry-run mode and completed successfully.

The local dev command starts the copied backend on port `8788`. This avoids the unrelated local process already using port `8787`.

Also started the copied backend locally on port `8788` and verified:

```text
GET /admin
GET /admin/health
```

Both returned healthy JSON responses.

No remote D1 command was run.
