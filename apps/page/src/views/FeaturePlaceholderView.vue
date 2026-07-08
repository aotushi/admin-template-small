<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const title = computed(() => route.meta.title ?? "待实现页面");
const permissions = computed(() => route.meta.permissions ?? []);
</script>

<template>
  <main class="feature-placeholder">
    <section class="feature-placeholder__panel">
      <p class="feature-placeholder__eyebrow">Planned Feature</p>
      <h1 class="feature-placeholder__title">{{ title }}</h1>
      <p class="feature-placeholder__description">
        当前路由已经接入菜单规划和 RBAC 守卫，页面内容将在对应业务模块迁移时实现。
      </p>

      <div v-if="permissions.length" class="feature-placeholder__permissions">
        <span v-for="permission in permissions" :key="permission">{{ permission }}</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.feature-placeholder {
  min-height: calc(100vh - 88px);
}

.feature-placeholder__panel {
  width: min(720px, 100%);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 32px;
  box-shadow: 0 18px 45px rgb(15 23 42 / 8%);
}

.dark .feature-placeholder__panel {
  border-color: hsl(var(--border));
  background: hsl(var(--card));
}

.feature-placeholder__eyebrow {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
}

.feature-placeholder__title {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.2;
}

.dark .feature-placeholder__title {
  color: hsl(var(--foreground));
}

.feature-placeholder__description {
  margin: 12px 0 0;
  color: #4b5563;
  font-size: 15px;
  line-height: 1.7;
}

.dark .feature-placeholder__description {
  color: hsl(var(--muted-foreground));
}

.feature-placeholder__permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}

.feature-placeholder__permissions span {
  border-radius: 6px;
  color: #1d4ed8;
  background: #dbeafe;
  padding: 4px 8px;
  font-size: 12px;
}
</style>
