<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue";

import { AdminDataTable, AdminSearchPanel } from "@/components/common";
import type { AdminTableColumn } from "@/components/common";
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

const filters = reactive({
  keyword: "",
  status: "",
});

const rows: TableRow[] = [
  {
    component: "AdminDataTable",
    scene: "用户管理 / 列表区",
    status: "ready",
    type: "生产表格",
  },
  {
    component: "AdminSearchPanel",
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
    component: "ColumnSetting",
    scene: "后续表格增强",
    status: "draft",
    type: "列配置",
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

function handleReset() {
  filters.keyword = "";
  filters.status = "";
}
</script>

<template>
  <CommonExampleCard title="搜索表格">
    <div class="search-table-example">
      <AdminSearchPanel v-show="searchPanelVisible" label-width="88px" panel-label="搜索表格筛选">
        <ElFormItem label="组件名称">
          <ElInput v-model="filters.keyword" clearable placeholder="请输入" />
        </ElFormItem>

        <ElFormItem label="接入状态">
          <ElSelect v-model="filters.status" clearable placeholder="请选择">
            <ElOption label="已接入" value="ready" />
            <ElOption label="规划中" value="draft" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem class="search-table-example__actions" label=" ">
          <ElButton @click="handleReset">重 置</ElButton>
          <ElButton type="primary">搜 索</ElButton>
        </ElFormItem>
      </AdminSearchPanel>

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

.search-table-example__actions :deep(.el-form-item__content) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
