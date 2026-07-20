# admin-backend-3

Vue3 + Element Plus 前端与 Hono on Cloudflare Workers + D1 后端组成的后台管理系统模板，核心域是双 token 会话管理与基于菜单表的 RBAC。

## Language

### 会话与双 token

**会话（session）**:
一次登录产生的前端内存状态：access token、其过期时间（`expires`）、refresh 会话过期时间（`sessionExpires`）与当前用户快照。只存内存，刷新页面即丢失。
_Avoid_: 登录态、token 对

**access token**:
短时效 Bearer token，随每个受保护请求经 `Authorization` 头发送，只存内存。
_Avoid_: JWT（JWT 是编码格式，不是角色名）

**refresh 会话**:
由 HttpOnly + SameSite=Strict cookie 承载的长时效凭证，轮换制（每次刷新签发新值并对旧值做重放检测）。前端不可读，只知道其过期时间 `sessionExpires`。
_Avoid_: refresh token 字符串（前端语境下它不可见）

**主动刷新（proactive refresh）**:
access token 距过期小于刷新窗口（默认 30 秒）时，请求拦截器在发送前先行刷新。失败但旧 token 尚可用时放行请求。

**被动刷新（reactive refresh）**:
响应侧收到"access token 已过期"错误码后触发的刷新与单次重放。是主动刷新失败后的兜底。

**迟到的 401**:
请求发出后、响应回来前，别的请求已完成刷新——此时收到的 401 用的是旧 token。通过对比"实际发送的 token"与当前 token 识别，直接用新 token 重放，不再刷新。

**终止型错误（terminal auth error）**:
刷新无法恢复的认证错误（如 refresh 会话过期、重放检测命中），唯一允许清空本地会话的信号。普通 401 不终结会话。

**会话代际（lifecycle）**:
coordinator 内部的递增计数，登录/退出/会话终结时 +1。异步操作完成时代际不匹配即说明会话已换代，结果作废。

**会话版本（revision）**:
会话存储每次写入或清空的递增计数，用于识别"等锁期间会话已被别人更新"。
_Avoid_: version（与依赖版本混淆）

**过渡（transition）**:
coordinator 处于登录或退出过程中的状态。过渡期间拒绝一切刷新请求。

### 跨标签页协调

**标签页通道（tab channel）**:
跨标签页协调的传输层（`AuthTabChannel` 接口），聚合 BroadcastChannel 广播、Web Locks 互斥与 peer 会话索取。浏览器实现与 noop 实现（测试/SSR）是它的两个 adapter。存在理由见 ADR-0001。
_Avoid_: coordination、协调器（后者指 coordinator）

**coordinator**:
`AuthSessionCoordinator`，刷新/登录/退出的状态机，持有代际与过渡状态，通过标签页通道与其它标签页协作。
_Avoid_: 与"标签页通道"混用

**peer 会话**:
从其它存活标签页索取到的现成会话。足够新鲜（剩余时效超过阈值）才被采纳，避免拿到临过期 token 立刻再刷一轮。

**存在感握手（presence handshake）**:
标签页启动广播 hello、收到方回 present、关闭时发 bye，维护存活 peer 名单。名单为空时跳过 peer 索取，单标签页冷启动无需等待超时。

### RBAC

**角色码（role_code）**:
角色的稳定标识（如 `super`/`admin`/`user`）。用户与角色的归属唯一存于 `user_roles` 表，`users` 表不再有角色列（迁移 022）。
_Avoid_: role 字段、admin_level

**多角色（multi-role）**:
一个用户可绑定多个角色（含自定义角色），全链路多对多（ADR-0002）。权限码取并集，数据范围取最宽（`all` > `dept` > `self`）；`super` 不可与其他角色叠加（前后端同规则校验）。
_Avoid_: 单角色、主角色

**权限码（permission code）**:
菜单节点上的 `auth_code`（如 `system:user:view`），前端显隐的唯一判定依据。每次请求由后端实时解析（user → user_roles → roles → role_menus → menus），不进 JWT。
_Avoid_: permissions 表（已被菜单表取代）

**菜单（menu）**:
`menus` 树表，仅作为权限数据源；前端路由是静态声明的，菜单表不下发动态路由。

**super**:
内置最高角色，用于角色分配等少数 super 专属规则；普通路由、按钮和接口仍按权限码判定，角色本身不提供权限绕过。该内置角色受保护，不可删改。
_Avoid_: 超级管理员字段（无此字段，super 也是一条角色记录）
