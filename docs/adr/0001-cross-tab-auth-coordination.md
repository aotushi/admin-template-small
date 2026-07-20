# 跨标签页认证协调（BroadcastChannel + Web Locks）

## 背景

本项目双 token 存放策略：access token 只存内存（防 XSS，刷新页面即丢失），refresh token 存 HttpOnly + SameSite=Strict cookie，且服务端采用**轮换制**——每次刷新签发新 refresh token 并对旧 token 做重放检测。

由此产生的问题：多个标签页各自持有独立的内存会话，却共享同一个 refresh cookie。若两个标签页并发刷新，后到的请求会携带已被轮换掉的旧 cookie，触发服务端重放检测，**整个会话被终结，所有标签页同时掉线**。

## 决定

前端引入跨标签页认证协调层（`apps/page/src/api/http/auth-tab-channel.ts`），由三个机制组成：

1. **Web Locks 互斥**（`navigator.locks`）：全局同一时刻最多一个标签页在执行刷新/登录/退出。
2. **BroadcastChannel 广播**：刷新/登录成功后广播 `session-updated`，退出后广播 `session-ended`，其它标签页同步内存会话而无需各自刷新。
3. **peer 会话索取**：标签页需要刷新时先向已知存活的 peer 索要现成会话（presence 握手维护存活名单，单标签页冷启动免等待），拿到足够新鲜的会话就跳过网络刷新。

服务端的轮换宽限期只作为 Web Locks 不可用环境（老浏览器）下的最后兜底，不是常规依赖。

## 已考虑并否决的替代方案

- **token 写入 localStorage 共享**：标签页天然共享会话，无需协调——但 access token 落盘破坏防 XSS 的前提，否决。
- **不做协调，完全依赖服务端轮换宽限期**：宽限期窗口内并发可容忍，但窗口外的并发刷新仍会误杀会话，且把正确性押在服务端容错参数上，否决。
- **refresh token 不轮换**：协调层可大幅简化，但长期有效的 refresh token 一旦泄漏无法检测，安全性倒退，否决。

## 后果

- 前端多出一层协调代码（tab channel + coordinator 内的竞态防线），是本目录复杂度的主要来源；删除它的前提是先放弃 refresh token 轮换或内存存储，两者都不可取。
- 绕过 UI 的 fetch logout 不会广播 `session-ended`，其它存活标签页会把内存会话回传导致"退不掉"——退出必须走 UI 或手动广播该事件。
