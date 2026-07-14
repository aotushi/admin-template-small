# 登录接口为什么使用 mutation

## 当前项目怎么用

当前登录接口已经从页面直接调用 Axios，改成通过 Pinia Colada mutation 调用。

对应文件：

| 文件                                                               | 作用                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| [`src/api/modules/auth.ts`](../../src/api/modules/auth.ts)         | 提供 `loginApi()`，只负责调用登录接口                  |
| [`src/queries/auth.ts`](../../src/queries/auth.ts)                 | 提供 `useLoginMutation()`，管理登录动作状态            |
| [`src/views/LoginView.vue`](../../src/views/LoginView.vue)         | 调用 `loginMutation.mutateAsync()`，成功后保存 session |
| [`src/router/redirect.ts`](../../src/router/redirect.ts)           | 统一处理登录成功后的跳转目标                           |
| [`src/views/DashboardView.vue`](../../src/views/DashboardView.vue) | 提供登录成功后的临时目标页                             |

当前流程：

```text
用户点击登录
  -> LoginView 校验表单
  -> loginMutation.mutateAsync(payload)
  -> loginApi(payload)
  -> Axios 发请求
  -> mutation onSuccess 清理 auth 查询缓存
  -> LoginView 将 accessToken / user 写入内存会话
  -> LoginView 解析 redirect 参数
  -> 跳转到合法 redirect 或 /dashboard
```

## 为什么登录不是 query

`query` 适合读取可复用数据：

```text
当前用户资料
用户列表
角色列表
菜单树
字典选项
```

这些数据通常可以缓存、复用、刷新。

登录不是读取数据，而是执行动作：

```text
提交账号密码
签发 Token
改变本地会话
可能跳转页面
清理旧账号缓存
```

因此登录更接近：

```text
新增用户
编辑用户
删除用户
修改角色权限
```

这些都属于 mutation。

## 如果登录写成 query 会有什么问题

| 问题             | 说明                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| query key 难设计 | 登录参数包含密码，不能放进 key；不放参数又会让不同账号共享 key               |
| 自动刷新危险     | query 可能因重新挂载、过期、聚焦窗口等场景重新请求；登录不应该被自动重新提交 |
| 缓存没有意义     | 登录结果是一次性会话数据，不应该作为可复用页面数据缓存                       |
| 语义不准确       | 登录失败是提交失败，不是读取某份数据失败                                     |
| 安全边界模糊     | query 鼓励同 key 共享数据，登录结果不应该被共享复用                          |

## mutation 在登录中的价值

| 价值             | 当前体现                                            |
| ---------------- | --------------------------------------------------- |
| loading 状态统一 | 页面使用 `loginMutation.isLoading` 控制按钮 loading |
| 成功副作用集中   | `onSuccess` 里清理 `auth` 查询缓存                  |
| 错误状态可扩展   | 后续可以统一读取 mutation error                     |
| 和 CRUD 模式一致 | 后续新增、编辑、删除都可以照这个方式实现            |
| 页面更薄         | 页面只负责表单校验、保存 session、路由跳转          |

## 登录成功后的跳转规则

登录成功后的跳转不放在表单组件里，而是放在 `LoginView.vue` 和 `router/redirect.ts` 中。

原因是表单组件只负责收集账号、密码和验证码状态；只有路由页面知道当前 URL 上是否存在 `redirect`，也知道登录成功后应该进入哪个页面。

当前规则：

| redirect 情况       | 结果                       |
| ------------------- | -------------------------- |
| 缺失                | 跳转 `/dashboard`          |
| `/dashboard`        | 跳转 `/dashboard`          |
| `/users?page=1`     | 保留内部路径和查询参数     |
| `https://...`       | 拒绝，回到 `/dashboard`    |
| `//example.com`     | 拒绝，回到 `/dashboard`    |
| `/login` 或其子路径 | 拒绝，避免登录后又回登录页 |

`router/index.ts` 也复用这套规则：

- 未登录访问 `/dashboard` 时，跳转到 `/login?redirect=/dashboard`。
- 已登录访问 `/login` 时，跳转到合法 `redirect` 或 `/dashboard`。

## 和直接 Axios 登录比较

| 方案                              | 优点                               | 缺点                                        |
| --------------------------------- | ---------------------------------- | ------------------------------------------- |
| 页面直接调 Axios                  | 最简单，适合小 demo                | loading/error/缓存清理容易散在页面里        |
| 封装 `useLogin()` 普通 composable | 也清晰，可控性强                   | 需要自己维护 loading/error/status           |
| Pinia store action 登录           | 适合把登录态集中到 store           | 容易把服务端动作状态和本地状态混在 store 里 |
| Pinia Colada mutation 登录        | 和后续 CRUD 模式统一，动作状态清晰 | 需要理解 mutation，不是最极简               |

## 当前结论

当前项目采用：

```text
login -> mutation
profile -> query
access session -> memory / Pinia
refresh session -> HttpOnly Cookie / backend D1
```

这条边界最适合后台管理学习：

- 登录是动作，用 mutation。
- 当前用户资料是读取，用 query。
- 短期 Token 和用户快照只留在当前页面内存，由 session 模块和 Pinia 管理。
- 长期刷新凭证由浏览器的 HttpOnly Cookie 和后端会话表管理，前端脚本不可读取。

后续用户管理模块也应沿用：

```text
获取用户列表 -> query
新增用户     -> mutation
编辑用户     -> mutation
删除用户     -> mutation
```
