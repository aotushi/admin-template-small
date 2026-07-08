<script setup lang="ts">
import { shallowRef } from "vue";
import { Grid, Refresh } from "@element-plus/icons-vue";

import AdminPagination from "@/components/common/table/AdminPagination.vue";
import AdminTableActionButton from "@/components/common/table/AdminTableActionButton.vue";
import AdminTablePanel from "@/components/common/table/AdminTablePanel.vue";
import CommonExampleCard from "@/views/components/examples/CommonExampleCard.vue";

interface TableRow {
  component: string;
  owner: string;
  status: string;
  updatedAt: string;
}

const currentPage = shallowRef(1);
const pageSize = shallowRef(10);

const rows: TableRow[] = [
  {
    component: "AdminTablePanel",
    owner: "系统管理",
    status: "已接入",
    updatedAt: "2026-07-08",
  },
  {
    component: "AdminTableActionButton",
    owner: "系统管理",
    status: "已接入",
    updatedAt: "2026-07-08",
  },
  {
    component: "AdminPagination",
    owner: "系统管理",
    status: "已接入",
    updatedAt: "2026-07-08",
  },
];
</script>

<template>
  <CommonExampleCard title="基础表格">
    <AdminTablePanel title="基础表格">
      <template #actions>
        <AdminTableActionButton label="刷新">
          <Refresh />
        </AdminTableActionButton>
        <AdminTableActionButton active label="密度">
          <Grid />
        </AdminTableActionButton>
      </template>

      <ElTable :data="rows" row-key="component">
        <ElTableColumn label="组件名称" min-width="180" prop="component" />
        <ElTableColumn label="归属模块" min-width="140" prop="owner" />
        <ElTableColumn label="状态" min-width="120" prop="status">
          <template #default="{ row }: { row: TableRow }">
            <ElTag effect="light" type="success">{{ row.status }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="更新时间" min-width="140" prop="updatedAt" />
      </ElTable>

      <template #footer>
        <AdminPagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="rows.length"
        />
      </template>
    </AdminTablePanel>
  </CommonExampleCard>
</template>

<style scoped>
:deep(.admin-table-panel) {
  min-height: 360px;
}
</style>
