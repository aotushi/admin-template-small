<script setup lang="ts">
const props = defineProps<{
  title: string;
}>();

defineSlots<{
  actions?: () => unknown;
  default?: () => unknown;
  footer?: () => unknown;
  selection?: () => unknown;
  title?: () => unknown;
}>();
</script>

<template>
  <section class="admin-table-panel">
    <div class="admin-table-panel__toolbar">
      <div class="admin-table-panel__title-group">
        <slot name="title">
          <h2 class="admin-table-panel__title">{{ props.title }}</h2>
        </slot>
        <slot name="selection" />
      </div>

      <div v-if="$slots.actions" class="admin-table-panel__actions">
        <slot name="actions" />
      </div>
    </div>

    <div class="admin-table-panel__body">
      <slot />
    </div>

    <slot name="footer" />
  </section>
</template>

<style scoped>
.admin-table-panel {
  display: flex;
  min-height: min(680px, calc(100vh - 314px));
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--card));
  border-radius: 6px;
}

.admin-table-panel__toolbar {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid hsl(var(--border));
  padding: 10px 12px;
}

.admin-table-panel__title-group {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.admin-table-panel__title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.admin-table-panel__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.admin-table-panel__body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.admin-table-panel :deep(.el-table) {
  --el-table-bg-color: hsl(var(--card));
  --el-table-border-color: hsl(var(--border));
  --el-table-current-row-bg-color: hsl(var(--accent));
  --el-table-header-bg-color: hsl(var(--secondary));
  --el-table-header-text-color: hsl(var(--foreground));
  --el-table-row-hover-bg-color: hsl(var(--accent));
  --el-table-text-color: hsl(var(--foreground));
  --el-table-tr-bg-color: hsl(var(--card));
  flex: 1;
  min-height: 0;
}

.admin-table-panel :deep(.el-table__header-wrapper th) {
  height: 46px;
  font-size: 14px;
  font-weight: 650;
}

.admin-table-panel :deep(.el-table__cell) {
  border-color: hsl(var(--border));
}

@media (max-width: 820px) {
  .admin-table-panel__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-table-panel__actions {
    flex-wrap: wrap;
  }
}
</style>
