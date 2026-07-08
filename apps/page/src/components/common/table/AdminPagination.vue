<script setup lang="ts">
import { computed } from "vue";
import { useMediaQuery } from "@vueuse/core";

const currentPage = defineModel<number>("currentPage", { required: true });
const pageSize = defineModel<number>("pageSize", { required: true });

const props = withDefaults(
  defineProps<{
    pageSizes?: number[];
    total: number;
    totalLabel?: string;
  }>(),
  {
    pageSizes: () => [10, 20, 50, 100],
    totalLabel: "共 {total} 条记录",
  },
);

const isCompact = useMediaQuery("(max-width: 768px)");

const layout = computed(() => (isCompact.value ? "prev, pager, next" : "sizes, prev, pager, next"));

const totalText = computed(() => props.totalLabel.replace("{total}", String(props.total)));
</script>

<template>
  <footer class="admin-pagination" aria-label="分页">
    <span class="admin-pagination__total">{{ totalText }}</span>
    <ElPagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      background
      class="admin-pagination__control"
      :layout="layout"
      :page-sizes="props.pageSizes"
      :small="isCompact"
      :total="props.total"
    />
  </footer>
</template>

<style scoped>
.admin-pagination {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid hsl(var(--border));
  padding: 10px 12px;
}

.admin-pagination__total {
  flex-shrink: 0;
  color: hsl(var(--foreground) / 72%);
  font-size: 13px;
  line-height: 20px;
}

.admin-pagination__control {
  --el-pagination-bg-color: transparent;
  --el-pagination-button-bg-color: hsl(var(--background));
  --el-pagination-button-color: hsl(var(--foreground) / 72%);
  --el-pagination-button-disabled-bg-color: hsl(var(--background));
  --el-pagination-button-disabled-color: hsl(var(--foreground) / 38%);
  --el-pagination-font-size: 13px;
  --el-pagination-hover-color: hsl(var(--primary));

  flex: 1;
  justify-content: flex-end;
}

.admin-pagination :deep(.el-pagination__sizes) {
  margin-right: auto;
}

.admin-pagination :deep(.btn-prev),
.admin-pagination :deep(.btn-next),
.admin-pagination :deep(.el-pager li) {
  min-width: 28px;
  height: 28px;
  color: hsl(var(--foreground) / 72%);
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.admin-pagination :deep(.btn-prev:hover),
.admin-pagination :deep(.btn-next:hover),
.admin-pagination :deep(.el-pager li:hover) {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.admin-pagination :deep(.el-pager li.is-active) {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
  font-weight: 700;
}

.admin-pagination :deep(.btn-prev.is-disabled),
.admin-pagination :deep(.btn-next.is-disabled) {
  color: hsl(var(--foreground) / 32%);
  background: hsl(var(--background));
  border-color: hsl(var(--border));
}

.admin-pagination :deep(.el-select__wrapper) {
  min-height: 28px;
  background: hsl(var(--input-background));
  box-shadow: 0 0 0 1px hsl(var(--border)) inset;
}

@media (max-width: 768px) {
  .admin-pagination {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-pagination__control {
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
