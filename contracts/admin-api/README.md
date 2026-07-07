# contracts/admin-api

Language-neutral API contract for the admin system.

All backend implementations should conform to this contract instead of sharing frontend implementation code.

This folder follows the contract location used by `admin-backend-2`.

## Authentication

The admin API uses a dual-token session model.

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
    "accessToken": "<short-lived jwt>",
    "refreshToken": "<long-lived jwt>",
    "tokenType": "Bearer",
    "expires": "2026-07-06T03:15:00.000Z",
    "refreshExpires": "2026-07-13T03:00:00.000Z",
      "user": {
        "id": 1,
        "username": "v**n",
        "role": "admin",
        "email": "vb**@ex*****.com",
        "admin_level": "super",
        "created_by": null
      }
  }
}
```

Rules:

- `accessToken` is used in `Authorization: Bearer <accessToken>` for normal API calls.
- `refreshToken` is only used to call the refresh endpoint.
- Backend implementations must reject refresh tokens on normal protected routes.

### Demo Accounts

Local development uses the same demo accounts as the frontend quick-login list.

| Display | username | password | role  | admin_level |
| ------- | -------- | -------- | ----- | ----------- |
| Super   | `vben`   | `123456` | admin | super       |
| Admin   | `admin`  | `123456` | admin | sub         |
| User    | `jack`   | `123456` | user  | null        |

### Refresh

`POST /admin/api/auth/refresh`

Request:

```json
{
  "refreshToken": "<long-lived jwt>"
}
```

Success response:

```json
{
  "success": true,
  "data": {
    "accessToken": "<new short-lived jwt>",
    "refreshToken": "<new long-lived jwt>",
    "tokenType": "Bearer",
    "expires": "2026-07-06T03:30:00.000Z",
    "refreshExpires": "2026-07-13T03:15:00.000Z"
  }
}
```

Frontend clients should retry a failed protected request once after a successful refresh. If refresh fails, the client should clear the local session and send the user back through the login flow.

## Frontend Request State Boundary

Frontend implementations may use a query-cache layer for server state, but the API contract stays framework-neutral.

The current Vue frontend uses this boundary:

- Axios sends HTTP requests, attaches `accessToken`, refreshes with `refreshToken`, and normalizes API errors.
- Pinia Colada caches server data such as current user, future user lists, roles, menus, permissions, and dictionaries.
- Pinia stores local application state such as login status, current user snapshot, layout, permissions, and preferences.

This means backend implementations only need to follow the HTTP contract. They do not need to know whether the frontend cache is powered by Pinia Colada or another client-side library.
