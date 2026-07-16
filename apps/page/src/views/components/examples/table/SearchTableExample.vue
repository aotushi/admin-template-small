<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue";

import { AdminDataTable, AdminSearchForm } from "@/components/common";
import type { AdminFormField, AdminFormModel, AdminTableColumn } from "@/components/common";
import CommonExampleCard from "@/views/components/examples/CommonExampleCard.vue";

interface TableRow {
  component: string;
  scene: string;
  status: "draft" | "ready";
  type: string;
}

const currentPage = shallowRef(1);
const pageSize = shallowRef(10);
const searchPanelVisible = shallowRef(true);

const columns = [
  { field: "component", key: "component", label: "组件名称", minWidth: 180 },
  { field: "type", key: "type", label: "类型", minWidth: 140 },
  { field: "scene", key: "scene", label: "使用场景", minWidth: 220 },
  { key: "status", label: "接入状态", minWidth: 120, slot: "status" },
] satisfies AdminTableColumn<TableRow>[];

const searchFields: AdminFormField[] = [
  { component: "input", key: "keyword", label: "组件名称" },
  {
    component: "select",
    key: "status",
    label: "接入状态",
    options: [
      { label: "已接入", value: "ready" },
      { label: "规划中", value: "draft" },
    ],
  },
];

// 查询表单点"搜索"后才把值应用到列表筛选，与业务页的查询流程一致
const filters = reactive({
  keyword: "",
  status: "",
});

function applyFilters(values: AdminFormModel) {
  filters.keyword = String(values.keyword ?? "");
  filters.status = String(values.status ?? "");
}

const rows: TableRow[] = [
  {
    component: "AdminDataTable",
    scene: "用户管理 / 列表区",
    status: "ready",
    type: "生产表格",
  },
  {
    component: "AdminSearchForm",
    scene: "用户管理 / 筛选区",
    status: "ready",
    type: "查询表单",
  },
  {
    component: "AdminTreePanel",
    scene: "用户管理 / 部门筛选",
    status: "ready",
    type: "树形筛选",
  },
  {
    component: "AdminFormDrawer",
    scene: "系统管理 / 新增编辑抽屉",
    status: "ready",
    type: "抽屉表单",
  },
];

const visibleRows = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase();

  return rows.filter((row) => {
    const keywordMatched =
      !keyword ||
      row.component.toLowerCase().includes(keyword) ||
      row.scene.toLowerCase().includes(keyword);
    const statusMatched = !filters.status || row.status === filters.status;

    return keywordMatched && statusMatched;
  });
});
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return visibleRows.value.slice(start, start + pageSize.value);
});

watch([() => filters.keyword, () => filters.status, pageSize], () => {
  currentPage.value = 1;
});
</script>

<template>
  <CommonExampleCard title="搜索表格">
    <div class="search-table-example">
      <AdminSearchForm
        v-show="searchPanelVisible"
        :fields="searchFields"
        panel-label="搜索表格筛选"
        @reset="applyFilters"
        @search="applyFilters"
      />

      <AdminDataTable
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :columns="columns"
        min-height="380px"
        :rows="pagedRows"
        :search-panel-visible="searchPanelVisible"
        show-density-tool
        show-fullscreen-tool
        show-search-tool
        title="搜索结果"
        :total="visibleRows.length"
        @toggle-search="searchPanelVisible = !searchPanelVisible"
      >
        <template #cell-status="{ row }: { row: TableRow }">
          <ElTag :type="row.status === 'ready' ? 'success' : 'info'" effect="light">
            {{ row.status === "ready" ? "已接入" : "规划中" }}
          </ElTag>
        </template>
      </AdminDataTable>
    </div>
  </CommonExampleCard>
</template>

<style scoped>
.search-table-example {
  display: grid;
  gap: 16px;
}
</style>
