<script setup lang="ts">
import { shallowRef, useTemplateRef } from "vue";
import type { TableInstance } from "element-plus";
import { FullScreen, Grid, Plus, Refresh, Search } from "@element-plus/icons-vue";

import type { AdminUserListItem } from "@/api/users";
import AdminPagination from "@/components/common/table/AdminPagination.vue";
import AdminTableActionButton from "@/components/common/table/AdminTableActionButton.vue";
import AdminTablePanel from "@/components/common/table/AdminTablePanel.vue";
import { getUserRemark, getUserStatusLabel } from "@/views/system/users/userFilters";

const props = defineProps<{
  currentPage: number;
  loading?: boolean;
  pageSize: number;
  rows: AdminUserListItem[];
  searchPanelVisible: boolean;
  total: number;
}>();

const emit = defineEmits<{
  addUser: [];
  refresh: [];
  selectionChange: [rows: AdminUserListItem[]];
  toggleDensity: [];
  toggleFullscreen: [];
  toggleSearch: [];
  updateCurrentPage: [page: number];
  updatePageSize: [pageSize: number];
}>();

const tableRef = useTemplateRef<TableInstance>("tableRef");
const selectedRows = shallowRef<AdminUserListItem[]>([]);

function handleSelectionChange(rows: AdminUserListItem[]) {
  selectedRows.value = rows;
  emit("selectionChange", rows);
}

function clearSelection() {
  tableRef.value?.clearSelection();
}

function formatDate(value?: null | string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
</script>

<template>
  <AdminTablePanel title="用户列表">
    <template #selection>
      <div v-if="selectedRows.length > 0" class="user-table__selection">
        <span>已选择 {{ selectedRows.length }} 项</span>
        <ElButton link type="primary" @click="clearSelection">清空选择</ElButton>
      </div>
    </template>

    <template #actions>
      <ElButton :icon="Plus" type="primary" @click="emit('addUser')">新增用户名</ElButton>

      <AdminTableActionButton
        :active="props.searchPanelVisible"
        :label="props.searchPanelVisible ? '隐藏查询' : '显示查询'"
        @click="emit('toggleSearch')"
      >
        <Search />
      </AdminTableActionButton>

      <AdminTableActionButton label="刷新" @click="emit('refresh')">
        <Refresh />
      </AdminTableActionButton>

      <AdminTableActionButton label="全屏" @click="emit('toggleFullscreen')">
        <FullScreen />
      </AdminTableActionButton>

      <AdminTableActionButton label="密度" @click="emit('toggleDensity')">
        <Grid />
      </AdminTableActionButton>
    </template>

    <ElTable
      ref="tableRef"
      class="user-table__grid"
      v-loading="props.loading"
      border
      :data="props.rows"
      empty-text="暂无用户数据"
      height="100%"
      row-key="id"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <ElTableColumn align="center" type="selection" width="48" />
      <ElTableColumn align="center" label="用户名" min-width="180" prop="username" />
      <ElTableColumn align="center" label="用户ID" min-width="120" prop="id" />
      <ElTableColumn align="center" label="状态" min-width="120">
        <template #default>
          <ElTag effect="light" type="success">{{ getUserStatusLabel() }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn align="center" label="备注" min-width="200">
        <template #default="{ row }">
          <span>{{ getUserRemark(row) }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn align="center" label="创建时间" min-width="180">
        <template #default="{ row }">
          <span>{{ formatDate(row.created_at) }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn align="center" fixed="right" label="操作" width="150">
        <template #default>
          <ElTooltip content="编辑功能将在 CRUD 阶段接入" placement="top">
            <span>
              <ElButton disabled link type="primary">编辑</ElButton>
            </span>
          </ElTooltip>
          <ElTooltip content="删除功能将在 CRUD 阶段接入" placement="top">
            <span>
              <ElButton disabled link type="danger">删除</ElButton>
            </span>
          </ElTooltip>
        </template>
      </ElTableColumn>
    </ElTable>

    <template #footer>
      <AdminPagination
        :current-page="props.currentPage"
        :page-size="props.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="props.total"
        @update:current-page="emit('updateCurrentPage', $event)"
        @update:page-size="emit('updatePageSize', $event)"
      />
    </template>
  </AdminTablePanel>
</template>

<style scoped>
.user-table__selection {
  display: flex;
  align-items: center;
  gap: 6px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}
</style>
