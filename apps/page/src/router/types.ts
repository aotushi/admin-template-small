import "vue-router";

import type { AccessRole } from "@/auth/rbac";

export interface AppRouteMeta {
  activeMenu?: string;
  guestOnly?: boolean;
  hideInMenu?: boolean;
  icon?: string;
  order?: number;
  permissions?: readonly string[];
  requiresAuth?: boolean;
  roles?: readonly AccessRole[];
  title?: string;
}

declare module "vue-router" {
  interface RouteMeta extends AppRouteMeta {}
}
