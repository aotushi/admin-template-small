# contracts/admin-api

Language-neutral HTTP contract for the admin system. Backend implementations should follow this contract instead of sharing frontend implementation code.

## Authentication

The admin API uses a rotating dual-token session:

- The short-lived access token is returned in JSON and sent as `Authorization: Bearer <accessToken>`.
- The long-lived refresh credential is an opaque value delivered only as an `HttpOnly` cookie. JavaScript must never receive or store it.
- The backend stores only a SHA-256 hash of the refresh credential and rotates it after every successful refresh.
- Reusing an already rotated credential revokes its complete session family.
- A refresh session expires after 7 idle days and can never continue beyond 30 days.

### Login

`POST /admin/api/auth/login`

Request:

```json
{
  "username": "vben",
  "password": "123456"
}
```

Success response:

```json
{
  "success": true,
  "data": {
    "accessToken": "<short-lived-jwt>",
    "tokenType": "Bearer",
    "expires": "2026-07-14T03:15:00.000Z",
    "sessionExpires": "2026-08-13T03:00:00.000Z",
    "user": {
      "id": 1,
      "username": "vben",
      "role": "admin",
      "email": "vben@example.com",
      "admin_level": "super",
      "created_by": null
    }
  }
}
```

The response also sets the host-only `admin_backend_refresh` cookie with `HttpOnly`, `SameSite=Strict`, and production `Secure` attributes. Its path is limited to `/admin/api/auth`.

### Refresh

`POST /admin/api/auth/refresh`

The request has no JSON body. The browser sends the refresh cookie automatically when the client enables credentials.

The response has the same shape as the login response and rotates the refresh cookie. A client must retry the original protected request at most once.

### Logout

`POST /admin/api/auth/logout`

The backend revokes the complete refresh-session family and expires the cookie. The frontend must clear its in-memory access token and all private query caches even if the logout request cannot reach the server.

### Browser Rules

- Login, refresh, and logout browser requests must come from an allowed exact origin.
- The production frontend and API use `https://admin.9shi.cc` and `https://api.9shi.cc`; both are same-site under HTTPS.
- Access and refresh credentials must not be written to `localStorage` or `sessionStorage`.
- Only `ACCESS_TOKEN_EXPIRED` allows an automatic refresh and one replay of the original request.
- Terminal refresh errors end the local session; network, timeout, rate-limit, and server failures keep the session recoverable.
- Tabs coordinate refresh through Web Locks and BroadcastChannel; credentials remain out of browser storage.

### Authentication Error Codes

| HTTP | Code | Client action |
| --- | --- | --- |
| 401 | `AUTH_REQUIRED` | Do not refresh automatically. |
| 401 | `ACCESS_TOKEN_EXPIRED` | Refresh once, then replay once. |
| 401 | `ACCESS_TOKEN_INVALID` | End the local session. |
| 401 | `ACCOUNT_UNAVAILABLE` | End the session; the backend revokes that user's refresh sessions. |
| 401 | `REFRESH_MISSING` | End the local session. |
| 401 | `REFRESH_EXPIRED` | End the local session. |
| 401 | `REFRESH_REVOKED` | End the local session. |
| 401 | `REFRESH_REPLAYED` | Revoke the family and end the local session. |
| 403 | `FORBIDDEN` | Keep the session and deny the operation. |
| 403 | `ORIGIN_NOT_ALLOWED` | End the browser session. |
| 503 | `AUTH_SERVICE_UNAVAILABLE` | Keep the session and allow a later retry. |

## Demo Accounts

| Display | username | password | role  | admin_level |
| ------- | -------- | -------- | ----- | ----------- |
| Super   | `vben`   | `123456` | admin | super       |
| Admin   | `admin`  | `123456` | admin | sub         |
| User    | `jack`   | `123456` | user  | null        |

## Frontend State Boundary

- Axios transports requests, adds the in-memory access token, performs one shared refresh, and normalizes errors.
- Pinia Colada owns cached server data and clears private cache entries when the account changes or the session ends.
- Pinia owns local authentication, user, permission, layout, and preference state.

The contract is framework-neutral; alternative frontends only need to preserve the HTTP and security behavior above.
