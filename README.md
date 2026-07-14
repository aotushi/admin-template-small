# Admin Backend 3

Admin Backend 3 is the new main learning project for reviewing Vue admin development and connecting it with backend learning.

## Current Structure

```text
admin-backend-3/
  apps/
    page/          Vue 3 frontend using Vite+
  contracts/
    admin-api/
  services/
    api-hono/      copied Hono Cloudflare Workers backend
    api-go/
    api-java/
    api-nest/
    api-rust/
  docs/
```

## Project Direction

This project should copy the useful full-stack structure from `admin-backend-2`, but it should not copy Vben's high-abstraction frontend architecture.

The frontend should be easier to read and learn from:

- data behavior follows `admin-backend`
- visual style mainly follows `pure-admin/vue-pure-admin`
- Vben can still be used as a reference for selected high-quality screens such as login
- implementation stays local, simple, and explicit
- abstractions are added only after repeated real need appears

The frontend request stack uses Axios for HTTP transport and a hardened dual-token session. The access token stays in page memory, while the rotating refresh credential is kept in an HttpOnly cookie and represented only by a hash in D1. Pinia Colada handles server-state caching and invalidation, and Pinia handles local application state.

## Documentation

Implementation records are kept here:

- [Implementation Record](docs/implementation/README.md)

Current completed implementation steps:

- [Project Scaffold](docs/implementation/steps/003-project-scaffold.md)
- [Backend Hono Copy](docs/implementation/steps/004-backend-hono-copy.md)
- [Frontend Vite+ Foundation](docs/implementation/steps/005-frontend-vite-plus-foundation.md)
- [Frontend Pure-admin UI Shell](docs/implementation/steps/006-frontend-pure-admin-ui-shell.md)
- [Frontend Auth Linked Pages](docs/implementation/steps/007-frontend-auth-linked-pages.md)
- [Frontend Request State Layer](docs/implementation/steps/008-frontend-request-state-layer.md)
- [Hardened Dual-token Session](docs/implementation/steps/010-hardened-dual-token-session.md)
- [Axios Request Layer Structure](docs/implementation/steps/011-axios-request-layer-structure.md)

## Project Role

- `admin-backend`: source reference for simpler Vue admin behavior and data shape
- `admin-backend-2`: reference for full-stack layout and deployment shape
- `pure-admin/vue-pure-admin`: main reference for the first frontend UI shell
- `admin-backend-3`: active implementation project
