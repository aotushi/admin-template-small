# 009 Local Demo Users

## Goal

Unify the frontend quick-login accounts with the local Hono backend database.

## Account Model

| Display | username | password | role  | admin_level | created_by |
| ------- | -------- | -------- | ----- | ----------- | ---------- |
| Super   | `vben`   | `123456` | admin | super       | null       |
| Admin   | `admin`  | `123456` | admin | sub         | `vben`     |
| User    | `jack`   | `123456` | user  | null        | `admin`    |

## Implementation

- Added D1 migration `services/api-hono/migrations/015_seed_frontend_demo_users.sql`.
- Updated `apps/page` quick-login passwords from `admin123` to `123456`.
- Kept `apps/page` unchanged because it was already aligned.
- Updated the protected system account from `admin` to `vben`.
- Updated API contract and backend README account examples.

## Local-Only Safety

This step was validated against local D1 only. No command with `--remote` was run.

## Verification

Run:

```text
pnpm exec wrangler d1 migrations apply admin-backend-db --local
pnpm exec wrangler d1 execute admin-backend-db --local --command "SELECT id, username, role, email, admin_level, created_by FROM users WHERE username IN ('vben', 'admin', 'jack') ORDER BY id;"
```
