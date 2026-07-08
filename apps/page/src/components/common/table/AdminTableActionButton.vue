<script setup lang="ts">
const props = defineProps<{
  active?: boolean;
  label: string;
}>();

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

defineSlots<{
  default?: () => unknown;
}>();
</script>

<template>
  <ElTooltip :content="props.label" placement="top">
    <button
      class="admin-table-action-button"
      :class="{ 'is-active': props.active }"
      type="button"
      :aria-label="props.label"
      @click="emit('click', $event)"
    >
      <ElIcon>
        <slot />
      </ElIcon>
    </button>
  </ElTooltip>
</template>

<style scoped>
.admin-table-action-button {
  display: inline-grid;
  width: 32px;
  height: 32px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 50%;
  place-items: center;
}

.admin-table-action-button:hover,
.admin-table-action-button.is-active {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.admin-table-action-button .el-icon {
  font-size: 17px;
}
</style>
