<script setup lang="ts">
const props = defineProps<{
  title: string;
}>();

defineSlots<{
  default?: () => unknown;
  extra?: () => unknown;
}>();
</script>

<template>
  <ElCard class="common-example-card" shadow="never">
    <template #header>
      <div class="common-example-card__header">
        <span class="common-example-card__title">{{ props.title }}</span>
        <slot name="extra" />
      </div>
    </template>

    <slot />
  </ElCard>
</template>

<style scoped>
.common-example-card {
  --el-card-bg-color: hsl(var(--card));
  --el-card-border-color: hsl(var(--border));

  border-radius: 6px;
}

.common-example-card :deep(.el-card__header) {
  padding: 14px 16px;
}

.common-example-card :deep(.el-card__body) {
  padding: 16px;
}

.common-example-card__header {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.common-example-card__title {
  color: hsl(var(--foreground));
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}
</style>
