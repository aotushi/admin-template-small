# 003 Project Scaffold

## Purpose

Create the first real project structure for `admin-backend-3`.

This step creates the frontend folder, shared API contract folder, and multi-language backend folders before any real frontend or backend implementation begins.

## What Was Created

The project now has this structure:

```text
admin-backend-3/
  apps/
    page/
  contracts/
    admin-api/
  services/
    api-hono/
    api-go/
    api-java/
    api-nest/
    api-rust/
  docs/
```

## Frontend Folder

The frontend folder is:

```text
apps/page
```

It currently contains only the planned source folders:

```text
src/api
src/assets
src/components
src/layouts
src/router
src/stores
src/styles
src/views
public
```

The real Vue scaffold is intentionally not added in this step. It will be added after the frontend implementation plan is reviewed.

## Backend Folders

The backend folder is:

```text
services
```

The first active backend will be:

```text
services/api-hono
```

It targets the first Cloudflare Workers version.

The following folders are reserved for later backend implementations:

```text
services/api-go
services/api-java
services/api-nest
services/api-rust
```

These folders exist now because the project is meant to support both Cloudflare deployment and later server deployment.

## Contract Folder

The shared API contract folder is:

```text
contracts/admin-api
```

This follows the same contract location used by `admin-backend-2`.

The purpose is to keep API behavior language-neutral so every backend implementation can follow the same contract.

## Workspace Files

The root workspace files were added:

```text
package.json
pnpm-workspace.yaml
```

The root workspace is intentionally lightweight. It is for project-level commands and JavaScript/TypeScript packages only.

Go, Java, and Rust folders are present in the repository, but they are not forced into the JavaScript workspace.

## References Used

Used `admin-backend-2` as the structural reference:

```text
contracts/admin-api
services/api-hono
services/api-go
services/api-java
services/api-nest
services/api-rust
```

Used the current project agreement that `admin-backend-3` should avoid Vben frontend abstraction in the first version.

## Result

The project now has a full-stack file structure ready for the next steps:

- frontend scaffold planning
- Hono backend scaffold planning
- Cloudflare deployment planning
- later multi-language backend implementations

## Verification

Verified that:

- the frontend folder exists
- the contract folder exists
- all planned backend language folders exist
- root workspace files exist
- the root README describes the current structure

