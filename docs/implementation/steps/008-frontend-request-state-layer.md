# 008 Frontend Request State Layer

## Purpose

Add a real frontend request state layer on top of the existing Axios wrapper.

Axios remains responsible for transport, headers, dual-token refresh, and normalized errors. Pinia Colada is now responsible for server-state caching, request deduplication, refresh, and invalidation.

## What Was Changed

The two Vue frontends now install Pinia Colada after Pinia:

- `apps/page`
- `apps/page`

The main frontend also uses the first query slice:

- current user query under the `auth` namespace
- login mutation under the `auth` namespace
- query disabled before an access token exists
- old auth query cache cleared on login and logout
- admin header reads the current user through the query layer
- successful current-user refresh syncs the Pinia auth store and stored user data
- login pages call the login mutation, while Axios remains the transport implementation behind it

## Files Updated

- `apps/page/package.json`
- `apps/page/src/main.ts`
- `apps/page/src/plugins/piniaColada.ts`
- `apps/page/src/queries/auth.ts`
- `apps/page/src/queries/auth.spec.ts`
- `apps/page/src/api/session.ts`
- `apps/page/src/stores/auth.ts`
- `apps/page/src/views/LoginView.vue`
- `apps/page/src/composables/useLogout.ts`
- `apps/page/src/components/layout/AppHeader.vue`
- `apps/page/README.md`
- `apps/page/docs/README.md`
- `apps/page/docs/infrastructure/request-state-layer.md`
- `apps/page/package.json`
- `apps/page/src/main.ts`
- `apps/page/src/plugins/piniaColada.ts`
- `apps/page/src/queries/auth.ts`
- `apps/page/src/queries/auth.spec.ts`
- `apps/page/src/api/session.ts`
- `apps/page/src/views/LoginView.vue`
- `apps/page/README.md`
- `contracts/admin-api/README.md`
- `README.md`

The workspace lockfile was also updated after installing `@pinia/colada`.

## Design Boundary

This step does not replace Axios and does not move auth state into Pinia Colada.

The boundary is:

- Axios: request transport and token refresh
- Pinia Colada: server-state cache, login mutation state, and invalidation
- Pinia: local application state

This avoids putting UI state, login state, and cached API data into one store.

## Verification

Ran:

```text
pnpm --dir apps/page check
pnpm --dir apps/page test
pnpm --dir apps/page build
pnpm --dir apps/page check
pnpm --dir apps/page test
pnpm --dir apps/page build
```

All commands passed.

`apps/page` build emitted a chunk-size warning. The build completed successfully, and this warning is acceptable for the current frontend baseline.

## Next Usage Pattern

Future API modules should follow this order:

```text
src/api/{module}.ts
  -> define raw Axios-backed API functions

src/queries/{module}.ts
  -> define query keys, query options, mutations, and invalidation

Vue page/component
  -> consume query composables and render state
```
