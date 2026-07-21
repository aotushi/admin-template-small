# 登录请求全链路教学案例：从表单到 Session、Pinia 与路由

## 1. 这篇文档解决什么问题

登录表面上只是一个 `POST /api/auth/login`，但当前项目还要同时处理：

- Axios 统一请求；
- Access Token 只保存在页面内存；
- Refresh 凭证保存在 HttpOnly Cookie；
- 页面刷新后恢复会话；
- Access Token 过期后自动刷新并重放请求；
- 多标签页共享登录和退出状态；
- Pinia 向 Vue 组件、路由守卫和权限指令提供响应式登录状态。

这些能力被拆进多个文件后，最容易产生两个误解：

1. 把应用启动时的“对象装配”误当成一次登录的数据流；
2. 只追到模块变量 `session`，却找不到它如何进入 Pinia。

本文以普通用户 `jack` 登录为教学案例，只沿一条真实主线追踪数据：

```text
登录表单
  -> Pinia Colada mutation
  -> AuthSessionCoordinator.login
  -> loginApi
  -> HttpClient / Axios
  -> 后端登录响应
  -> saveAuthSession
  -> notifySessionListeners
  -> Pinia Auth Store
  -> Vue Router
  -> MainLayout / DashboardView
```

完成本文后，应能回答：

- `createHttpClientContext()` 为什么看起来有很多分支；
- 登录响应回到前端后，最先落在哪里；
- `authSessionStore.save` 实际调用哪个函数；
- 普通模块变量 `session` 为什么能长期保存在当前页面内存；
- `notifySessionListeners()` 如何把数据交给 Pinia；
- `publish()` 为什么不是当前标签页更新 Pinia 的主通道；
- 页面刷新后，Refresh Cookie 如何重新走回同一条保存链；
- 为什么路由跳转时 Pinia 已经是登录状态。

配套阅读：

- [登录接口为什么使用 mutation](login-mutation.md)
- [双 Token 会话机制教程](dual-token-session.md)
- [静态路由、守卫与 RBAC 菜单](../router/route-guard-rbac.md)
- [双 Token Axios 请求封装教程](../request/axios-pinia-colada.md)

## 2. 先把流程分成两个阶段

阅读这套代码最重要的技巧，是把“创建工具”和“使用工具”分开。

### 阶段 A：应用启动时装配工具

页面加载、模块首次导入时执行一次：

```text
createAdminHttpContext
  -> createHttpClientContext
  -> 创建 Axios 实例
  -> 安装请求/响应拦截器
  -> 创建 AuthSessionCoordinator
  -> 创建 HttpClient
  -> 返回 productionContext
```

这个阶段只决定：

```text
谁持有谁
谁以后调用谁
登录、刷新、退出共用哪个 Session Store
```

此时没有登录响应，`session.accessToken` 仍然是 `null`。

### 阶段 B：用户点击登录后传递数据

用户点击登录时，不会重新创建请求客户端，而是使用阶段 A 已经创建好的实例：

```text
authSessionCoordinator.login
  -> 执行 loginApi
  -> 等待 HTTP 响应
  -> 保存 Session
  -> 通知 Pinia
  -> 登录页执行路由跳转
```

后续调试时，如果已经确认 `requestClient` 和 `authSessionCoordinator` 是怎么创建的，就应返回登录调用处继续追 Promise，不要把每个装配参数都当成主线。

## 3. 文件地图

| 文件                                                                                         | 在本案例中的职责                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [`src/components/auth/AuthLoginForm.vue`](../../src/components/auth/AuthLoginForm.vue)       | 收集用户名、密码和验证码，向父组件发出 `submit`   |
| [`src/views/login/LoginView.vue`](../../src/views/login/LoginView.vue)                       | 校验表单、调用 mutation、提示结果、登录成功后跳转 |
| [`src/queries/auth.ts`](../../src/queries/auth.ts)                                           | 用 mutation 管理登录动作状态和成功后的缓存清理    |
| [`src/api/modules/auth.ts`](../../src/api/modules/auth.ts)                                   | 定义登录 API 的 URL、请求方法和类型               |
| [`src/api/request.ts`](../../src/api/request.ts)                                             | 项目的请求层组合根，导出稳定的客户端和会话协调器  |
| [`src/api/http/context.ts`](../../src/api/http/context.ts)                                   | 创建 Axios、拦截器、协调器和 `HttpClient`         |
| [`src/api/http/client.ts`](../../src/api/http/client.ts)                                     | 发送请求并统一剥离 `{ success, data }` 响应外壳   |
| [`src/api/http/interceptors.ts`](../../src/api/http/interceptors.ts)                         | 注入 Access Token、处理过期刷新与原请求重放       |
| [`src/api/http/auth-session-coordinator.ts`](../../src/api/http/auth-session-coordinator.ts) | 编排登录、刷新、退出、多标签页同步和竞态顺序      |
| [`src/api/session.ts`](../../src/api/session.ts)                                             | 保存当前标签页的内存 Session，并通知订阅者        |
| [`src/stores/auth.ts`](../../src/stores/auth.ts)                                             | 把内存 Session 镜像成 Vue/Pinia 响应式状态        |
| [`src/router/guards.ts`](../../src/router/guards.ts)                                         | 导航前恢复登录并检查页面访问权限                  |
| [`src/layouts/MainLayout.vue`](../../src/layouts/MainLayout.vue)                             | 根据当前用户过滤侧边栏并渲染子路由                |

## 4. 本案例中的登录响应

普通用户 `jack` 登录成功后，后端响应结构大致如下：

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expires": "2026-07-19T10:15:00.000Z",
    "sessionExpires": "2026-08-18T10:00:00.000Z",
    "tokenType": "Bearer",
    "user": {
      "id": 10,
      "username": "jack",
      "department_id": 3,
      "is_active": true,
      "roles": ["user"],
      "permissions": []
    }
  }
}
```

浏览器同时从响应头接收 Refresh 凭证 Cookie。它有三个特点：

- 不出现在上面的 JSON 中；
- JavaScript 因 `HttpOnly` 不能读取；
- 调用刷新接口时由浏览器自动携带。

本文主要追踪 JSON 中的 `data` 如何进入前端内存和 Pinia。

## 5. 阶段 A：应用启动时如何装配请求工具

### 5.1 `request.ts` 是组合根

[`src/api/request.ts`](../../src/api/request.ts) 的顶层代码会在模块首次导入时执行：

```ts
const productionContext = createAdminHttpContext(
  {},
  import.meta.env.MODE === "test"
    ? createNoopAuthTabChannel<AuthSessionResult>()
    : createBrowserAuthTabChannel<AuthSessionResult>(() => authSessionStore.getSession(), {
        channelName: "admin-backend-3-auth",
        lockName: "admin-backend-3-auth-session",
      }),
);
```

这里的“顶层代码”是指它不在另一个函数内部。ES Module 第一次被导入时，它就会创建 `productionContext`；之后其他文件再次导入时，会复用同一模块实例。

`createAdminHttpContext()` 把项目配置交给通用工厂：

```ts
export function createAdminHttpContext(
  axiosDefaults: CreateAxiosDefaults = {},
  tabChannel?: AuthTabChannel<AuthSessionResult>,
) {
  return createHttpClientContext<AuthSessionResult>({
    axiosDefaults: { baseURL: API_BASE_URL, ...axiosDefaults },
    tabChannel,
    errorClassifier: adminAuthErrorClassifier,
    getPreferredLanguage: getPreferredLocale,
    refreshUrl: REFRESH_SESSION_URL,
    sessionStore: authSessionStore,
  });
}
```

这里的 `sessionStore: authSessionStore` 是依赖注入：协调器只知道自己拿到一个符合 `AuthSessionStore` 接口的对象，不需要知道它具体如何保存数据。

### 5.2 `createHttpClientContext()` 返回两个核心实例

[`src/api/http/context.ts`](../../src/api/http/context.ts) 最后返回：

```ts
return {
  authSessionCoordinator,
  requestClient: new HttpClient(instance),
};
```

所以 `productionContext` 的形状是：

```ts
{
  authSessionCoordinator: AuthSessionCoordinator实例,
  requestClient: HttpClient实例,
}
```

`request.ts` 再提供两个稳定出口：

```ts
export const requestClient = productionContext.requestClient;
export const authSessionCoordinator = productionContext.authSessionCoordinator;
```

业务代码只需要导入这两个对象，不需要重复了解 Axios 的创建细节。

### 5.3 为什么这里看起来有很多分支

`createHttpClientContext()` 同时为下列场景做准备：

| 分支              | 何时使用                       |
| ----------------- | ------------------------------ |
| `requestClient`   | 登录和普通业务请求             |
| `requestRefresh`  | 页面恢复、主动刷新、401 后刷新 |
| `sessionStore`    | 读写当前标签页的内存 Session   |
| `tabChannel`      | 多标签页锁、广播和会话索取     |
| `errorClassifier` | 区分过期、失效和临时服务故障   |
| Axios 拦截器      | 请求前加 token、响应失败后恢复 |

这些是“可用能力”，不是一次登录都会沿着它们全部执行。

尤其要注意：

```ts
const requestRefresh = async () => {
  // ...
};
```

只是声明刷新函数。创建协调器时把函数引用交给它，不代表此时已经调用刷新接口。

## 6. 阶段 B：点击登录后的真实主线

### 6.1 表单组件只收集数据

`AuthLoginForm.vue` 使用 `v-model` 保存表单值，提交时向父组件发出事件：

```ts
function handleSubmit() {
  emit("submit", {
    password: form.password,
    username: form.username,
    verified: captchaPassed.value,
  });
}
```

它不直接调用 Axios，因为表单组件不负责路由跳转、全局错误提示和登录后的页面决策。

### 6.2 `LoginView` 调用 mutation

`LoginView.vue` 接收 `submit`，校验后执行：

```ts
await loginMutation.mutateAsync({
  password: payload.password,
  username: payload.username,
});
```

mutation 提供 `loading`、错误和成功回调；页面不需要自己维护一套重复的请求状态。

### 6.3 mutation 把“怎么登录”交给协调器

`useLoginMutation()` 的核心代码：

```ts
mutation: (payload) =>
  authSessionCoordinator.login(() => loginApi(payload)),
```

可以改写成更容易理解的形式：

```ts
const requestLogin = () => loginApi(payload);

return authSessionCoordinator.login(requestLogin);
```

传入的是函数，不是已经完成的请求结果。这样协调器可以先处理正在进行的刷新、登录锁和生命周期，再决定何时执行请求。

### 6.4 `login()` 真正调用登录 API

`AuthSessionCoordinator.login()` 中：

```ts
const result = await requestLogin();
this.acceptSession(result);
return result;
```

本次调用里的 `requestLogin` 就是：

```ts
() => loginApi(payload);
```

所以：

```ts
const result = await requestLogin();
```

等价于：

```ts
const result = await loginApi(payload);
```

这才是登录请求的数据主线。

### 6.5 `loginApi()` 描述 HTTP 请求

`src/api/modules/auth.ts`：

```ts
export function loginApi(payload: LoginPayload) {
  return requestClient.post<LoginResult, LoginPayload>("/api/auth/login", payload, {
    authMode: "none",
  });
}
```

`authMode: "none"` 表示登录请求不应携带旧 Access Token。

主调用链继续变成：

```text
loginApi
  -> requestClient.post
  -> HttpClient.request
  -> Axios instance.request
  -> 后端 /api/auth/login
```

### 6.6 `HttpClient` 剥离响应外壳

`HttpClient.request()`：

```ts
const response = await this.instance.request(config);
return unwrapApiResponse<T>(response);
```

Axios 收到的是完整响应：

```ts
{
  status: 200,
  headers: { /* ... */ },
  data: {
    success: true,
    data: { /* 登录结果 */ },
  },
}
```

`unwrapApiResponse()` 返回内部的 `data`。因此 `loginApi()` 最终解析成：

```ts
{
  accessToken: "eyJ...",
  expires: "...",
  sessionExpires: "...",
  tokenType: "Bearer",
  user: {
    username: "jack",
    role: "user",
    permissions: [],
  },
}
```

这个对象沿 Promise 原路返回：

```text
HttpClient.request
  -> requestClient.post
  -> loginApi
  -> requestLogin
  -> AuthSessionCoordinator.login 中的 result
```

## 7. 登录结果如何写入内存 Session

### 7.1 `acceptSession()` 调用抽象 Store

协调器得到 `result` 后执行：

```ts
private acceptSession(session: S) {
  this.store.save(session);
  this.publish({ session, type: "session-updated" });
}
```

构造协调器时传入的 `this.store` 就是 `authSessionStore`，所以：

```ts
this.store.save(result);
```

等价于：

```ts
authSessionStore.save(result);
```

### 7.2 对象属性保存的是函数引用

`session.ts` 定义：

```ts
export const authSessionStore: AuthSessionStore<AuthSessionResult> = {
  clear: clearAuthSession,
  getAccessToken,
  getAccessTokenRemainingMs,
  getRevision: getAuthSessionRevision,
  getSession: getAuthSessionResult,
  save: saveAuthSession,
};
```

其中：

```ts
save: saveAuthSession;
```

表示把函数引用放进 `save` 属性，并没有立即执行。以后调用：

```ts
authSessionStore.save(result);
```

实际就是：

```ts
saveAuthSession(result);
```

相同地：

```ts
getSession: getAuthSessionResult;
```

只是提供读取函数。`getSession()` 不会请求后端，也不会创建登录数据。

### 7.3 模块级 `session` 是当前标签页的私有内存盒子

`session.ts` 顶部先声明空状态：

```ts
let session: AuthSessionSnapshot = {
  accessToken: null,
  currentUser: null,
  expires: null,
  sessionExpires: null,
};
```

它不是函数局部变量。当前标签页加载这个 ES Module 后，这个模块实例会一直存在，直到页面刷新或关闭。

登录成功时：

```ts
export function saveAuthSession(result: LoginResult | TokenRefreshResult) {
  sessionRevision += 1;
  session = {
    accessToken: result.accessToken,
    currentUser: result.user,
    expires: result.expires,
    sessionExpires: result.sessionExpires,
  };
  removeLegacyAuthStorage();
  notifySessionListeners();
}
```

因此 `session` 从空盒子变成：

```ts
{
  accessToken: "eyJ...",
  currentUser: {
    username: "jack",
    role: "user",
    permissions: [],
  },
  expires: "...",
  sessionExpires: "...",
}
```

`sessionRevision` 用于协调器判断等待锁或异步操作期间 Session 是否已经被其他流程更新；它不是 Vue 响应式版本号。

## 8. 内存 Session 如何进入 Pinia

这是整条链中最容易漏掉的一步。`session.ts` 本身不是 Pinia，也不是 Vue 响应式对象；项目使用手动发布/订阅把它同步给 Pinia。

### 8.1 Pinia Store 先注册监听器

`stores/auth.ts` 创建 Store 时执行：

```ts
const initialSession = getAuthSessionSnapshot();
const accessToken = shallowRef<null | string>(initialSession.accessToken);
const currentUser = shallowRef(initialSession.currentUser);

subscribeAuthSession((nextSession) => {
  accessToken.value = nextSession.accessToken;
  currentUser.value = nextSession.currentUser;
  if (nextSession.accessToken) {
    sessionRestoreCompleted.value = true;
  }
});
```

`defineStore()` 只定义 Store；第一次调用 `useAuthStore()` 时才创建实例并执行上面的 setup。当前项目的路由守卫会调用 `useAuthStore()`，因此用户进入登录页时，这个监听器通常已经注册。

### 8.2 `subscribeAuthSession()` 保存回调

`session.ts` 中：

```ts
const listeners = new Set<AuthSessionListener>();

export function subscribeAuthSession(listener: AuthSessionListener) {
  listeners.add(listener);
  listener(session);

  return () => listeners.delete(listener);
}
```

执行后，可以把内存结构理解成：

```ts
listeners = new Set([
  (nextSession) => {
    accessToken.value = nextSession.accessToken;
    currentUser.value = nextSession.currentUser;
  },
]);
```

`listener(session)` 会在订阅时立即同步一次。这同时覆盖两种顺序：

| 顺序                         | 如何同步                                     |
| ---------------------------- | -------------------------------------------- |
| Pinia 先创建，之后登录       | 登录保存时由 `notifySessionListeners()` 更新 |
| Session 先保存，Pinia 后创建 | 订阅时立即执行 `listener(session)` 初始化    |

### 8.3 `notifySessionListeners()` 执行 Pinia 回调

`saveAuthSession()` 写完模块变量后调用：

```ts
function notifySessionListeners() {
  for (const listener of listeners) {
    listener(session);
  }
}
```

其中的 `listener` 就是 Pinia Store 注册的回调，因此实际效果是：

```ts
accessToken.value = session.accessToken;
currentUser.value = session.currentUser;
```

Pinia 状态由：

```ts
accessToken.value === null;
currentUser.value === null;
```

变成：

```ts
accessToken.value === "eyJ...";
currentUser.value ===
  {
    username: "jack",
    roles: ["user"],
    permissions: [],
  };
```

### 8.4 Vue 自动更新派生状态

Auth Store 中：

```ts
const isAuthenticated = computed(() => Boolean(accessToken.value));
const isSuper = computed(() => Boolean(currentUser.value?.roles?.includes("super")));
```

赋值后，Vue 自动把它们重新计算为：

```ts
isAuthenticated.value === true;
isSuper.value === false;
```

组件、路由守卫、菜单过滤和按钮权限指令随后都会读到新状态。

## 9. `publish()` 与 Pinia 的关系

`acceptSession()` 中的两行服务于不同范围：

```ts
this.store.save(session);
this.publish({ session, type: "session-updated" });
```

### 当前标签页

```text
store.save
  -> saveAuthSession
  -> notifySessionListeners
  -> 当前标签页 Pinia 更新
```

### 其他标签页

```text
publish(session-updated)
  -> 浏览器跨标签页通道
  -> 其他标签页的 coordinator 收到事件
  -> 其他标签页执行 store.save(event.session)
  -> 其他标签页 notifySessionListeners
  -> 其他标签页 Pinia 更新
```

每个标签页都有独立的 JavaScript 内存、模块 `session` 和 Pinia Store。`publish()` 的职责是跨越这个边界；它不是当前标签页更新 Pinia 的主通道。

## 10. 为什么路由跳转时 Pinia 已经更新

`LoginView` 的顺序：

```ts
await loginMutation.mutateAsync(payload);
ElMessage.success(labels.value.loginSuccess);
await router.replace(resolvePostLoginRedirect(route.query.redirect));
```

而 mutation 内部必须等协调器完成：

```text
等待 HTTP 响应
  -> acceptSession
  -> store.save
  -> notifySessionListeners
  -> Pinia 更新
  -> coordinator.login 返回
  -> mutation onSuccess 清理旧账号的私有查询缓存
  -> mutateAsync 完成
  -> LoginView 执行 router.replace
```

因此路由守卫检查新页面时：

```ts
authStore.isAuthenticated === true;
authStore.currentUser.username === "jack";
```

不会把用户重新送回登录页。

## 11. 普通 user 登录后的路由渲染

默认普通用户得到：

```ts
currentUser = {
  roles: ["user"],
  permissions: [],
};
```

`router.replace("/dashboard")` 后，路由守卫按匹配记录逐层检查：

```text
根布局 /：requiresAuth，已经登录，放行
Dashboard：无权限码声明，登录即可访问，放行
```

然后组件树变成：

```text
App.vue
  -> MainLayout.vue
     -> AdminSidebar.vue
     -> AdminTopbar.vue
     -> RouterView
        -> DashboardView.vue
```

`MainLayout` 使用：

```ts
const menus = computed(() => createMenuItems(appRoutes, authStore.currentUser));
```

从前端静态路由中过滤菜单：

```text
概览：允许 super/admin/user，保留
公共组件：无额外角色限制，保留
系统管理：只允许 super/admin，删除整组
```

这里没有请求后端菜单树；当前侧边栏来自静态 `appRoutes`，后端下发的 `permissions` 负责细粒度页面和按钮权限。

## 12. 页面刷新时如何复用同一保存链

按 F5 后，当前标签页 JavaScript 重新启动，模块内存清空：

```ts
session.accessToken === null;
```

但浏览器仍持有 HttpOnly Refresh Cookie。路由守卫进入受保护页面前调用：

```ts
await authStore.restoreSession();
```

后续主线：

```text
restoreSession
  -> authSessionCoordinator.refresh("restore")
  -> context.ts 中预先声明的 requestRefresh
  -> POST /api/auth/refresh
  -> 浏览器自动携带 HttpOnly Cookie
  -> 后端返回新 accessToken + 最新 user.permissions
  -> acceptSession
  -> store.save
  -> saveAuthSession
  -> notifySessionListeners
  -> Pinia 恢复
  -> 路由守卫继续导航
```

登录和刷新虽然请求地址不同，但响应进入前端后共用同一个 `acceptSession -> saveAuthSession -> Pinia` 保存出口。

## 13. Access Token 过期时的旁支

普通业务请求默认使用 `authMode: "required"`。请求拦截器会：

```text
读取 authSessionStore.getAccessToken()
  -> 添加 Authorization: Bearer <accessToken>
```

如果 token 即将过期，会尝试主动 refresh；如果后端返回明确的 `ACCESS_TOKEN_EXPIRED`，响应拦截器会：

```text
协调一次 refresh
  -> 保存新 Session
  -> 给原请求换上新 token
  -> 原请求最多重放一次
```

这条旁支解释了为什么 `createHttpClientContext()` 需要 `requestRefresh` 和拦截器，但它不属于首次登录请求的主调用链。

## 14. 主线与旁支速查

| 代码或能力                       | 首次登录主线                   | 说明                         |
| -------------------------------- | ------------------------------ | ---------------------------- |
| `authSessionCoordinator.login()` | 是                             | 编排并保存登录结果           |
| `loginApi()`                     | 是                             | 发送登录请求                 |
| `HttpClient.request()`           | 是                             | 调用 Axios 并剥离响应外壳    |
| `store.save()`                   | 是                             | 写入当前标签页 Session       |
| `notifySessionListeners()`       | 是                             | 把 Session 同步给 Pinia      |
| `publish()`                      | 登录后执行，但属于跨标签页支线 | 通知其他标签页               |
| `getSession()`                   | 不是写入主线                   | 读取已有 Session，不创建数据 |
| `requestRefresh()`               | 否                             | 页面恢复或 token 刷新时使用  |
| `requestPeerSession()`           | 通常否                         | 向其他标签页索取可用 Session |
| 401 重放                         | 否                             | 受保护请求 token 过期时使用  |

## 15. 推荐断点顺序

不要从 `createHttpClientContext()` 单步进入每个配置分支。完成一次装配认知后，按下面顺序打断点：

1. `queries/auth.ts`

   ```ts
   authSessionCoordinator.login(() => loginApi(payload));
   ```

2. `auth-session-coordinator.ts`

   ```ts
   const result = await requestLogin();
   ```

   请求回来后重点观察 `result`。

3. `client.ts`

   ```ts
   const response = await this.instance.request(...);
   ```

   对比 `response.data` 和 `unwrapApiResponse()` 的返回值。

4. `auth-session-coordinator.ts`

   ```ts
   this.acceptSession(result);
   ```

5. `session.ts`

   ```ts
   session = {
     accessToken: result.accessToken,
     currentUser: result.user,
     // ...
   };
   ```

6. `session.ts`

   ```ts
   listener(session);
   ```

   观察 `listeners.size`，正常情况下至少有 Pinia 注册的监听器。

7. `stores/auth.ts`

   ```ts
   accessToken.value = nextSession.accessToken;
   currentUser.value = nextSession.currentUser;
   ```

8. `LoginView.vue`

   ```ts
   await router.replace(...);
   ```

建议在调试器 Watch 面板依次观察：

```text
result.accessToken
result.user
session.accessToken
session.currentUser
listeners.size
accessToken.value
currentUser.value
isAuthenticated.value
isSuper.value
```

## 16. 常见误区

### 误区 1：`createHttpClientContext()` 是每次登录都会重新执行

不是。生产环境的 `productionContext` 在模块首次导入时创建，登录只是使用其中的实例。

### 误区 2：进入 `getSession()` 就能找到登录数据来源

`getSession()` 只是读取当前盒子。数据来源要沿 `store.save -> saveAuthSession(result)` 反向追踪。

### 误区 3：模块中的 `session` 只有声明，没有获取数据

声明只是初始值。异步登录完成后，`saveAuthSession(result)` 会重新赋值；ES Module 实例在当前页面生命周期内持续存在。

### 误区 4：`publish()` 把数据交给当前 Pinia

当前 Pinia 由 `notifySessionListeners()` 更新；`publish()` 主要把变化广播给其他标签页。

### 误区 5：Pinia 自动观察普通模块变量

不会。`session` 不是响应式对象，必须通过订阅回调显式写入 `shallowRef`。

### 误区 6：Refresh Token 在登录 JSON 里

当前实现返回 Access Token 和用户快照；Refresh 凭证由响应设置为 HttpOnly Cookie，JavaScript 不可读取。

## 17. 一页式总复习

### 应用启动

```text
request.ts 首次导入
  -> createAdminHttpContext
  -> createHttpClientContext
  -> 创建 Axios + 拦截器
  -> 创建 AuthSessionCoordinator
  -> 创建 HttpClient
  -> 导出 requestClient / authSessionCoordinator
```

### 用户登录

```text
AuthLoginForm emit submit
  -> LoginView mutateAsync
  -> coordinator.login(() => loginApi(payload))
  -> loginApi
  -> requestClient.post
  -> Axios
  -> 后端返回 accessToken + user.permissions
  -> unwrapApiResponse
  -> coordinator 得到 result
  -> store.save(result)
  -> saveAuthSession(result)
  -> 模块 session 更新
  -> notifySessionListeners
  -> Pinia accessToken/currentUser 更新
  -> isAuthenticated/isSuper 自动重算
  -> mutation 清理旧私有缓存
  -> LoginView router.replace
  -> 路由守卫放行
  -> MainLayout 和目标页面渲染
```

### 页面刷新

```text
内存 accessToken 消失
  -> 路由守卫 restoreSession
  -> POST /api/auth/refresh
  -> 浏览器自动携带 HttpOnly Refresh Cookie
  -> 后端重新计算权限并返回新 Session
  -> 复用 saveAuthSession -> Pinia 的保存链
  -> 继续目标路由
```

### 最短复述

> 应用启动时，`createHttpClientContext()` 只负责创建并连接 Axios 客户端、会话协调器和内存 Session Store。点击登录后，协调器才调用 `loginApi()`；响应返回后执行 `authSessionStore.save()`，它实际指向 `saveAuthSession()`。该函数把 Access Token 和用户快照写入模块级 `session`，再通过 `notifySessionListeners()` 执行 Pinia 预先注册的回调。Pinia 更新后，登录页才执行路由跳转。`publish()` 用于通知其他标签页；页面刷新时则由 HttpOnly Refresh Cookie 获取新 Session，并复用同一条保存链。
