# 006 Frontend Pure-admin UI Shell

## Purpose

Rework the first admin shell toward the `pure-admin/vue-pure-admin` visual direction.

This step changes only the UI layer. It keeps the current Vue 3, Element Plus, Pinia, Vue Router, Vite+, and local implementation approach. It does not introduce `@vben/*` packages or pure-admin internal abstractions.

## Reference Decision

The frontend visual reference changed:

- main admin shell reference: `pure-admin/vue-pure-admin`
- selected login-page quality reference: Vben
- data and behavior reference: `admin-backend`
- deployment and full-stack organization reference: `admin-backend-2`

The reason is learning clarity. Pure-admin is closer to the simpler Element Plus admin direction used by the original `admin-backend`, while Vben remains useful as a later architecture study and as a reference for polished individual screens.

## What Was Changed

The frontend shell now uses a pure-admin-like layout:

- dark vertical sidebar
- 210px expanded sidebar width
- 54px collapsed sidebar width
- 48px header
- 34px tab bar
- light gray workspace background
- flat white Element Plus cards
- Element Plus menu rendering instead of custom sidebar buttons
- active menu styling with a blue selected block
- dark-mode styling for the shell and cards
- mobile drawer behavior with overlay and no horizontal overflow

The dashboard page was adjusted to match the new shell:

- metric cards use `ElCard`
- main panels use flat cards
- spacing and body density are closer to pure-admin
- progress text now describes the pure-admin UI shell step

## Files Updated

- `apps/page/src/styles/index.css`
- `apps/page/src/layouts/AdminLayout.vue`
- `apps/page/src/components/layout/AppSidebar.vue`
- `apps/page/src/components/layout/AppHeader.vue`
- `apps/page/src/components/layout/AppTabs.vue`
- `apps/page/src/components/dashboard/StatCard.vue`
- `apps/page/src/views/DashboardView.vue`
- `apps/page/src/main.ts`
- `apps/page/README.md`

## Verification

Ran:

```text
pnpm check
pnpm test:page
pnpm build:page
```

All passed.

Browser verification was also completed in Chrome:

- desktop dashboard renders with the pure-admin-like sidebar, header, tabs, and card shell
- sidebar collapse changes width from 210px to 54px and keeps the header aligned
- theme toggle switches the shell between light and dark visual states
- mobile layout opens the sidebar as a drawer
- mobile drawer shows a dimmed overlay and hides the floating open button while open
- no unresolved Element Plus tags remain in the rendered page

Console warnings observed during browser verification came from browser extension / Tauri metadata checks, not from this Vue application.
