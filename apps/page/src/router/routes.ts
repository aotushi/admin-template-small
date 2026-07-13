import type { RouteRecordRaw } from "vue-router";

import "@/router/types";

const authRoutes: RouteRecordRaw[] = [
  {
    component: () => import("@/views/LoginView.vue"),
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
    component: () => import("@/views/DashboardView.vue"),
    meta: {
      icon: "HomeFilled",
      order: 10,
      requiresAuth: true,
      roles: ["super", "admin", "user"],
      title: "概览",
    },
    name: "Dashboard",
    path: "/dashboard",
  },
  {
    component: () => import("@/views/RouteGroupView.vue"),
    meta: {
      icon: "DataLine",
      order: 20,
      requiresAuth: true,
      roles: ["super", "admin"],
      title: "数据统计",
    },
    name: "Statistics",
    path: "/statistics",
    redirect: "/statistics/daily",
    children: [
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 10,
          permissions: ["statistics:daily:view"],
          roles: ["super", "admin"],
          title: "每日数据统计",
        },
        name: "StatisticsDaily",
        path: "daily",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 20,
          permissions: ["statistics:history:view"],
          roles: ["super", "admin"],
          title: "历史数据查询",
        },
        name: "StatisticsHistory",
        path: "history",
      },
    ],
  },
  {
    component: () => import("@/views/RouteGroupView.vue"),
    meta: {
      icon: "Document",
      order: 30,
      requiresAuth: true,
      roles: ["super", "admin", "user"],
      title: "数据报告",
    },
    name: "Reports",
    path: "/reports",
    redirect: "/reports/data",
    children: [
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 10,
          permissions: ["reports:edit"],
          roles: ["super", "admin"],
          title: "报告编辑",
        },
        name: "ReportEditor",
        path: "editor",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 20,
          permissions: ["reports:data:view"],
          roles: ["super", "admin", "user"],
          title: "数据报表",
        },
        name: "ReportData",
        path: "data",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 30,
          permissions: ["reports:settlement:view"],
          roles: ["super", "admin", "user"],
          title: "结算单",
        },
        name: "SettlementReport",
        path: "settlement",
      },
    ],
  },
  {
    component: () => import("@/views/RouteGroupView.vue"),
    meta: {
      icon: "Files",
      order: 40,
      requiresAuth: true,
      roles: ["super", "admin", "user"],
      title: "Excel管理",
    },
    name: "Excel",
    path: "/excel",
    redirect: "/excel/files",
    children: [
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 10,
          permissions: ["excel:upload"],
          roles: ["super", "admin"],
          title: "文件上传",
        },
        name: "ExcelUpload",
        path: "upload",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 20,
          permissions: ["excel:files:view"],
          roles: ["super", "admin", "user"],
          title: "文件列表",
        },
        name: "ExcelFiles",
        path: "files",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          activeMenu: "/excel/files",
          hideInMenu: true,
          permissions: ["excel:data:view"],
          roles: ["super", "admin", "user"],
          title: "数据查看",
        },
        name: "ExcelDataView",
        path: "data/:fileId?",
      },
    ],
  },
  {
    component: () => import("@/views/RouteGroupView.vue"),
    meta: {
      icon: "Connection",
      order: 50,
      requiresAuth: true,
      roles: ["super", "admin", "user"],
      title: "API 管理",
    },
    name: "ApiManagement",
    path: "/api",
    redirect: "/api/my-keys",
    children: [
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 10,
          permissions: ["api-keys:manage"],
          roles: ["super", "admin"],
          title: "API Key 管理",
        },
        name: "ApiKeyManagement",
        path: "keys",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 20,
          permissions: ["api-keys:own:view"],
          roles: ["super", "admin", "user"],
          title: "我的 API Key",
        },
        name: "MyApiKeys",
        path: "my-keys",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 30,
          permissions: ["api-docs:view"],
          roles: ["super", "admin", "user"],
          title: "API 文档",
        },
        name: "ApiDocs",
        path: "docs",
      },
    ],
  },
  {
    component: () => import("@/views/RouteGroupView.vue"),
    meta: {
      icon: "Grid",
      order: 55,
      requiresAuth: true,
      title: "公共组件",
    },
    name: "CommonComponents",
    path: "/components",
    redirect: "/components/table/basic",
    children: [
      {
        component: () => import("@/views/RouteGroupView.vue"),
        meta: {
          order: 10,
          title: "表格",
        },
        name: "CommonComponentsTable",
        path: "table",
        redirect: "/components/table/basic",
        children: [
          {
            component: () => import("@/views/components/CommonComponentsView.vue"),
            meta: {
              order: 10,
              title: "基础表格",
            },
            name: "CommonComponentsTableBasic",
            path: "basic",
          },
          {
            component: () => import("@/views/components/CommonComponentsView.vue"),
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
        component: () => import("@/views/components/CommonComponentsView.vue"),
        meta: {
          order: 20,
          title: "查询表单",
        },
        name: "CommonComponentsForm",
        path: "form",
      },
      {
        component: () => import("@/views/components/CommonComponentsView.vue"),
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
    component: () => import("@/views/RouteGroupView.vue"),
    meta: {
      icon: "Setting",
      order: 60,
      requiresAuth: true,
      roles: ["super", "admin"],
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
          permissions: ["system:users:manage"],
          roles: ["super", "admin"],
          title: "用户管理",
        },
        name: "SystemUsers",
        path: "users",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 20,
          permissions: ["system:user-data:view"],
          roles: ["super", "admin"],
          title: "用户数据",
        },
        name: "SystemUserData",
        path: "user-data",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          activeMenu: "/system/user-data",
          hideInMenu: true,
          permissions: ["system:user-data:view"],
          roles: ["super", "admin"],
          title: "用户数据详情",
        },
        name: "SystemUserDataDetail",
        path: "user-data/:userId",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 30,
          permissions: ["system:roles:manage"],
          roles: ["super"],
          title: "角色管理",
        },
        name: "SystemRoles",
        path: "roles",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 40,
          permissions: ["system:permissions:manage"],
          roles: ["super"],
          title: "权限管理",
        },
        name: "SystemPermissions",
        path: "permissions",
      },
      {
        component: () => import("@/views/FeaturePlaceholderView.vue"),
        meta: {
          order: 50,
          permissions: ["system:menus:manage"],
          roles: ["super"],
          title: "菜单管理",
        },
        name: "SystemMenus",
        path: "menus",
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
