# 双 Token 会话机制教程：内存 Access Token + HttpOnly Refresh Cookie 的安全轮换实践

本文是[双 Token Axios 请求封装教程](../request/axios-pinia-colada.md)的姊妹篇：请求层教程讲"怎么封装"，本文讲清认证侧的完整设计——凭证放在哪里、什么信号才允许自动刷新、并发与竞态如何治理、服务端轮换与重放防护如何兜底。读完可以独立评审或复刻一套同等安全边界的双 Token 会话方案。

## 目标

当前项目采用“短期访问凭证 + 长期刷新会话”，但不再把两个凭证都交给前端脚本保存。

| 内容         | 保存位置                      | 有效期                | 前端脚本能否读取 |
| ------------ | ----------------------------- | --------------------- | ---------------- |
| access token | 页面运行内存                  | 15 分钟               | 能               |
| refresh 凭证 | 浏览器 `HttpOnly` Cookie      | 空闲 7 天，最长 30 天 | 不能             |
| refresh 摘要 | 后端 D1 `refresh_sessions` 表 | 空闲 7 天，最长 30 天 | 不适用           |
| 当前用户快照 | 页面运行内存                  | 当前页                | 能               |

浏览器刷新后，内存中的访问凭证会消失。路由守卫会先调用刷新接口，由浏览器自动带上 Cookie；恢复成功后才进入受保护页面。

## 完整流程

```text
登录
  -> 后端验证账号密码
  -> 返回 15 分钟 access token
  -> 设置前端脚本不可读的 refresh Cookie
  -> D1 只保存 refresh 凭证的 SHA-256 摘要

普通请求
  -> Axios 从内存读取 access token
  -> 写入 Authorization 请求头

access token 过期
  -> 后端返回 401 + ACCESS_TOKEN_EXPIRED
  -> Axios 核对请求策略、实际发送的 token 和重放次数
  -> 第一个符合条件的请求发起 refresh
  -> 同一时刻的其它 401 请求共用这次 refresh
  -> 其它标签页通过 Web Lock 和 BroadcastChannel 复用新会话
  -> 后端作废旧 refresh 会话并签发新会话
  -> Axios 只重试原请求一次

退出
  -> 后端撤销整组 refresh 会话并清除 Cookie
  -> 前端清空内存登录态和所有私有查询缓存
```

上面描述的是当前已经实现的闭环。自动刷新不再由普通 `401` 触发，只接受后端明确返回的 `ACCESS_TOKEN_EXPIRED`。

## 刷新判断审计

### 结论

改造前的条件只适合作为基础版本，不适合作为最终版本：

```text
响应状态是 401
  + 原请求存在
  + 原请求没有重试过
  + 原请求没有禁止自动刷新
  + 原请求不是 refresh 接口
```

主要问题是 `401` 只表示请求没有通过身份认证，并不等于 access token 已经过期。以下情况都可能返回 `401`，但处理方式不同：

| 场景                         | 是否自动刷新 | 原因                                           |
| ---------------------------- | ------------ | ---------------------------------------------- |
| access token 正常过期        | 是           | refresh 会话仍可能有效，可恢复原请求           |
| 请求没有携带 access token    | 否           | 应由路由守卫显式恢复会话，不由任意业务请求猜测 |
| access token 格式或签名无效  | 否           | 可能是数据损坏、错误配置或篡改                 |
| 用户已停用、删除或会话已撤销 | 否           | 刷新不能恢复已终止的授权                       |
| 已登录但权限不足             | 否           | 应返回 `403`，刷新不会增加权限                 |
| 登录接口账号密码错误         | 否           | 这是登录失败，不是 access token 过期           |
| 网络错误、超时或服务端故障   | 否           | 没有收到可证明 access token 过期的认证响应     |

OAuth Bearer Token 规范使用 `invalid_token` 表示 access token 已过期、被撤销、格式错误或因其它原因无效，并规定权限不足应使用 `403`。当前项目由自己控制前后端，因此已经在这个标准信号之上细分稳定的业务错误码，让前端只自动恢复明确的过期场景。

### 当前错误契约

错误提示文字用于展示，稳定的 `code` 才用于程序判断。后端响应如下：

| HTTP | `code`                 | 含义                        | 前端动作                        |
| ---- | ---------------------- | --------------------------- | ------------------------------- |
| 401  | `AUTH_REQUIRED`        | 请求没有 access token       | 不自动刷新                      |
| 401  | `ACCESS_TOKEN_EXPIRED` | access token 已过期         | 允许刷新一次                    |
| 401  | `ACCESS_TOKEN_INVALID` | access token 无效或被篡改   | 清除本地 access token，结束会话 |
| 401  | `ACCOUNT_UNAVAILABLE`  | 用户被停用或删除            | 结束会话                        |
| 401  | `REFRESH_MISSING`      | refresh Cookie 不存在       | 结束会话                        |
| 401  | `REFRESH_EXPIRED`      | refresh 会话过期            | 结束会话                        |
| 401  | `REFRESH_REVOKED`      | refresh 会话已撤销          | 结束会话                        |
| 401  | `REFRESH_REPLAYED`     | 检测到旧 refresh 凭证被重放 | 撤销会话家族并结束会话          |
| 403  | `FORBIDDEN`            | 已认证但没有业务权限        | 保留会话，展示无权限            |
| 403  | `ORIGIN_NOT_ALLOWED`   | 浏览器来源不受信任          | 结束会话并记录安全事件          |
| 429  | `TOO_MANY_REQUESTS`    | 请求过于频繁                | 保留会话，按 `Retry-After` 处理 |
| 5xx  | 服务错误码             | refresh 服务暂时不可用      | 保留会话，提示稍后重试          |

access token 过期时还应返回标准认证头：

```http
WWW-Authenticate: Bearer error="invalid_token"
```

### 当前刷新条件

自动刷新必须同时满足：

```text
1. HTTP 状态为 401
2. 后端 code 为 ACCESS_TOKEN_EXPIRED
3. 原请求声明为受保护请求
4. 原请求确实发送了 Bearer access token
5. 原请求尚未因认证失败重放过
6. 当前会话没有处于退出或账号切换过程
```

`refresh`、`login`、`logout` 等认证接口必须明确禁止拦截器再次触发 refresh。请求策略是唯一判断来源，不再依靠 URL 字符串比较作为主要保护。

刷新并重放一次后若原请求仍返回过期，拦截器只上抛错误、不再直接清空会话：是否终结会话统一由终止型错误码判定。这样服务端时钟抖动等暂时故障不会误杀一个刚刚成功刷新的会话。

### 迟到的 401

多个请求可能都携带旧 access token。第一个请求刷新成功后，另一个旧请求的 `401` 可能稍后才到达。此时不能再次刷新：

```text
读取失败请求实际发送的 access token
  -> 和当前内存中的 access token 比较
  -> 不相同：说明其它请求已经刷新成功
       -> 直接用当前 token 重放一次
  -> 相同：当前 token 确实失效
       -> 进入共享 refresh 流程
```

这项比较同时减少无意义轮换，并避免迟到响应触发第二次 refresh。

### 主动刷新与被动恢复

当前方案采用两层保护：

1. **主动刷新**：受保护请求发出前，若 access token 距离过期不足约 30 秒，则通过共享刷新任务提前更新。
2. **被动恢复**：服务端仍返回 `ACCESS_TOKEN_EXPIRED` 时，执行一次刷新并重放原请求。

主动刷新改善正常体验，被动恢复处理客户端时钟偏差、页面休眠和网络延迟。页面重新加载后没有内存 token，仍由路由守卫显式调用会话恢复；普通业务请求不负责猜测是否存在 Cookie 会话。

### 刷新失败不能一律退出

当前实现按稳定错误码区分两类失败：

| 类型   | 示例                                            | 是否清空会话 |
| ------ | ----------------------------------------------- | ------------ |
| 终止型 | refresh 过期、撤销、重放、用户停用、来源不可信  | 是           |
| 暂时型 | 断网、超时、请求取消、`429`、Worker 或 D1 `5xx` | 否           |

暂时型失败应保留当前用户快照和 refresh Cookie，进入“暂时无法恢复”的状态，并允许后续请求或用户操作重试。否则一次短暂网络故障就会造成不必要的退出。

## 并发与竞态

### 单标签页

同一页面内继续使用共享 Promise，保证所有同时到达的过期响应只发起一次 refresh。每个原请求最多重放一次，防止无限循环。

### 多标签页

刷新 Cookie 被同源标签页共享，但当前共享 Promise 只存在于单个标签页。两个标签页同时使用同一旧 refresh 凭证时，后端会按照重放攻击撤销整个会话家族。

当前方案使用浏览器跨标签页协调：

- 使用 Web Locks 保证同一时刻只有一个标签页执行 refresh。
- 使用 `BroadcastChannel` 通知其它标签页会话已更新或已退出。
- 标签页启动时通过 `hello` / `present` 握手记录存活的 peer；`pagehide` 和 dispose 时发送 `bye`。没有已知 peer 时索取会话立即返回，单标签页冷启动不承担固定等待；已知 peer 存在时最多等待 100 毫秒兜底（覆盖 peer 崩溃未发 `bye` 的残留记录）。
- 后一个标签页拿到锁后，主动向其它标签页索取最新内存会话，避免广播尚未送达时再次 refresh。索取到的 peer 会话必须满足新鲜度门槛（access token 剩余时间大于主动刷新窗口，且 refresh 会话未过期），否则放弃采纳、直接刷新，避免拿到临过期 token 后立刻再刷一轮。
- 广播事件携带 `sentAt` 时间戳和发布方 `sourceId`：更旧的事件丢弃；同毫秒但来自不同发布方的事件按到达顺序应用，不会被误判为重复投递。
- access token 仍只存在运行内存，不写入 `localStorage` 或 `sessionStorage`。
- 新打开的标签页在锁内显式恢复 Cookie 会话。
- 运行环境缺少 Web Locks（如部分 WebView）时，套件打印一次警告并退化为无跨页互斥；此时并发刷新的兜底是服务端的轮换宽限期（见下文）。

这是当前严格轮换策略正常工作所需要的客户端补充；服务端宽限期只兜底“客户端协调不可用”的场景，不放宽真正的重放检测。

### 刷新与退出竞态

退出不能只清空前端状态。如果 refresh 响应晚于 logout，它可能重新设置 Cookie 和内存 access token。当前顺序是：

```text
会话代次失效
  -> 等待正在进行的 refresh 收敛，但忽略它的本地结果
  -> 调用后端 logout 撤销最新 Cookie 对应的会话家族
  -> 清空本地状态与私有查询缓存
  -> 广播其它标签页退出
```

登录账号切换也必须经过同一个会话协调器，避免旧账号 refresh 覆盖新账号登录结果。

## 服务端轮换审计

当前 D1 轮换已经使用批量事务和 `validate_refresh_session_rotation` 触发器。后继 refresh 会话只有在父会话已被原子标记为对应后继时才能插入，因此同一个旧凭证不能成功产生两个有效分支。

这部分保持严格轮换，并已补充稳定错误码、7 天空闲期限、30 天绝对期限和 `Cache-Control: no-store`。账号停用会撤销该账号的全部 refresh 会话；主动退出会撤销当前会话家族。

### 轮换宽限期

严格的“旧凭证再现即撤销家族”会误伤两类正常场景：刷新响应在网络上丢失后浏览器重试，以及缺少 Web Locks 时多标签页并发刷新。参照 Auth0 / Supabase 的 reuse interval 实践，服务端增加 60 秒轮换宽限期（`REFRESH_ROTATION_GRACE_SECONDS`）：

```text
旧凭证重放到达
  -> 该凭证确实是被正常轮换的（revoke_reason = 'rotated'）
  -> 距被轮换不超过 60 秒，且家族绝对期限未到
  -> 它的直接后继会话仍然存活（未被撤销）
  -> 满足全部条件：补发一个同家族新会话（视为响应丢失重试）
  -> 任一条件不满足：按重放攻击撤销整个家族
```

三个安全边界：

- **后继存活检查**：退出登录会撤销整个家族，旧凭证的直接后继随之失效，因此“退出后立刻重放旧 Cookie”即使在 60 秒内也会被拒绝，宽限期不会复活已退出的会话。
- **补发会话不挂父子链**：宽限补发是同家族兄弟会话（`parent_id` 为空），不经过轮换触发器的父子校验，家族撤销时一并失效。
- **并发轮换竞争**：两个请求同时轮换同一凭证时，D1 触发器保证只有一方成功；失败方回滚后走同样的宽限判断，双方都能拿到有效会话，不误报重放。

## 验收用例

| 用例                                   | 预期结果                                    |
| -------------------------------------- | ------------------------------------------- |
| 两个请求同时收到 access token 过期响应 | 只发起一次 refresh，两个请求各重放一次      |
| 第二个旧请求的 401 在刷新完成后才到达  | 使用新 token 重放，不再次 refresh           |
| 业务接口返回 `403`                     | 不 refresh，不退出                          |
| 请求没有 Bearer token                  | 不由 Axios 自动 refresh                     |
| access token 签名无效                  | 不 refresh，结束本地会话                    |
| refresh 返回过期、撤销或重放           | 清空会话并进入登录页                        |
| refresh 断网、超时、`429` 或 `5xx`     | 不清空 refresh 会话，显示可恢复错误         |
| refresh 成功后原请求仍返回 `401`       | 不再重试，也不直接清空会话                  |
| 两个标签页同时发现 token 过期          | 通过跨页锁只执行一次 refresh                |
| peer 标签页会话即将过期                | 不采纳，改为自己刷新                        |
| 单标签页冷启动触发刷新                 | 不等待 peer 回应，直接刷新                  |
| refresh 进行中执行退出                 | 最终 Cookie、内存状态和数据库会话均为已退出 |
| 页面刷新后内存 token 消失              | 路由守卫只执行一次显式会话恢复              |
| 旧 refresh 凭证在轮换后 60 秒内重放    | 补发同家族会话，不撤销家族                  |
| 旧 refresh 凭证在宽限期外重放          | 撤销整个会话家族                            |
| 退出后旧 refresh 凭证在宽限期内重放    | 拒绝并撤销，不复活会话                      |
| 两个请求并发轮换同一 refresh 凭证      | 双方都获得有效会话，不误报重放              |

## 实现状态

| 能力                              | 状态   |
| --------------------------------- | ------ |
| access token 仅存内存             | 已实现 |
| refresh HttpOnly Cookie           | 已实现 |
| refresh 摘要存储、轮换和家族撤销  | 已实现 |
| 单标签页共享 refresh Promise      | 已实现 |
| 原请求最多重放一次                | 已实现 |
| 稳定认证错误码                    | 已实现 |
| 只对明确过期场景自动刷新          | 已实现 |
| 迟到 401 的旧 token 比较          | 已实现 |
| 暂时型与终止型刷新失败分流        | 已实现 |
| 主动刷新窗口                      | 已实现 |
| 多标签页 refresh 协调             | 已实现 |
| refresh、logout、账号切换竞态保护 | 已实现 |
| 标签页存在感握手（单页免等待）    | 已实现 |
| peer 会话新鲜度门槛               | 已实现 |
| 跨页事件同毫秒去重（sourceId）    | 已实现 |
| Web Locks 缺失降级警告            | 已实现 |
| 服务端轮换宽限期（60 秒）         | 已实现 |
| 请求套件与项目解耦（可复用）      | 已实现 |

## 为什么不把 refresh token 放在 localStorage

`localStorage` 中的数据可以被页面 JavaScript 读取。一旦发生脚本注入，长期凭证可能被直接带走，并在其它设备持续换取新的访问凭证。

`HttpOnly` 不能消除脚本注入风险，但能阻止脚本直接读取长期凭证。配合以下限制后，风险边界更清晰：

- `SameSite=Strict`：限制跨站携带。
- `Secure`：生产环境只通过 HTTPS 发送。
- 精确 Origin 白名单：登录、刷新和退出拒绝非信任网页来源。
- Cookie Path：只发送给 `/admin/api/auth`。
- 服务端只保存摘要：数据库泄漏时不直接暴露原始 refresh 凭证。

## 为什么每次刷新都轮换

刷新成功后，旧凭证立即标记为已替换，新凭证作为它的子会话写入数据库。若旧凭证再次出现，先经过 60 秒轮换宽限期判断（见“服务端轮换审计”）：宽限内的重放视为响应丢失重试，补发同家族会话；宽限外或后继已失效的重放才按攻击撤销这一登录会话产生的整组凭证。

D1 的批量事务和数据库触发器共同保证同一旧凭证只能成功轮换一次。普通数据库故障不会被误判为重放攻击。

## 前端职责划分

| 模块         | 职责                                                          |
| ------------ | ------------------------------------------------------------- |
| Axios        | 发送请求、注入 access token、合并并发刷新、单次重试、统一错误 |
| Pinia        | 保存当前页的登录态和用户快照、恢复会话、执行退出              |
| Pinia Colada | 缓存用户列表等服务端数据；账号切换或退出时清空私有缓存        |
| 路由守卫     | 首次进入时恢复 Cookie 会话；未登录跳转登录页；继续执行 RBAC   |

Pinia Colada 不保存 Token。登录和刷新会改变会话，因此属于动作；用户列表等可重复读取的数据才使用查询缓存。

## 对应代码

| 位置                                                           | 作用                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| `src/api/session.ts`                                           | 只在内存保存 access token 和用户快照；导出存储适配器 |
| `src/api/http/types.ts`                                        | 套件注入契约：会话形状、会话存储、错误分类           |
| `src/api/http/interceptors.ts`                                 | 精确刷新判断、token 注入和原请求单次重放             |
| `src/api/http/auth-session-coordinator.ts`                     | 刷新、登录、退出和账号切换的顺序协调                 |
| `src/api/http/auth-coordination.ts`                            | Web Lock、跨标签页广播、存在感握手和会话索取         |
| `src/api/http/client.ts`                                       | `HttpClient`：HTTP 方法收敛与响应剥壳                |
| `src/api/http/context.ts`                                      | `createHttpClientContext` 工厂（套件内组装）         |
| `src/api/request.ts`                                           | 装配点：注入项目会话存储与错误码契约，稳定公开出口   |
| `src/stores/auth.ts`                                           | 登录态恢复和退出                                     |
| `src/router/guards.ts`                                         | 进入受保护路由前恢复会话                             |
| `services/api-hono/src/services/refresh-sessions.ts`           | 创建、轮换、重放检测和撤销 refresh 会话              |
| `services/api-hono/src/services/auth-cookies.ts`               | Cookie 安全属性                                      |
| `services/api-hono/migrations/017_create_refresh_sessions.sql` | D1 会话表和并发轮换约束                              |
| `services/api-hono/migrations/018_harden_auth_sessions.sql`    | 账号状态和 refresh 绝对期限                          |
| `contracts/admin-api/src/auth.ts`                              | 前后端共享的稳定认证错误码                           |

## 方案比较

| 方案                          | 优点                       | 主要问题                               | 当前结论 |
| ----------------------------- | -------------------------- | -------------------------------------- | -------- |
| 单一长期 JWT                  | 实现最少                   | 泄漏后长期有效，无法自然恢复和撤销     | 不采用   |
| access + refresh 都存本地存储 | 前后端实现简单             | 长期凭证可被脚本读取                   | 已替换   |
| access 内存 + refresh Cookie  | 长期凭证不可被脚本直接读取 | 页面刷新时必须先恢复会话               | 当前采用 |
| 服务端传统 Session            | 容易即时撤销               | 所有请求都依赖会话查询，跨实现约束更强 | 暂不采用 |

## 本地验证

- 前端 61 个测试通过（`pnpm --dir apps/page test`），覆盖并发 `401`、主动刷新、迟到响应、临时故障、终止型故障、跨上下文会话复用、peer 会话新鲜度、同毫秒事件去重、存在感握手和刷新/退出竞态；`vue-tsc --noEmit` 通过。
- 后端 13 个测试通过（`pnpm --dir services/api-hono test`），其中 6 个覆盖 refresh 轮换：正常轮换、宽限期内补发、宽限期外撤销家族、退出后不可复活、并发轮换双成功和过期拒绝。
- 本地 D1 已成功应用迁移 018；未执行远程迁移。
- 重构后已在本地重新完成真实 API 与真实浏览器的联调复验（2026-07-14，`wrangler dev` + vite dev）：
  - API（curl + cookie jar）：登录、`profile` 读取、刷新轮换（cookie 会话 id 变化）、宽限期内重放旧凭证补发兄弟会话（`200`）、超过 60 秒重放触发 `REFRESH_REPLAYED` 且家族全部凭证变为 `REFRESH_REVOKED`、退出登录后宽限期内重放已轮换凭证被拒绝（不复活）。
  - 浏览器（localhost:5176 双标签页）：无凭证冷启动仅发一次 `refresh`（`401` 后停留登录页）；UI 登录成功；页面刷新恰好一次 `refresh`（`200`）直达首页；第二个标签页零网络请求经 peer 会话共享直接恢复；任一标签页退出后两个标签页同时回到登录页（`session-ended` 广播），全程控制台无报错。

## 已知边界

- 退出后，已经泄漏的 access token 最长仍可使用 15 分钟；refresh 会话会立即失效。
- `HttpOnly` 保护的是“不可读取”，并不代表页面脚本绝对无法借浏览器发起请求，因此脚本注入防护仍然重要。
- 正式部署前必须配置 Worker 的 `JWT_SECRET`，并执行远程 D1 迁移；本项目不会自动修改远程数据库。
- Cloudflare Pages 的随机预览域名不作为正式登录域名；正式环境使用同一站点下的 `admin.9shi.cc` 和 `api.9shi.cc`。

## 规范与参考

- [RFC 6750: OAuth 2.0 Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html)：`401`、`invalid_token`、`403` 与 `insufficient_scope` 的语义。
- [RFC 9700: OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html)：refresh token 轮换、重放检测、撤销和生命周期建议。
- [OAuth 2.0 for Browser-Based Applications](https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/26/)：浏览器应用、BFF、token-mediating backend、Cookie 和 refresh 生命周期建议。该文档当前处于 RFC 发布流程，引用时需保留其草案属性。
- [OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)：浏览器 Token 保护和重放防护摘要。
- [Axios Interceptors](https://axios-http.com/docs/interceptors)：Axios 只提供拦截机制，是否刷新必须由本项目认证契约决定。
