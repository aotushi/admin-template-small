import type { RouteRecordRaw } from "vue-router";
import { PERMISSION_CODES } from "@admin-backend-3/admin-api-contract/permissions";

import "@/router/types";

const authRoutes: RouteRecordRaw[] = [
  {
    component: () => import("@/views/login/LoginView.vue"),
    meta: {
      guestOnly: true,
      hideInMenu: true,
      title: "登录",
    },
    name: "Login",
    path: "/login",
  },
  {
    meta: {
      hideInMenu: true,
    },
    path: "/login/:action(mobile|qrcode|forgot-password|register)",
    redirect: "/login",
  },
];

const errorRoutes: RouteRecordRaw[] = [
  {
    component: () => import("@/views/error/ForbiddenView.vue"),
    meta: {
      hideInMenu: true,
      requiresAuth: true,
      title: "无权限",
    },
    name: "Forbidden",
    path: "/403",
  },
  {
    component: () => import("@/views/error/NotFoundView.vue"),
    meta: {
      hideInMenu: true,
      title: "页面不存在",
    },
    name: "NotFound",
    path: "/404",
  },
  {
    component: () => import("@/views/error/ServerErrorView.vue"),
    meta: {
      hideInMenu: true,
      title: "服务异常",
    },
    name: "ServerError",
    path: "/500",
  },
];

export const appRoutes: RouteRecordRaw[] = [
  {
    component: () => import("@/views/dashboard/DashboardView.vue"),
    meta: {
      icon: "HomeFilled",
      order: 10,
      requiresAuth: true,
      title: "概览",
    },
    name: "Dashboard",
    path: "/dashboard",
  },
  // 分组路由省略 component（Vue Router 4.1+）：仅提供路径前缀、meta 链与菜单结构，子页面直接渲染进 MainLayout 的 RouterView
  {
    meta: {
      icon: "Grid",
      order: 20,
      requiresAuth: true,
      title: "公共组件",
    },
    name: "CommonComponents",
    path: "/components",
    redirect: "/components/table/basic",
    children: [
      {
        meta: {
          order: 10,
          title: "表格",
        },
        name: "CommonComponentsTable",
        path: "table",
        redirect: "/components/table/basic",
        children: [
          {
            component: () => import("@/views/showcase/CommonComponentsView.vue"),
            meta: {
              order: 10,
              title: "基础表格",
            },
            name: "CommonComponentsTableBasic",
            path: "basic",
          },
          {
            component: () => import("@/views/showcase/CommonComponentsView.vue"),
            meta: {
              order: 20,
              title: "搜索表格",
            },
            name: "CommonComponentsTableSearch",
            path: "search",
          },
        ],
      },
      {
        component: () => import("@/views/showcase/CommonComponentsView.vue"),
        meta: {
          order: 20,
          title: "查询表单",
        },
        name: "CommonComponentsForm",
        path: "form",
      },
      {
        component: () => import("@/views/showcase/CommonComponentsView.vue"),
        meta: {
          order: 30,
          title: "树形筛选",
        },
        name: "CommonComponentsTree",
        path: "tree",
      },
    ],
  },
  {
    meta: {
      icon: "Setting",
      order: 30,
      requiresAuth: true,
      title: "系统管理",
    },
    name: "SystemManagement",
    path: "/system",
    redirect: "/system/users",
    children: [
      {
        component: () => import("@/views/system/users/UserManagementView.vue"),
        meta: {
          icon: "UserFilled",
          order: 10,
          // meta.permission 样板：由后端下发的权限码判定访问
          permission: PERMISSION_CODES.systemUserView,
          title: "用户管理",
        },
        name: "SystemUsers",
        path: "users",
      },
      {
        component: () => import("@/views/system/roles/RoleManagementView.vue"),
        meta: {
          order: 20,
          permission: PERMISSION_CODES.systemRoleView,
          title: "角色管理",
        },
        name: "SystemRoles",
        path: "roles",
      },
      {
        component: () => import("@/views/system/menus/MenuManagementView.vue"),
        meta: {
          order: 30,
          permission: PERMISSION_CODES.systemMenuView,
          title: "菜单管理",
        },
        name: "SystemMenus",
        path: "menus",
      },
      {
        component: () => import("@/views/system/depts/DeptManagementView.vue"),
        meta: {
          order: 40,
          permission: PERMISSION_CODES.systemDeptView,
          title: "部门管理",
        },
        name: "SystemDepts",
        path: "depts",
      },
    ],
  },
];

export const routes: RouteRecordRaw[] = [
  ...authRoutes,
  {
    children: appRoutes,
    component: () => import("@/layouts/MainLayout.vue"),
    meta: {
      hideInMenu: true,
      requiresAuth: true,
    },
    path: "/",
    redirect: "/dashboard",
  },
  ...errorRoutes,
  {
    path: "/:pathMatch(.*)*",
    redirect: "/404",
  },
];
