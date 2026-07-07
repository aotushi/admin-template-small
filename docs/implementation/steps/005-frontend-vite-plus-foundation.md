# 005 Frontend Vite+ Foundation

## Purpose

Create a real frontend project under `apps/page`.

The previous folder was only a placeholder. This step turns it into a runnable Vue admin frontend using Vite+ as the frontend toolchain.

## What Was Created

The frontend now includes:

- Vue 3 application entry
- Vite+ config
- TypeScript config
- environment files
- Vue Router setup
- Pinia auth store
- local API client
- login page
- admin layout
- sidebar
- header
- dashboard page
- smoke test

## Toolchain

The frontend uses Vite+ through `vp` commands:

```text
pnpm dev
pnpm build
pnpm check
pnpm test
```

The project root forwards to the frontend with:

```text
pnpm dev:page
pnpm build:page
pnpm test:page
pnpm fix:page
```

Vite+ replaces separate formatting, linting, and frontend test commands for this first frontend version.

## Frontend Direction

This frontend intentionally avoids Vben package abstraction.

It uses:

- Vue 3
- Vue Router
- Pinia
- Element Plus
- local components
- local layouts
- local request code

It does not use:

- `@vben/*` packages
- Vben workspace packages
- Vben command wrappers
- copied Vben frontend internals

## Component Boundary

The first frontend foundation keeps clear local component boundaries:

- `App.vue`: route outlet only
- `AdminLayout.vue`: composes the admin shell
- `AppSidebar.vue`: sidebar menu
- `AppHeader.vue`: top header and logout
- `LoginView.vue`: login form and login action
- `DashboardView.vue`: first dashboard page
- `StatCard.vue`: dashboard metric card
- `useLogout.ts`: logout behavior
- `stores/auth.ts`: auth session state
- `api/client.ts`: shared request wrapper

## References Used

Used `admin-backend` as the data/API behavior reference:

- login endpoint shape
- profile endpoint shape
- authenticated request style

Used `admin-backend-2` as the visual and toolchain reference:

- admin layout direction
- Vite+ scripts
- Vite+ dependency alias for `vite`
- Hono backend proxy path

## Verification

Ran:

```text
pnpm install --no-frozen-lockfile
pnpm fix:page
pnpm check
pnpm test:page
pnpm build:page
```

All passed.

Also opened the running frontend in Chrome:

- `/login` rendered the login page
- `/dashboard` rendered the admin layout and dashboard after a temporary local browser session was seeded
- missing Element Plus component warnings were found and fixed
- the frontend dev server was verified at `http://127.0.0.1:5173`
- the frontend development proxy points `/admin` requests to `http://localhost:8788`

The only remaining browser warning came from an external Tauri metadata check and was not related to this Vue app.
