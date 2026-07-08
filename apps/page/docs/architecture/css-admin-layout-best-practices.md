# 后台面板 CSS 布局最佳实践

## 1. 结论

后台管理面板的整体 CSS 布局推荐使用：

```text
CSS Grid 负责整体面板壳
Flex 负责局部横向 / 纵向排列
CSS 变量负责尺寸状态切换
内容区负责滚动
```

当前项目已经采用这个方向改造 `apps/page` 的后台主布局。

## 2. 为什么整体壳用 Grid

后台管理面板不是单列页面，而是稳定的二维结构：

```text
左侧菜单
顶部栏
内容区
```

用 Grid 表达会比 `fixed + margin-left` 更直接。

推荐结构：

```css
.admin-layout {
  --admin-sidebar-width: 232px;
  --admin-header-height: 56px;

  display: grid;
  height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);
  grid-template-rows: var(--admin-header-height) minmax(0, 1fr);
  grid-template-areas:
    "sidebar header"
    "sidebar content";
}

.admin-layout__sidebar {
  grid-area: sidebar;
}

.admin-layout__header {
  grid-area: header;
}

.admin-layout__content {
  grid-area: content;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
```

## 3. 为什么不用 fixed + margin-left

`fixed + margin-left` 可以快速实现后台布局，但它有明显问题：

| 问题             | 说明                                               |
| ---------------- | -------------------------------------------------- |
| 布局关系不集中   | 侧边栏脱离文档流，主内容区还要手动写 `margin-left` |
| 折叠状态容易散落 | 侧边栏宽度、内容区偏移、移动端宽度需要分别维护     |
| 响应式成本更高   | 窄屏时容易出现菜单遮挡、内容挤压、滚动异常         |
| 滚动边界不清晰   | 容易让 `body`、内容区、侧边栏同时参与滚动          |

Grid 方式把布局关系集中在一个父容器中，侧边栏、顶部栏、内容区都在同一个布局模型里。

## 4. 当前项目中的实现

当前项目实现位置：

| 文件                                     | 职责                                     |
| ---------------------------------------- | ---------------------------------------- |
| `src/layouts/MainLayout.vue`             | 定义后台 Grid 壳、布局区域、折叠状态     |
| `src/components/layout/AdminSidebar.vue` | 作为 Grid 的 sidebar 区域，渲染菜单      |
| `src/components/layout/AdminTopbar.vue`  | 作为 Grid 的 header 区域，渲染顶部工具区 |

当前主布局：

```text
admin-layout
  admin-layout__sidebar  -> 左侧菜单
  admin-layout__header   -> 顶部栏
  admin-layout__content  -> 页面内容与滚动容器
```

## 5. 折叠侧边栏的最佳实践

折叠状态不要同时修改多个位置，应该只改一个 CSS 变量：

```css
.admin-layout {
  --admin-sidebar-width: 232px;
}

.admin-layout.is-collapsed {
  --admin-sidebar-width: 64px;
}
```

这样 Grid 会自动重新计算：

```css
grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);
```

当前项目中，桌面端点击顶部栏按钮可以切换折叠状态；窄屏下侧边栏默认收起。

## 6. minmax(0, 1fr) 和 min-width: 0

后台项目非常容易出现宽内容：

```text
表格
代码
API Key
邮箱
长文件名
图表
```

如果只写 `1fr`，内容可能撑开布局。推荐写法是：

```css
grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);
```

内容区也必须加：

```css
.admin-layout__content {
  min-width: 0;
  min-height: 0;
}
```

这能避免内容区把整个后台壳撑爆。

## 7. 滚动区应该放在哪里

后台管理推荐让内容区滚动，而不是整个 `body` 滚动：

```css
.admin-layout {
  height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
}

.admin-layout__content {
  overflow: auto;
}
```

这样：

| 区域   | 行为                 |
| ------ | -------------------- |
| 侧边栏 | 稳定停留，可内部滚动 |
| 顶部栏 | 稳定停留             |
| 内容区 | 独立滚动             |

这更符合后台工作台的使用习惯。

## 8. Flex 的使用边界

Grid 负责外层二维布局，Flex 负责局部一维布局。

适合 Flex 的地方：

```text
顶部栏左右分布
按钮组
用户头像与文字
表单项内部排列
卡片头部标题与操作按钮
```

示例：

```css
.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

不要用 Flex 硬写整个后台三段式布局，因为 Flex 更适合一维排列。

## 9. 页面内容区布局建议

后台页面内部继续使用 Grid / Flex 组合。

### 9.1 指标卡片

```css
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
```

### 9.2 查询表单

```css
.search-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
```

### 9.3 表格容器

```css
.table-wrap {
  min-width: 0;
  overflow-x: auto;
}
```

表格不能直接裸放在页面里，否则长列会撑破内容区。

## 10. 当前项目后续要求

后续迁移旧项目页面时，旧项目只提供业务数据和逻辑，页面 CSS 不沿用旧实现。最终布局应按 Vben 案例项目的视觉结构重新拆解，并遵守以下约定：

| 场景       | 推荐布局                                     |
| ---------- | -------------------------------------------- |
| 后台主壳   | CSS Grid                                     |
| 顶部栏     | Flex                                         |
| 侧边栏菜单 | 固定 Grid 区域，不使用 `position: fixed`     |
| 内容区     | `overflow: auto`，并设置 `min-width: 0`      |
| 指标区     | `repeat(auto-fit, minmax(...))`              |
| 查询区     | Grid 优先，少量按钮组用 Flex                 |
| 表格区     | 外包滚动容器，避免撑开页面                   |
| 折叠状态   | CSS 变量控制，不在多个元素上重复写偏移和宽度 |

## 11. 当前结论

当前项目的后台布局应保持：

```text
外层：Grid
局部：Flex
尺寸：CSS 变量
滚动：内容区独立滚动
响应式：窄屏默认折叠侧边栏
```

这个方案比 `fixed + margin-left` 更适合长期维护，也更适合后续加入标签栏、面包屑、内容缓存、移动端抽屉等能力。
