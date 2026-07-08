<script setup lang="ts">
import { computed } from "vue";

import { hasAnyRole } from "@/auth/rbac";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const user = computed(() => authStore.currentUser);
const accessRole = computed(() => authStore.accessRole ?? "-");

const metrics = [
  {
    label: "今日请求",
    trend: "+12.8%",
    value: "18,420",
  },
  {
    label: "上传文件",
    trend: "+4",
    value: "126",
  },
  {
    label: "活跃用户",
    trend: "+9.1%",
    value: "2,418",
  },
  {
    label: "待处理报告",
    trend: "8",
    value: "34",
  },
];

const quickActions = computed(() =>
  [
    {
      description: "导入 Excel 并生成可查询数据",
      path: "/excel/upload",
      roles: ["super", "admin"] as const,
      title: "文件上传",
    },
    {
      description: "查看每日和历史统计结果",
      path: "/statistics/daily",
      roles: ["super", "admin"] as const,
      title: "数据统计",
    },
    {
      description: "维护用户、角色和权限边界",
      path: "/system/users",
      roles: ["super", "admin"] as const,
      title: "用户管理",
    },
    {
      description: "查看个人 API Key 和接口说明",
      path: "/api/my-keys",
      roles: ["super", "admin", "user"] as const,
      title: "API 文档",
    },
  ].filter((action) => hasAnyRole(user.value, action.roles)),
);
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-page__header">
      <div>
        <p class="dashboard-page__eyebrow">Admin Backend 3</p>
        <h2 class="dashboard-page__title">概览</h2>
        <p class="dashboard-page__description">
          当前首页用于承接旧项目前端的主要业务入口，并验证菜单、路由和 RBAC 主线。
        </p>
      </div>

      <dl class="dashboard-user">
        <div>
          <dt>用户</dt>
          <dd>{{ user?.username || "-" }}</dd>
        </div>
        <div>
          <dt>访问角色</dt>
          <dd>{{ accessRole }}</dd>
        </div>
        <div>
          <dt>后端角色</dt>
          <dd>{{ user?.role || "-" }}</dd>
        </div>
      </dl>
    </section>

    <section class="dashboard-metrics" aria-label="关键指标">
      <article v-for="metric in metrics" :key="metric.label" class="dashboard-metric">
        <span class="dashboard-metric__label">{{ metric.label }}</span>
        <strong class="dashboard-metric__value">{{ metric.value }}</strong>
        <span class="dashboard-metric__trend">{{ metric.trend }}</span>
      </article>
    </section>

    <section class="dashboard-grid">
      <div class="dashboard-panel">
        <header class="dashboard-panel__header">
          <h3 class="dashboard-panel__title">快捷入口</h3>
          <span class="dashboard-panel__hint">按当前角色过滤</span>
        </header>

        <div class="dashboard-actions">
          <RouterLink
            v-for="action in quickActions"
            :key="action.path"
            class="dashboard-action"
            :to="action.path"
          >
            <strong>{{ action.title }}</strong>
            <span>{{ action.description }}</span>
          </RouterLink>
        </div>
      </div>

      <div class="dashboard-panel">
        <header class="dashboard-panel__header">
          <h3 class="dashboard-panel__title">当前阶段</h3>
          <span class="dashboard-panel__hint">v1</span>
        </header>

        <ol class="dashboard-timeline">
          <li class="is-done">登录、双 Token 和会话恢复</li>
          <li class="is-done">静态路由、菜单派生和 RBAC 守卫</li>
          <li class="is-active">后台布局、侧边栏和顶部工具区</li>
          <li>旧业务页面逐页迁移</li>
        </ol>
      </div>
    </section>
  </main>
</template>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 16px;
}

.dashboard-page__header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 20px;
  box-shadow: 0 10px 28px rgb(15 23 42 / 5%);
}

.dark .dashboard-page__header,
.dark .dashboard-panel,
.dark .dashboard-metric {
  border-color: hsl(var(--border));
  background: hsl(var(--card));
}

.dashboard-page__eyebrow {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
}

.dashboard-page__title {
  margin: 0;
  color: #111827;
  font-size: 24px;
  line-height: 32px;
}

.dark .dashboard-page__title,
.dark .dashboard-panel__title,
.dark .dashboard-metric__value,
.dark .dashboard-action strong {
  color: hsl(var(--foreground));
}

.dashboard-page__description {
  max-width: 640px;
  margin: 8px 0 0;
  color: #4b5563;
  font-size: 15px;
  line-height: 1.7;
}

.dashboard-user {
  display: grid;
  width: min(320px, 100%);
  gap: 8px;
  margin: 0;
  border-left: 1px solid #eef2f7;
  padding-left: 20px;
}

.dashboard-user div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-user dt {
  color: #6b7280;
  font-size: 14px;
}

.dashboard-user dd {
  margin: 0;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.dashboard-metric,
.dashboard-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgb(15 23 42 / 5%);
}

.dashboard-metric {
  display: grid;
  gap: 8px;
  padding: 18px;
}

.dashboard-metric__label,
.dashboard-panel__hint,
.dashboard-action span,
.dashboard-timeline li,
.dark .dashboard-page__description,
.dark .dashboard-user dt {
  color: hsl(var(--muted-foreground));
}

.dashboard-metric__label {
  font-size: 13px;
}

.dashboard-metric__value {
  color: #111827;
  font-size: 26px;
  line-height: 32px;
}

.dashboard-metric__trend {
  width: fit-content;
  border-radius: 999px;
  color: #047857;
  background: #d1fae5;
  padding: 2px 8px;
  font-size: 12px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 16px;
}

.dashboard-panel {
  min-width: 0;
  padding: 18px;
}

.dashboard-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.dashboard-panel__title {
  margin: 0;
  color: #111827;
  font-size: 16px;
  line-height: 24px;
}

.dashboard-panel__hint {
  font-size: 12px;
}

.dashboard-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.dashboard-action {
  display: grid;
  gap: 6px;
  min-height: 86px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 14px;
}

.dashboard-action:hover {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 7%);
}

.dashboard-action strong {
  color: #111827;
  font-size: 14px;
  line-height: 20px;
}

.dashboard-action span {
  font-size: 13px;
  line-height: 20px;
}

.dashboard-timeline {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dashboard-timeline li {
  position: relative;
  padding-left: 18px;
  font-size: 14px;
  line-height: 20px;
}

.dashboard-timeline li::before {
  position: absolute;
  top: 7px;
  left: 0;
  width: 7px;
  height: 7px;
  background: hsl(var(--border));
  border-radius: 999px;
  content: "";
}

.dashboard-timeline li.is-done::before {
  background: #22c55e;
}

.dashboard-timeline li.is-active {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.dashboard-timeline li.is-active::before {
  background: hsl(var(--primary));
}

@media (max-width: 1100px) {
  .dashboard-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .dashboard-page__header {
    display: grid;
  }

  .dashboard-user {
    width: 100%;
    border-top: 1px solid #eef2f7;
    border-left: 0;
    padding-top: 14px;
    padding-left: 0;
  }

  .dashboard-metrics,
  .dashboard-actions {
    grid-template-columns: 1fr;
  }
}
</style>
