# Axios + Pinia Colada 请求层方案

## 当前项目怎么用

当前项目把请求层拆成三层：

| 层级         | 工具         | 当前文件                                           | 职责                                         |
| ------------ | ------------ | -------------------------------------------------- | -------------------------------------------- |
| HTTP 传输层  | Axios        | [`src/api/request.ts`](../../src/api/request.ts)   | 发送请求、注入 Token、刷新 Token、统一错误   |
| API 函数层   | 普通函数     | [`src/api/auth.ts`](../../src/api/auth.ts)         | 按业务接口封装登录、刷新、当前用户资料等函数 |
| 服务端状态层 | Pinia Colada | [`src/queries/auth.ts`](../../src/queries/auth.ts) | 管 query/mutation 状态、缓存、刷新、失效     |

登录链路：

```text
LoginView
  -> useLoginMutation()
  -> loginApi()
  -> requestClient.post()
  -> axios instance
```

当前用户链路：

```text
useCurrentUserQuery()
  -> getProfileApi()
  -> requestClient.get()
  -> axios instance
```

## 为什么不只用 Axios

Axios 很适合处理“如何发请求”，但它不负责“请求结果在前端如何管理”。

如果只用 Axios，每个页面都要重复处理：

- loading
- error
- retry
- 重复请求去重
- 数据缓存
- 数据过期
- 新增/编辑/删除后的列表刷新

后台管理项目会大量出现列表、详情、字典、角色、菜单、权限树等接口。如果所有页面都手写这些状态，代码会很快分散。

## 为什么引入 Pinia Colada

Pinia Colada 负责服务端状态：

| 能力         | 在后台管理中的价值                              |
| ------------ | ----------------------------------------------- |
| query key    | 用稳定 key 区分用户列表、角色列表、菜单树等数据 |
| query        | 管读取类接口，例如当前用户、用户列表、字典      |
| mutation     | 管动作类接口，例如登录、新增、编辑、删除        |
| invalidation | 修改成功后让相关列表或详情自动变旧并重新获取    |
| shared state | 多个组件读取同一份服务端数据时避免重复请求      |

当前已落地：

```text
auth.current-user -> 当前用户资料 query
auth.login        -> 登录 mutation
```

## 和其它方案比较

| 方案                   | 优点                                            | 缺点                                                | 当前项目结论                     |
| ---------------------- | ----------------------------------------------- | --------------------------------------------------- | -------------------------------- |
| 原生 fetch             | 浏览器内置、依赖少                              | 拦截器、错误归一化、超时、自动刷新都要手写          | 不适合当前后台管理学习主线       |
| 只用 Axios             | 请求封装清晰，拦截器成熟                        | 不解决服务端状态缓存、失效、去重                    | 作为底层传输层保留               |
| Axios + Pinia          | 容易理解，所有状态都进 store                    | store 容易混入 loading/error/cache 等临时服务端状态 | 不作为主方案，Pinia 只管本地状态 |
| Axios + Pinia Colada   | Vue / Pinia 生态内自然，query/mutation 边界清晰 | 需要先理解 query key、mutation、失效机制            | 当前采用                         |
| Axios + TanStack Query | 能力强，生态成熟，跨框架经验多                  | 对当前 Vue + Pinia 学习项目来说概念稍重             | 可作为后续对照学习               |

## 当前规则

| 场景               | 项目规则                                      |
| ------------------ | --------------------------------------------- |
| 发 HTTP 请求       | 只在 `src/api/*` 调 Axios 封装                |
| 页面读取服务端数据 | 在 `src/queries/*` 建 query                   |
| 页面提交动作       | 在 `src/queries/*` 建 mutation                |
| 本地登录态         | 由 session/localStorage 和后续 Pinia store 管 |
| 修改成功后的刷新   | mutation 成功后失效相关 query key             |

## 后续扩展

用户管理模块可以继续沿用：

```text
src/api/users.ts
  -> listUsers()
  -> createUser()
  -> updateUser()
  -> deleteUser()

src/queries/users.ts
  -> USERS_QUERY_KEYS.list()
  -> useUsersQuery()
  -> useCreateUserMutation()
  -> useUpdateUserMutation()
  -> useDeleteUserMutation()
```

这样可以把“接口怎么发”和“页面数据怎么管理”分开学习。
