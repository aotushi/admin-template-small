# 007 Frontend Auth Linked Pages

## Purpose

Add the pages behind the action buttons on the login page while keeping the existing Vben-style login visual system.

This step stays in the frontend UI layer. It does not add backend demo users, new backend authentication branches, or global RBAC model changes.

## What Was Added

The login page now links to real pages for:

- mobile login
- QR code login
- forgot password
- account registration

The pages reuse the existing authentication shell:

- same logo placement
- same illustration side
- same right-side form density
- same toolbar for theme, layout, language, and primary color
- same return-to-login behavior

## Files Updated

- `apps/page/src/components/auth/AuthPageShell.vue`
- `apps/page/src/components/auth/AuthLinkedActionForm.vue`
- `apps/page/src/components/auth/AuthLoginForm.vue`
- `apps/page/src/views/auth/MobileLoginView.vue`
- `apps/page/src/views/auth/QrCodeLoginView.vue`
- `apps/page/src/views/auth/ForgotPasswordView.vue`
- `apps/page/src/views/auth/RegisterView.vue`
- `apps/page/src/router/index.ts`
- `apps/page/src/toolchain-smoke.test.ts`

## Verification

Ran:

```text
pnpm check
pnpm test:page
pnpm build:page
```

All passed.

Browser verification was also completed:

- login page buttons link to the new pages
- mobile login page renders phone and SMS-code fields
- QR code page renders a QR-style panel and refresh button
- forgot password page renders account, code, new password, and confirm password fields
- registration page renders account, phone, email, code, password, confirm password, agreement, and submit controls
- every page includes a working return-to-login link
- mobile viewport has no horizontal overflow

## Boundary

These pages currently provide the frontend interaction layer only. Real mobile code delivery, QR login sessions, password reset, and registration APIs should be connected later through the normal request layer after the backend contract is defined.
