<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ArrowRight } from "@element-plus/icons-vue";

import { resolveMenuIcon } from "@/components/layout/menu-icons";

const route = useRoute();

const breadcrumbItems = computed(() =>
  route.matched
    .filter((record) => record.meta.title)
    .map((record) => ({
      icon: typeof record.meta.icon === "string" ? record.meta.icon : undefined,
      path: record.path,
      title: String(record.meta.title),
    })),
);
</script>

<template>
  <ElBreadcrumb class="admin-breadcrumb" :separator-icon="ArrowRight">
    <ElBreadcrumbItem
      v-for="(item, index) in breadcrumbItems"
      :key="`${item.path}-${item.title}`"
      :to="index < breadcrumbItems.length - 1 ? item.path : undefined"
    >
      <span class="admin-breadcrumb__item">
        <ElIcon class="admin-breadcrumb__icon">
          <component :is="resolveMenuIcon(item.icon)" />
        </ElIcon>
        <span class="admin-breadcrumb__text">{{ item.title }}</span>
      </span>
    </ElBreadcrumbItem>
  </ElBreadcrumb>
</template>

<style scoped>
.admin-breadcrumb {
  min-width: 0;
  line-height: 22px;
}

.admin-breadcrumb__item {
  display: inline-flex;
  max-width: 180px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-breadcrumb__icon {
  flex: 0 0 auto;
  font-size: 16px;
}

.admin-breadcrumb__text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-breadcrumb :deep(.el-breadcrumb__inner.is-link) .admin-breadcrumb__item {
  color: hsl(var(--primary));
}

.admin-breadcrumb :deep(.el-breadcrumb__inner.is-link:hover) .admin-breadcrumb__item {
  color: hsl(var(--primary));
}

.admin-breadcrumb :deep(.el-breadcrumb__item:last-child .admin-breadcrumb__item) {
  color: hsl(var(--foreground));
}
</style>
