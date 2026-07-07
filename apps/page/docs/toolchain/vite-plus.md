# Vite+ 工具链

## 当前项目怎么用

`apps/page` 使用 Vite+ 作为前端工具链入口。

当前脚本：

```json
{
  "dev": "vp dev --mode development",
  "build": "vp build --mode production",
  "check": "vp check",
  "fix": "vp check --fix",
  "format": "vp check --fix",
  "lint": "vp check",
  "test": "vp test"
}
```

对应文件：

| 文件                                     | 作用                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| [`package.json`](../../package.json)     | 定义 `vp` 命令脚本                                         |
| [`vite.config.ts`](../../vite.config.ts) | 定义 Vite、Vite+、Element Plus、代理、构建、检查、测试配置 |
| [`tsconfig.json`](../../tsconfig.json)   | 定义 TypeScript 基础配置                                   |

## 当前项目为什么用 Vite+

本项目的学习目标是：

- 避免在前端根目录堆大量格式化、lint、hook 配置文件。
- 保持命令入口统一。
- 使用一个工具链完成开发、构建、检查、修复和测试。
- 让学习重点回到 Vue 后台管理本身。

因此当前项目不单独保留 ESLint / Prettier 配置文件，而是通过：

```text
vp check
vp check --fix
vp test
vp build
```

作为主要入口。

## 需要注意的边界

Vite+ 是统一入口，但底层仍可能依赖相关能力包。

当前项目中仍能看到：

| 依赖                    | 说明                      |
| ----------------------- | ------------------------- |
| `vitest`                | `vp test` 的测试能力基础  |
| `vue-tsc`               | Vue 类型检查能力基础      |
| `@vitejs/plugin-vue`    | Vue SFC 编译能力          |
| `unplugin-element-plus` | Element Plus 自动样式处理 |

所以更准确的理解是：

```text
开发者日常使用 vp 命令
工具链内部仍可组合 Vite / Vitest / TypeScript / Vue 插件能力
```

## 和传统方案比较

| 方案                             | 优点                                   | 缺点                                     | 当前项目结论       |
| -------------------------------- | -------------------------------------- | ---------------------------------------- | ------------------ |
| Vite + ESLint + Prettier + Husky | 社区资料多，配置灵活                   | 配置文件多，初学阶段容易被工程化细节分散 | 不作为当前学习主线 |
| Vue 官方脚手架默认配置           | 上手快，生态稳定                       | 生成的配置和当前项目目标不完全一致       | 只作为创建项目参考 |
| Vite+ 统一入口                   | 命令集中，配置更少，和当前学习目标一致 | 生态资料较新，需要自己整理实践经验       | 当前采用           |

## 当前命令使用建议

| 场景                | 命令         |
| ------------------- | ------------ |
| 本地开发            | `pnpm dev`   |
| 检查格式和 lint     | `pnpm check` |
| 自动修复格式和 lint | `pnpm fix`   |
| 运行测试            | `pnpm test`  |
| 生产构建            | `pnpm build` |

在项目根目录可以使用：

```text
pnpm dev:page
pnpm fix:page
pnpm test:page
pnpm build:page
```

## 学习建议

学习顺序建议：

1. 先理解 `package.json` 中的 `vp` 命令。
2. 再看 `vite.config.ts` 中的 dev server、proxy、build、test 配置。
3. 最后再比较传统 ESLint / Prettier / Husky 的职责。

这样可以先建立“项目如何被启动和验证”的整体认知，再深入工具细节。
