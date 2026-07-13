<script setup lang="ts" generic="TRow extends object">
import type { CSSProperties } from "vue";
import type { ComponentSize, TableInstance } from "element-plus";

import { computed, shallowRef, useTemplateRef } from "vue";
import { useFullscreen } from "@vueuse/core";
import { FullScreen, Grid, Refresh, Search } from "@element-plus/icons-vue";

import AdminPagination from "./AdminPagination.vue";
import AdminTableActionButton from "./AdminTableActionButton.vue";
import AdminTablePanel from "./AdminTablePanel.vue";
import type { AdminTableCellContent, AdminTableCellContext, AdminTableColumn } from "./types";

defineOptions({
  inheritAttrs: false,
});

interface AdminDataTableProps<TRow extends object> {
  border?: boolean;
  columns: readonly AdminTableColumn<TRow>[];
  emptyText?: string;
  loading?: boolean;
  minHeight?: string;
  pageSizes?: number[];
  panelLabel?: string;
  rowKey?: ((row: TRow) => string) | string;
  rows: TRow[];
  searchPanelVisible?: boolean;
  selectable?: boolean;
  showDensityTool?: boolean;
  showFullscreenTool?: boolean;
  showPagination?: boolean;
  showRefreshTool?: boolean;
  showSearchTool?: boolean;
  title: string;
  total: number;
  totalLabel?: string;
}

const currentPage = defineModel<number>("currentPage", { required: true });
const pageSize = defineModel<number>("pageSize", { required: true });

const props = withDefaults(defineProps<AdminDataTableProps<TRow>>(), {
  border: true,
  emptyText: "暂无数据",
  loading: false,
  minHeight: "min(680px, calc(100vh - 314px))",
  pageSizes: () => [10, 20, 50, 100],
  panelLabel: undefined,
  rowKey: "id",
  searchPanelVisible: true,
  selectable: false,
  showDensityTool: false,
  showFullscreenTool: false,
  showPagination: true,
  showRefreshTool: false,
  showSearchTool: false,
  totalLabel: "共 {total} 条记录",
});

const emit = defineEmits<{
  refresh: [];
  selectionChange: [rows: TRow[]];
  toggleSearch: [];
}>();

defineSlots<{
  [name: `cell-${string}`]: ((props: AdminTableCellContext<TRow>) => unknown) | undefined;
  empty?: () => unknown;
  selection?: (props: { clearSelection: () => void; rows: TRow[] }) => unknown;
  title?: () => unknown;
  toolbarActions?: () => unknown;
  toolbarTools?: () => unknown;
}>();

const containerRef = useTemplateRef<HTMLDivElement>("containerRef");
const tableRef = useTemplateRef<TableInstance>("tableRef");
const selectedRows = shallowRef<TRow[]>([]);
type TableDensity = Exclude<ComponentSize, "">;

const tableSize = shallowRef<TableDensity>("default");
const { isFullscreen, toggle: toggleFullscreenState } = useFullscreen(containerRef);

const hasToolbar = computed(
  () =>
    props.showSearchTool ||
    props.showRefreshTool ||
    props.showFullscreenTool ||
    props.showDensityTool,
);
const containerStyle = computed<CSSProperties>(() => ({
  "--admin-table-panel-min-height": props.minHeight,
}));
const densityLabel = computed(() => {
  const labels: Record<TableDensity, string> = {
    default: "默认",
    large: "宽松",
    small: "紧凑",
  };

  return `表格密度：${labels[tableSize.value]}`;
});

function handleSelectionChange(rows: TRow[]) {
  selectedRows.value = rows;
  emit("selectionChange", rows);
}

function clearSelection() {
  selectedRows.value = [];
  tableRef.value?.clearSelection();
}

function getCellValue(row: TRow, column: AdminTableColumn<TRow>) {
  return column.field ? row[column.field] : undefined;
}

function getCellContext(
  row: TRow,
  column: AdminTableColumn<TRow>,
  index: number,
): AdminTableCellContext<TRow> {
  return {
    column,
    index,
    row,
    value: getCellValue(row, column),
  };
}

function getCellContent(
  row: TRow,
  column: AdminTableColumn<TRow>,
  index: number,
): AdminTableCellContent {
  const context = getCellContext(row, column, index);

  if (column.formatter) {
    return column.formatter(context);
  }

  if (
    context.value === null ||
    context.value === undefined ||
    typeof context.value === "boolean" ||
    typeof context.value === "number" ||
    typeof context.value === "string"
  ) {
    return context.value;
  }

  return String(context.value);
}

function getCellSlotName(slot: string): `cell-${string}` {
  return `cell-${slot}`;
}

function toggleDensity() {
  const sizes: TableDensity[] = ["small", "default", "large"];
  const currentIndex = sizes.indexOf(tableSize.value);
  tableSize.value = sizes[(currentIndex + 1) % sizes.length] ?? "default";
}

async function toggleFullscreen() {
  await toggleFullscreenState();
}

defineExpose({
  clearSelection,
  tableRef,
  toggleFullscreen,
});
</script>

<template>
  <div
    ref="containerRef"
    class="admin-data-table"
    :class="{ 'is-fullscreen': isFullscreen }"
    :style="containerStyle"
    role="region"
    :aria-label="props.panelLabel ?? props.title"
  >
    <AdminTablePanel :title="props.title">
      <template v-if="$slots.title" #title>
        <slot name="title" />
      </template>

      <template v-if="props.selectable && selectedRows.length > 0" #selection>
        <slot name="selection" :clear-selection="clearSelection" :rows="selectedRows">
          <div class="admin-data-table__selection">
            <span>已选择 {{ selectedRows.length }} 项</span>
            <ElButton link type="primary" @click="clearSelection">清空选择</ElButton>
          </div>
        </slot>
      </template>

      <template v-if="$slots.toolbarActions || $slots.toolbarTools || hasToolbar" #actions>
        <slot name="toolbarActions" />
        <slot name="toolbarTools" />

        <AdminTableActionButton
          v-if="props.showSearchTool"
          :active="props.searchPanelVisible"
          :label="props.searchPanelVisible ? '隐藏查询' : '显示查询'"
          @click="emit('toggleSearch')"
        >
          <Search />
        </AdminTableActionButton>

        <AdminTableActionButton v-if="props.showRefreshTool" label="刷新" @click="emit('refresh')">
          <Refresh />
        </AdminTableActionButton>

        <AdminTableActionButton
          v-if="props.showFullscreenTool"
          :active="isFullscreen"
          :label="isFullscreen ? '退出全屏' : '全屏'"
          @click="toggleFullscreen"
        >
          <FullScreen />
        </AdminTableActionButton>

        <AdminTableActionButton
          v-if="props.showDensityTool"
          :label="densityLabel"
          @click="toggleDensity"
        >
          <Grid />
        </AdminTableActionButton>
      </template>

      <ElTable
        ref="tableRef"
        v-bind="$attrs"
        v-loading="props.loading"
        :border="props.border"
        :data="props.rows"
        :empty-text="props.emptyText"
        height="100%"
        :row-key="props.rowKey"
        :size="tableSize"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <ElTableColumn v-if="props.selectable" align="center" type="selection" width="48" />
        <ElTableColumn
          v-for="column in props.columns"
          :key="column.key"
          :align="column.align"
          :fixed="column.fixed"
          :header-align="column.headerAlign"
          :label="column.label"
          :min-width="column.minWidth"
          :prop="column.field"
          :show-overflow-tooltip="column.showOverflowTooltip"
          :sortable="column.sortable"
          :width="column.width"
        >
          <template #default="{ row, $index }">
            <slot
              v-if="column.slot"
              :name="getCellSlotName(column.slot)"
              :column="column"
              :index="$index"
              :row="row"
              :value="getCellValue(row, column)"
            >
              {{ getCellContent(row, column, $index) }}
            </slot>
            <template v-else>{{ getCellContent(row, column, $index) }}</template>
          </template>
        </ElTableColumn>

        <template v-if="$slots.empty" #empty>
          <slot name="empty" />
        </template>
      </ElTable>

      <template v-if="props.showPagination" #footer>
        <AdminPagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="props.pageSizes"
          :total="props.total"
          :total-label="props.totalLabel"
        />
      </template>
    </AdminTablePanel>
  </div>
</template>

<style scoped>
.admin-data-table {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  background: hsl(var(--card));
}

.admin-data-table.is-fullscreen {
  height: 100vh;
  padding: 16px;
}

.admin-data-table__selection {
  display: flex;
  align-items: center;
  gap: 6px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.admin-data-table :deep(.admin-table-panel) {
  width: 100%;
}
</style>
