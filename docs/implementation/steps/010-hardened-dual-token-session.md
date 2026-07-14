# 010 Hardened Dual-token Session

## Purpose

Replace the earlier browser-readable access and refresh JWT pair with a safer session model suitable for the first Cloudflare deployment.

## What Changed

- The access JWT lasts 15 minutes and remains only in frontend memory.
- The refresh credential is an opaque random value in an HttpOnly cookie.
- D1 stores only the refresh credential hash.
- Every refresh rotates the credential in one D1 batch.
- Reuse of an old rotated credential revokes its complete session family.
- Refresh sessions have a 7-day idle limit and a 30-day absolute limit.
- Logout revokes the server session and clears the cookie.
- The backend returns stable authentication error codes and distinguishes expired, invalid, missing, revoked, replayed, and unavailable sessions.
- Axios refreshes only for `ACCESS_TOKEN_EXPIRED`, shares concurrent work, detects delayed old-token responses, and retries each request only once.
- A 30-second proactive refresh window reduces avoidable expired requests.
- Web Locks, BroadcastChannel, and a peer-session handshake coordinate refresh across tabs without writing tokens to browser storage.
- Login, logout, refresh, and account switching are ordered by one session coordinator.
- The route guard restores the session after a browser reload.
- Account changes and logout clear all private Pinia Colada cache entries.
- Exact browser origins protect login, refresh, and logout requests.
- The tracked production JWT secret was removed from `wrangler.toml`.

## Deployment Boundary

Local migrations 017 and 018 are part of this step. No remote D1 command was run. Production deployment still requires an operator to set `JWT_SECRET` and explicitly approve the remote migrations.

## References

- [RFC 6750: OAuth 2.0 Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html)
- [RFC 9700: OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html)
- [OAuth 2.0 for Browser-Based Applications](https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/26/)
- Hono cookie helper options
- Cloudflare Workers Web Crypto and D1 batch transaction behavior

## Post-implementation Audit

The standards review is now implemented. The frontend no longer treats a plain `401` as proof that an access token expired. Stable backend codes drive the decision, temporary failures keep the recoverable session, and terminal failures clear it.

Real browser testing found that Web Locks alone serialized two tabs but could still allow a second refresh before the first broadcast arrived. The final implementation adds a peer-session request inside the lock, so the waiting tab explicitly obtains the newly issued in-memory session instead of rotating the cookie again.

## Verification

Completed locally:

- Frontend formatting, linting, type checking, 54 tests, and production build passed.
- The Hono Worker dry-run build passed and the local Worker started successfully.
- Migrations 017 and 018 were applied to local D1 only.
- Seven backend authentication and rate-limit tests passed.
- API checks confirmed login, cookie attributes, unique access tokens, refresh rotation, protected access, replay-family revocation, account-disable revocation, logout revocation, and stable error codes.
- Browser checks confirmed login, no auth keys in local storage, one refresh on page reload, one refresh across two simultaneously restoring tabs, successful logout, cookie removal, and failure to restore after logout.
- No remote D1 command was run.
