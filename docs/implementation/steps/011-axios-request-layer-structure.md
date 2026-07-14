# 011 Axios Request Layer Structure

## Purpose

Make the frontend request flow readable and testable without changing business API import paths or weakening the existing dual-token session.

## What Changed

- Split Axios defaults, request options, error normalization, response unwrapping, interceptors, and HTTP methods into focused files under `apps/page/src/api/http`.
- Kept `apps/page/src/api/request.ts` as the stable business-facing export.
- Made the setup order explicit: create one instance, install the request interceptor, install the response interceptor, then expose business methods.
- Added explicit `authMode` request policies for public, optional, and protected requests.
- Added `HEAD` and `OPTIONS` so the wrapper covers the normal Axios method set.
- Exposed only one production singleton, `requestClient`; the raw Axios instance and duplicate aliases are private.
- Preserved the in-memory access token and HttpOnly refresh-cookie design.
- Added a dedicated session coordinator for proactive refresh, stable error-code decisions, delayed `401` handling, cross-tab coordination, and login/logout races.
- Added tests for request headers, public auth requests, concurrent `401` responses, peer-session reuse, temporary failures, terminal failures, and one replay per failed request.

## Reference Decision

The local FullStack Axios guide is suitable as a minimum capability checklist. Its localStorage token example and `{ code, message, data }` response shape were not copied because they conflict with this project's security and backend contract.

Optional global loading, request deduplication, automatic retries, and upload/download helpers remain deferred until a real feature requires them. Pinia Colada continues to own server-state caching and shared queries.

## Verification

Completed locally:

- Vite+ formatting and lint checks passed for 115 files.
- Vue TypeScript checking passed.
- All 54 frontend tests passed, including interceptor, concurrent-refresh, cross-tab coordination, and logout-race cases.
- The production build passed; the existing large-chunk warning remains unchanged.
- Browser automation confirmed one login request, one session refresh after reload, no auth keys in local storage, and successful server logout.
