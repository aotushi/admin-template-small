# 双 Token Axios 请求封装教程：从一个 401 开始，逐步构建可复用请求套件

本教程按"问题 → 解决"的顺序推进：从最小的请求客户端开始，每一步只引入上一步暴露的新问题所需要的代码，从上到下读一遍就能理解全部设计；最后一步才把它抽象成可以直接拷走的套件。

配套阅读：认证侧的设计依据（凭证为什么这样存放、错误码契约、服务端轮换与重放防护）见姊妹篇[双 Token 会话机制教程](../auth/dual-token-session.md)，本文只讲前端请求层。

## 我们要解决的问题

双 token 模型只需要先知道两句话：**access token 存页面内存，有效期 15 分钟，随请求头发送；refresh 凭证存 HttpOnly Cookie，脚本读不到，浏览器调刷新接口时自动携带。** 由此产生的请求层问题就是本文的目录：

| 步骤 | 问题                                                   |
| ---- | ------------------------------------------------------ |
| 1    | 怎么发请求，怎么统一处理响应外壳和各种错误             |
| 2    | 怎么给请求带上 access token，哪些请求不能带            |
| 3    | token 过期收到 401 怎么刷新并重放，哪种 401 才允许刷新 |
| 4    | 十个请求同时过期，怎么保证只刷新一次                   |
| 5    | 刷新进行中用户退出登录，怎么不让晚到的刷新结果复活会话 |
| 6    | 多个标签页同时刷新，怎么不触发服务端重放检测           |
| 7    | 怎么在过期前主动换新，而不是每次都等 401               |
| 8    | 怎么把以上机制抽成零项目依赖、可直接复用的套件         |

## 步骤 1：最小客户端——统一出口

一切从一个普通的 axios 实例开始。先解决最基础的重复劳动：每个接口都要写响应解包和错误处理。

**响应剥壳**（`response.ts`）：后端返回 `{ success: true, data }` 成功外壳、`{ success: false, code, error }` 错误外壳或裸数据三种形态。`unwrapApiResponse` 统一剥壳，业务代码永远直接拿到 `data`。

**错误归一化**（`errors.ts`）：业务失败、HTTP 错误、断网、超时、请求取消统一转换为 `ApiError`，携带 `kind`（`business` / `http` / `network` / `timeout` / `cancel`）和稳定 `code`。后面的步骤会反复用到"按 code 分类"这个能力。

**方法收敛**（`client.ts` 的 `HttpClient` 类）：`get` / `post` / `put` / `patch` / `delete` / `head` / `options` 七个方法全部落到一个 `request()`，剥壳只发生在这一处：

```ts
class HttpClient {
  constructor(private readonly instance: AxiosInstance) {}

  async request<T, D = unknown>(config: RequestConfig<D>): Promise<T> {
    const response = await this.instance.request(config);
    return unwrapApiResponse<T>(response);
  }
  // get/post/put/patch/delete/head/options 全部委托给 request()
}
```

默认配置只有三件事（`config.ts`）：JSON 请求头、15 秒超时、`withCredentials`（跨端口开发时携带 refresh Cookie 必需）。`baseURL` 不在这里写死，原因到步骤 8 会清楚。

## 步骤 2：给请求带上 token——请求策略

access token 在内存里，需要一个请求拦截器把它写进 `Authorization` 头。但**不是所有请求都该带**：登录、刷新、退出这三个接口带上过期 token 反而有害（刷新接口收到过期 token 返回 401，又触发刷新，就是死循环）。

判断"这是不是认证接口"最常见的写法是比较 URL 字符串，脆弱且藏在拦截器深处。这里改为让**每个请求自己声明策略**：

```ts
type RequestAuthMode = "none" | "optional" | "required";

// 业务接口默认 required；登录、刷新和退出必须显式使用 none
requestClient.post("/api/auth/login", payload, { authMode: "none" });
```

请求拦截器据此工作：`none` 主动删除 `Authorization` 头；其余情况有 token 就注入。注入时同时把 token 记到 `config._sentAccessToken` 上——现在看是多余的，步骤 3 立刻用到。

## 步骤 3：401 之后——刷新并重放，但只认"过期"

token 过期后请求收到 401。响应拦截器的直觉写法是"见 401 就刷新重试"，这是**本方案否定的第一个直觉**：401 只表示"未通过认证"，token 被篡改、账号被停用、根本没带 token、登录密码错误都返回 401，它们刷新后要么无法恢复、要么根本不该恢复。

所以刷新的准入条件是一组，而不是一个（完整审计见[姊妹篇](../auth/dual-token-session.md#刷新判断审计)）：

```ts
const canRecover =
  errorClassifier.isAccessTokenExpired(status, errorCode) && // 后端明确说"是过期"
  authMode === "required" && // 请求声明为受保护
  sentAccessToken && // 确实发送过 token
  coordinator.canRefresh(); // 没有正在退出 / 切换账号
```

本项目后端为过期专门返回 `401 + code: "ACCESS_TOKEN_EXPIRED"`，其它 401 各有稳定错误码。满足条件后的恢复流程有三个关键细节：

**① 每个请求最多重放一次。** `_authRetryCount` 标记后再失败只上抛，杜绝循环。重放后仍然过期也不直接清会话——是否终结由终止型错误码统一判定，避免服务端时钟抖动误杀刚刷新成功的会话。

**② 迟到的 401 不再刷新。** 多个请求可能都带着旧 token 出发，第一个刷新成功后，其它旧请求的 401 才陆续到达。此时比较"该请求实际发送的 token"（步骤 2 记录的 `_sentAccessToken`）和"当前内存 token"：

```ts
const currentAccessToken = sessionStore.getAccessToken();
if (currentAccessToken && currentAccessToken !== sentAccessToken) {
  // 别人已经刷新成功：直接用新 token 重放，不再触发第二次刷新
  setAccessToken(originalConfig, currentAccessToken);
  return client.request(originalConfig);
}
```

**③ 走不到恢复分支的认证失败分两类。** 终止型（refresh 过期 / 撤销 / 重放、账号停用等）结束本地会话；暂时型（断网、超时、429、5xx）保留会话让用户可重试。分类标准不写死在拦截器里——这是步骤 8 契约化的伏笔。

## 步骤 4：并发过期——刷新单飞

页面切换时十个请求同时发出、同时收到过期 401，步骤 3 的逻辑会触发十次刷新。而后端每次刷新都轮换凭证，旧凭证再次使用会被当作重放攻击撤销整组会话——**并发刷新不是浪费，是事故**。

解法是把"执行刷新"从拦截器抽出来，交给一个协调器（`auth-session-coordinator.ts`），核心是共享 Promise：

```ts
refresh(reason): Promise<S> {
  if (this.refreshPromise) return this.refreshPromise; // 单飞：所有并发调用共用一次刷新
  this.refreshPromise = this.doRefresh().finally(() => {
    this.refreshPromise = null;
  });
  return this.refreshPromise;
}
```

十个 401 都 `await` 同一个 Promise，刷新只发生一次，各自拿新 token 重放一次。

## 步骤 5：刷新与退出竞态——lifecycle 代次

新问题：刷新请求在途时用户点了退出。退出清空了本地状态，随后刷新响应到达，把新会话写回内存——用户以为退出了，实际还在登录态。

协调器用**代次（lifecycle）**解决：`login()` / `logout()` 开始时递增 `lifecycle`，进行中的刷新在每个异步间隙核对代次，发现已变就抛弃自己的结果：

```ts
const lifecycle = this.lifecycle; // 刷新开始时记下代次
// ... await 刷新接口 ...
if (lifecycle !== this.lifecycle) {
  throw transitionError(); // 期间发生过退出 / 登录，本次结果作废
}
this.store.save(result);
```

`logout()` 的完整顺序是：递增代次 → 等待在途刷新收敛（忽略其结果）→ 调后端撤销会话家族 → 清空本地。账号切换（登录）走同一套保护，避免旧账号的刷新结果覆盖新账号。

这也解释了步骤 3 准入条件里的 `coordinator.canRefresh()`：退出或登录过渡期间，拒绝发起任何新刷新。

## 步骤 6：多标签页——锁、广播与会话索取

refresh Cookie 被同源标签页共享，但步骤 4 的单飞 Promise 只存在于单个标签页内。两个标签页同时刷新，第二个用的还是已被轮换的旧凭证——又撞上服务端重放检测。

跨标签页协调（`auth-coordination.ts`）补三样东西：

- **互斥**：`navigator.locks.request(lockName, { mode: "exclusive" }, task)` 保证同一时刻全浏览器只有一个标签页在刷新。
- **广播**：`BroadcastChannel` 传递 `session-updated` / `session-ended` 事件，其它标签页直接采用新会话或同步退出。事件带 `sentAt` 时间戳和发布方 `sourceId`：旧事件丢弃，同毫秒但不同发布方的事件按到达顺序应用。
- **会话索取**：拿到锁的标签页先问一圈"谁有现成的会话"，有就直接用，没有才真正调刷新接口。

索取环节有两个容易忽略的细节：

1. **存在感握手**。标签页启动广播 `hello`，已有标签页回 `present`，关闭时发 `bye`。没有已知 peer 时索取立即返回 `null`——否则每次单标签页冷启动都要白等一个固定超时。
2. **peer 会话新鲜度门槛**。索取到的会话若 access token 剩余不足 30 秒，放弃采纳、自己刷新，避免拿到临过期 token 后立刻再刷一轮。

于是步骤 4 的刷新流程完整版是：**拿锁 → 查本地会话是否已被别人更新（靠存储 revision 比较）→ 向 peer 索取 → 都不行才调刷新接口**。环境缺少 Web Locks（部分 WebView）时打印一次警告退化为无互斥，兜底交给服务端的 60 秒轮换宽限期（见姊妹篇）。

## 步骤 7：主动刷新——别等 401

到这里被动恢复已经完备，但体验上每 15 分钟总有一个请求要经历"发出 → 401 → 刷新 → 重放"的完整往返。请求拦截器加一个前置检查即可：

```ts
if (
  authMode === "required" &&
  coordinator.canRefresh() &&
  sessionStore.getAccessToken() &&
  sessionStore.getAccessTokenRemainingMs() <= proactiveRefreshWindowMs // 默认 30 秒
) {
  await coordinator.refresh("proactive"); // 走的还是步骤 4-6 的同一套单飞 + 锁
}
```

主动刷新失败但旧 token 还没真正过期时放行请求，交给响应侧兜底。两层各司其职：主动刷新优化正常路径，被动恢复兜住时钟偏差、页面休眠和网络延迟。

## 步骤 8：抽成套件——三个契约与组合根

回看前七步，代码里只有三处内容是"每个项目不一样的"：

1. 会话对象里有什么字段、存在哪（步骤 2、6 反复读写它）；
2. 哪个错误码算"过期"、哪些算"终止型"（步骤 3 的分类）；
3. `baseURL`、刷新接口地址这类环境配置。

把这三处抽成注入契约，其余全部机制就成了零项目依赖的套件（`src/api/http/`，唯一依赖 `axios`）：

```ts
/** 契约 1：会话最小形状。宿主可带任意额外字段（如用户快照），套件原样透传。 */
interface AuthSession {
  accessToken: string;
  expires: string; // access token 过期时间，主动刷新窗口的依据
  sessionExpires: string; // refresh 会话过期时间，peer 新鲜度判断的依据
}

/** 契约 2：会话存储。套件只读写这六个方法，不关心介质是内存还是 Pinia。 */
interface AuthSessionStore<S extends AuthSession> {
  clear(): void;
  getAccessToken(): null | string;
  getAccessTokenRemainingMs(): number; // 无 token 时返回负数
  getRevision(): number; // 每次写入 / 清空递增，供步骤 6 锁后比较
  getSession(): null | S; // 可分享给其它标签页的完整会话
  save(session: S): void;
}

/** 契约 3：错误分类。套件不内置任何错误码字符串。 */
interface AuthErrorClassifier {
  isAccessTokenExpired(status: number | undefined, code: unknown): boolean;
  isTerminalAuthError(code: unknown): boolean;
}
```

工厂函数 `createHttpClientContext`（`context.ts`）接收三个契约的实现，内部创建 axios 实例、装协调器、装拦截器，返回 `{ requestClient, authSessionCoordinator }`。**套件里没有任何单例**——实例化是宿主项目的事。

### 组合根：request.ts 在做什么（以及为什么它"看起来又创建了一次"）

`src/api/request.ts` 是本项目唯一的装配点。容易误读的一点：**axios 实例自始至终只在套件工厂里创建一次**，request.ts 没有再创建实例，它只是调用工厂拿到产物。它的三段结构各有明确职责：

```ts
// ① 项目决策：错误码契约的具体实现
const adminAuthErrorClassifier: AuthErrorClassifier = {
  isAccessTokenExpired: (status, code) =>
    status === 401 && code === AUTH_ERROR_CODES.accessTokenExpired,
  isTerminalAuthError: (code) => isTerminalAuthErrorCode(code),
};

// ② 项目工厂：把项目决策和套件工厂绑定。
//    这层存在的唯一理由是测试——spec 用同样的装配注入假网络适配器，
//    获得互不干扰的隔离实例，而不必复制装配代码或 mock 内部模块。
export function createAdminHttpContext(axiosDefaults = {}, coordination?) {
  return createHttpClientContext<AuthSessionResult>({
    axiosDefaults: { baseURL: API_BASE_URL, ...axiosDefaults },
    coordination,
    errorClassifier: adminAuthErrorClassifier,
    getPreferredLanguage: getPreferredLocale,
    refreshUrl: "/api/auth/refresh",
    sessionStore: authSessionStore, // 来自 src/api/session.ts 的内存适配器
  });
}

// ③ 生产实例：应用运行期的唯一一次调用
const productionContext = createAdminHttpContext(
  {},
  import.meta.env.MODE === "test"
    ? createNoopAuthCoordination() // 测试 / SSR：无锁无广播
    : createBrowserAuthCoordination(() => authSessionStore.getSession(), {
        channelName: "admin-backend-3-auth",
        lockName: "admin-backend-3-auth-session",
      }),
);

export const requestClient = productionContext.requestClient;
export const authSessionCoordinator = productionContext.authSessionCoordinator;
```

会话存储的项目实现同样简单——`src/api/session.ts` 把已有的内存读写函数打包成契约对象：

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

## 最终文件地图

问题都解决完了，再看全景就不会迷路——每个文件对应前面的一或两个步骤：

```text
src/api/http/          可复用套件（零项目依赖）
  ├── types.ts             步骤 2、8：请求策略 + 三个注入契约
  ├── config.ts            步骤 1：默认 Axios 配置
  ├── errors.ts            步骤 1：错误归一化为 ApiError
  ├── response.ts          步骤 1：响应剥壳
  ├── interceptors.ts      步骤 2、3、7：token 注入、精确 401 恢复、主动刷新
  ├── auth-session-coordinator.ts  步骤 4、5：刷新单飞、登录 / 退出竞态
  ├── auth-coordination.ts         步骤 6：Web Locks + BroadcastChannel 跨标签页协调
  ├── client.ts            步骤 1：HttpClient 七种方法收敛 + 剥壳（不感知会话）
  ├── context.ts           步骤 8：createHttpClientContext 工厂（套件内组装线）
  └── index.ts             公开出口（只有工厂和类型，没有单例）

src/api/request.ts     步骤 8：本项目装配点（组合根）
src/api/session.ts     步骤 8：内存会话 + AuthSessionStore 适配器
src/api/types.ts       项目侧类型（会话结果、登录载荷等）

src/api/modules/       业务端点层：解决"发什么请求"，随功能增长
  ├── auth.ts              登录、退出、用户资料
  └── users.ts             用户列表、部门树
```

`api/` 根目录只放"一次写好很少动"的基建（套件、组合根、注入物），`modules/` 里按后端资源一文件一模块，全部从 `@/api/request` 引入 `requestClient`。

判断某段代码放在哪一侧的标准只有一条：**它是不是所有项目都一样？** 拦截顺序、单飞刷新、跨页协调是通用机制，放套件；错误码取值、接口地址、会话里带什么字段是项目决策，放装配点。

### 背景：为什么实例创建在 context.ts，而不是 client.ts

一个自然的疑问：axios 实例的创建不是应该离 `config.ts` 和封装方法最近吗？大多数教程也确实是一个文件写完的：

```ts
// 常见一体式写法：创建实例、装拦截器、导出，一个文件搞定
const instance = axios.create({ baseURL: "/admin", timeout: 15000 });

instance.interceptors.request.use((config) => {
  const userStore = useUserStore(); // 关键：拦截器自己 import 全局单例
  config.headers.Authorization = `Bearer ${userStore.token}`;
  return config;
});

export default instance;
```

这种写法成立的隐藏前提是：**拦截器需要的东西都是自己伸手去全局拿的**。此时拦截器确实只是"一种配置"，跟实例放一起天经地义。代价是拦截器焊死了全局单例——无法注入假实现做测试、无法创建第二个隔离实例、无法拷去别的项目。

本套件为了步骤 8 的三个契约放弃了这个前提：拦截器需要的 `coordinator` / `sessionStore` / `errorClassifier` 全部**由外部注入**，而且存在一条环形装配链——拦截器需要 coordinator，coordinator 需要 `requestRefresh`，`requestRefresh` 又需要实例本身。于是实例有三个消费方，创建点必须在三者交汇处：

```text
const instance = axios.create(createHttpConfig(...))   ← context.ts（组装线）
        │
        ├─→ requestRefresh 闭包        刷新请求复用同一实例
        ├─→ installHttpInterceptors    拦截器装在这个实例上
        └─→ new HttpClient(instance)   七方法收敛只是消费方之一
```

如果坚持把创建挪回 client.ts，它就必须先构造 coordinator、接收 sessionStore 和 errorClassifier——写完会发现那就是 `createHttpClientContext` 本身，只是换了文件名，client.ts 重新变回"工厂 + 传输类"的双职责文件。

归纳：**拦截器是不是配置，取决于它的依赖从哪来。** 自己 import 全局单例 → 是配置，可与实例同文件（简单项目推荐，文件少直觉顺）；依赖被注入 → 是待装配的部件，装配代码必然存在于某个文件，那个文件就是工厂。`HttpClient` 通过构造函数接收实例而不自己创建，正是组合根原则在套件内部的缩影：创建发生在组装点，使用方只接收产物——也因此 client.ts 才能做到"读它零前置知识"。

## 在新项目中复用（清单）

1. 拷贝 `src/api/http/` 整个目录。目录内的 `*.spec.ts` 建议一并带走：它们和套件一样零项目依赖，拷过去就能跑，是现成的回归保护和环境验收；不需要时删除也不影响运行。
2. 实现自己的 `AuthSessionStore`：任何满足六个方法的对象即可（内存、Pinia、Zustand 均可）。
3. 实现自己的 `AuthErrorClassifier`：把后端的"过期"与"终止"信号映射进来。
4. 在组合根调用 `createHttpClientContext` 并导出返回值；登录退出走 `authSessionCoordinator.login()` / `logout()`。
5. 需要多标签页协调时传 `createBrowserAuthCoordination(readSession, { channelName, lockName })`，每个项目用独立的频道名和锁名；测试或 SSR 传 `createNoopAuthCoordination()`。

后端需要满足的契约：access token 过期返回可被 `isAccessTokenExpired` 识别的稳定信号；刷新接口用 HttpOnly Cookie 换新会话；响应体可被剥壳（`{ success, data }`、错误外壳或裸数据三者之一）。

## 一次请求的完整执行顺序（总复习）

```text
业务 API 函数
  -> HttpClient.get/post/...
  -> 请求拦截器
       1. 读取 none / optional / required 请求策略        （步骤 2）
       2. token 剩余不足 30 秒时主动进入共享刷新           （步骤 7）
       3. 注入 Authorization，记录 _sentAccessToken        （步骤 2）
  -> Axios 发送请求（浏览器自动携带 HttpOnly refresh Cookie）
  -> 响应拦截器
       1. 成功响应直接交回
       2. 只接受 errorClassifier 判定的"已过期"            （步骤 3）
       3. 迟到的旧 token 响应直接复用当前 token             （步骤 3）
       4. 同页并发和其它标签页复用同一次刷新                （步骤 4、6）
       5. 终止型失败结束会话，暂时型保留可恢复状态          （步骤 3、5）
       6. 所有失败统一转换为 ApiError                       （步骤 1）
  -> 剥离响应外壳                                           （步骤 1）
  -> 页面或查询层得到业务数据
```

## 测试策略

| 测试文件                                        | 覆盖内容                                                    |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `src/api/request.spec.ts`                       | 头部注入、公开接口、错误外壳、并发刷新、迟到 401、故障分流  |
| `src/api/http/auth-session-coordinator.spec.ts` | 跨上下文单飞、peer 会话复用与新鲜度、事件去重、登录退出竞态 |
| `src/api/http/auth-coordination.spec.ts`        | 标签页存在感握手、单页免等待、peer 离场、事件广播不回投     |

测试通过 `createAdminHttpContext({ adapter })` 注入假网络适配器获得隔离客户端，不需要 mock 内部模块——这是"工厂无单例"设计的直接收益。

---

## 附录 A：请求层之上——与 Pinia Colada 的分工

本文的套件只负责"怎么发请求"。请求结果在页面上的 loading、缓存、失效、去重属于**服务端状态管理**，由 Pinia Colada 承担，两层不重叠：

| 层级         | 工具         | 当前文件           | 职责                                     |
| ------------ | ------------ | ------------------ | ---------------------------------------- |
| HTTP 传输层  | Axios 套件   | `src/api/http`     | 本文全部内容                             |
| API 函数层   | 普通函数     | `src/api/modules/` | 按业务接口封装登录、退出、用户列表等函数 |
| 服务端状态层 | Pinia Colada | `src/queries/*`    | query/mutation 状态、缓存、刷新、失效    |

Pinia Colada 不保存 token；登录和刷新会改变会话，属于 mutation，用户列表等可重复读取的数据才用 query 缓存。项目内约定：发请求只在 `src/api/*`，读数据建 query、提交动作建 mutation 都在 `src/queries/*`，mutation 成功后失效相关 query key。

## 附录 B：没有直接照搬的常见写法

| 常见写法                   | 当前项目处理                                                    |
| -------------------------- | --------------------------------------------------------------- |
| Token 存 `localStorage`    | 不采用；access token 留在内存，refresh 凭证留在 HttpOnly Cookie |
| refresh token 放请求体     | 不采用；浏览器自动携带 Cookie                                   |
| 见 401 就刷新              | 不采用；只认后端稳定错误码 `ACCESS_TOKEN_EXPIRED`（步骤 3）     |
| 用 URL 判断认证接口        | 不采用；请求显式声明 `authMode`（步骤 2）                       |
| 实例 + 拦截器一个文件写完  | 不采用；拦截器依赖为注入式，创建点在组装线（文件地图·背景）     |
| Axios 管接口缓存和查询去重 | 不重复实现；由 Pinia Colada 管服务端状态（附录 A）              |
| 全局 loading / UI 提示     | 不放传输层；由页面按 query/mutation 状态和统一错误自行决定      |
| 所有失败自动重试           | 不加入；写请求不能默认重试，读取请求按实际接口策略决定          |

## 附录 C：方案比较

| 方案                   | 优点                                            | 缺点                                                | 当前项目结论                     |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------- | -------------------------------- |
| 原生 fetch             | 浏览器内置、依赖少                              | 拦截器、错误归一化、超时、自动刷新都要手写          | 不适合当前后台管理学习主线       |
| 只用 Axios             | 请求封装清晰，拦截器成熟                        | 不解决服务端状态缓存、失效、去重                    | 作为底层传输层保留               |
| Axios + Pinia          | 容易理解，所有状态都进 store                    | store 容易混入 loading/error/cache 等临时服务端状态 | 不作为主方案，Pinia 只管本地状态 |
| Axios + Pinia Colada   | Vue / Pinia 生态内自然，query/mutation 边界清晰 | 需要先理解 query key、mutation、失效机制            | 当前采用                         |
| Axios + TanStack Query | 能力强，生态成熟，跨框架经验多                  | 对当前 Vue + Pinia 学习项目来说概念稍重             | 可作为后续对照学习               |
