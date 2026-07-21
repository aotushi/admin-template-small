<script setup lang="ts">
import { shallowRef } from "vue";

import { AdminDataTable } from "@/components/common";
import type { AdminTableColumn } from "@/components/common";
import CommonExampleCard from "@/views/showcase/examples/CommonExampleCard.vue";

interface TableRow {
  component: string;
  owner: string;
  status: string;
  updatedAt: string;
}

const currentPage = shallowRef(1);
const pageSize = shallowRef(10);

const columns = [
  { field: "component", key: "component", label: "组件名称", minWidth: 180 },
  { field: "owner", key: "owner", label: "归属分类", minWidth: 140 },
  { key: "status", label: "状态", minWidth: 120, slot: "status" },
  { field: "updatedAt", key: "updatedAt", label: "更新时间", minWidth: 140 },
] satisfies AdminTableColumn<TableRow>[];

const rows: TableRow[] = [
  {
    component: "AdminDataTable",
    owner: "表格",
    status: "已接入",
    updatedAt: "2026-07-13",
  },
  {
    component: "AdminSearchPanel",
    owner: "表单",
    status: "已接入",
    updatedAt: "2026-07-13",
  },
  {
    component: "AdminTreePanel",
    owner: "树形筛选",
    status: "已接入",
    updatedAt: "2026-07-13",
  },
];
</script>

<template>
  <CommonExampleCard title="基础表格">
    <AdminDataTable
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :columns="columns"
      min-height="360px"
      :rows="rows"
      show-density-tool
      show-fullscreen-tool
      title="基础表格"
      :total="rows.length"
    >
      <template #cell-status="{ row }: { row: TableRow }">
        <ElTag effect="light" type="success">{{ row.status }}</ElTag>
      </template>
    </AdminDataTable>
  </CommonExampleCard>
</template>
