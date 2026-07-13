<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    labelWidth?: string;
    panelLabel: string;
  }>(),
  {
    labelWidth: "72px",
  },
);

defineSlots<{
  default?: () => unknown;
}>();
</script>

<template>
  <section class="admin-search-panel" :aria-label="props.panelLabel">
    <ElForm class="admin-search-panel__form" label-position="right" :label-width="props.labelWidth">
      <slot />
    </ElForm>
  </section>
</template>

<style scoped>
.admin-search-panel {
  background: hsl(var(--card));
  border-radius: 6px;
  padding: 20px 24px;
}

.admin-search-panel__form {
  display: grid;
  align-items: center;
  column-gap: 28px;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  row-gap: 12px;
}

.admin-search-panel :deep(.el-form-item) {
  margin: 0;
}

.admin-search-panel :deep(.el-form-item__label) {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 1180px) {
  .admin-search-panel__form {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}

@media (max-width: 760px) {
  .admin-search-panel {
    padding: 16px;
  }

  .admin-search-panel__form {
    grid-template-columns: 1fr;
  }
}
</style>
