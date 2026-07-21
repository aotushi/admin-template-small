import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteRecordRaw } from "vue-router";
import { createMemoryHistory, createRouter } from "vue-router";

import type { CurrentUser } from "@/api/types";
import { setupRouterGuards } from "@/router/guards";

// 守卫单元测试：mock auth store 的最小接口，路由表用与真实 routes.ts 同构的
// 精简夹具（占位组件，避免拉起真实视图与 Element Plus），access/redirect 走真实实现。
const authState = {
  currentUser: null as CurrentUser | null,
  isAuthenticated: false,
  restoreSession: async () => {},
  sessionRestoreCompleted: true,
};

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => authState,
}));

const PageStub = { render: () => null };

const fixtureRoutes: RouteRecordRaw[] = [
  {
    component: PageStub,
    meta: { guestOnly: true, hideInMenu: true, title: "登录" },
    name: "Login",
    path: "/login",
  },
  {
    children: [
      {
        component: PageStub,
        meta: { order: 10, requiresAuth: true, title: "概览" },
        name: "Dashboard",
        path: "/dashboard",
      },
      {
        meta: { order: 60, requiresAuth: true, title: "系统管理" },
        name: "SystemManagement",
        path: "/system",
        redirect: "/system/users",
        children: [
          {
            component: PageStub,
            meta: { order: 10, permission: "system:user:view", title: "用户管理" },
            name: "SystemUsers",
            path: "users",
          },
          {
            component: PageStub,
            meta: { order: 30, permission: "system:role:view", title: "角色管理" },
            name: "SystemRoles",
            path: "roles",
          },
        ],
      },
    ],
    component: PageStub,
    meta: { hideInMenu: true, requiresAuth: true },
    path: "/",
    redirect: "/dashboard",
  },
  {
    component: PageStub,
    meta: { hideInMenu: true, requiresAuth: true, title: "无权限" },
    name: "Forbidden",
    path: "/403",
  },
];

function createUser(permissions: string[]): CurrentUser {
  return { id: 1, permissions, roles: ["user"], username: "tester" };
}

function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: fixtureRoutes,
  });

  setupRouterGuards(router);

  return router;
}

function signIn(permissions: string[] = []) {
  authState.isAuthenticated = true;
  authState.currentUser = createUser(permissions);
}

beforeEach(() => {
  authState.currentUser = null;
  authState.isAuthenticated = false;
  authState.restoreSession = async () => {};
  authState.sessionRestoreCompleted = true;
});

describe("setupRouterGuards", () => {
  it("会话恢复成功后放行目标页面", async () => {
    authState.sessionRestoreCompleted = false;
    const restoreSession = vi.fn(async () => {
      authState.sessionRestoreCompleted = true;
      signIn();
    });
    authState.restoreSession = restoreSession;

    const router = createTestRouter();
    await router.push("/dashboard");

    expect(restoreSession).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.path).toBe("/dashboard");
  });

  it("会话恢复失败后跳转登录页并携带回跳地址", async () => {
    authState.sessionRestoreCompleted = false;
    authState.restoreSession = async () => {
      authState.sessionRestoreCompleted = true;
    };

    const router = createTestRouter();
    await router.push("/dashboard");

    expect(router.currentRoute.value.path).toBe("/login");
    expect(router.currentRoute.value.query.redirect).toBe("/dashboard");
  });

  it("已登录用户访问登录页时跳转回跳目标", async () => {
    signIn();

    const router = createTestRouter();
    await router.push("/login?redirect=/dashboard");

    expect(router.currentRoute.value.path).toBe("/dashboard");
  });

  it("缺少权限码时跳转 403 并记录来源", async () => {
    signIn();

    const router = createTestRouter();
    await router.push("/system/users");

    expect(router.currentRoute.value.path).toBe("/403");
    expect(router.currentRoute.value.query.from).toBe("/system/users");
  });

  it("无权限用户访问 403 本身不会循环跳转", async () => {
    signIn();

    const router = createTestRouter();
    await router.push("/403");

    expect(router.currentRoute.value.path).toBe("/403");
  });

  it("分组 redirect 落点无权时改投第一个可访问子页", async () => {
    signIn(["system:role:view"]);

    const router = createTestRouter();
    await router.push("/system");

    expect(router.currentRoute.value.path).toBe("/system/roles");
  });

  it("分组内全部子页无权时仍进入 403", async () => {
    signIn();

    const router = createTestRouter();
    await router.push("/system");

    expect(router.currentRoute.value.path).toBe("/403");
    expect(router.currentRoute.value.query.from).toBe("/system/users");
  });
});
