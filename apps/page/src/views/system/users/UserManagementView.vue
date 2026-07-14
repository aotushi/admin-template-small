<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import { Plus } from "@element-plus/icons-vue";

import type { AdminUserListItem } from "@/api/modules/users";
import { getApiErrorMessage } from "@/api/request";
import { AdminDataTable } from "@/components/common";
import { useDepartmentsTreeQuery, useUsersListQuery } from "@/queries/users";
import UserDepartmentPanel from "./components/UserDepartmentPanel.vue";
import UserSearchPanel from "./components/UserSearchPanel.vue";
import type { UserFilters } from "./types";
import { ALL_DEPARTMENTS_KEY, getSelectedDepartmentIds } from "./departmentTree";
import {
  createDefaultUserFilters,
  filterUsers,
  getUserRoleLabel,
  getUserRoleTagType,
  getUserStatusLabel,
  paginateUsers,
} from "./userFilters";
import { userTableColumns } from "./userTableColumns";

const usersQuery = useUsersListQuery();
const departmentsQuery = useDepartmentsTreeQuery();
const filters = reactive<UserFilters>(createDefaultUserFilters());
const currentPage = shallowRef(1);
const pageSize = shallowRef(10);
const selectedDepartmentKey = shallowRef(ALL_DEPARTMENTS_KEY);
const selectedUsers = shallowRef<AdminUserListItem[]>([]);
const searchPanelVisible = shallowRef(true);

const users = computed(() => usersQuery.data.value ?? []);
const departments = computed(() => departmentsQuery.data.value ?? []);
const selectedDepartmentIds = computed(() =>
  getSelectedDepartmentIds(departments.value, selectedDepartmentKey.value),
);
const filteredUsers = computed(() =>
  filterUsers(users.value, filters, selectedDepartmentIds.value),
);
const pagedUsers = computed(() =>
  paginateUsers(filteredUsers.value, {
    page: currentPage.value,
    pageSize: pageSize.value,
  }),
);
const isFetching = computed(
  () =>
    usersQuery.asyncStatus.value === "loading" || departmentsQuery.asyncStatus.value === "loading",
);
const errorMessage = computed(() =>
  usersQuery.error.value ? getApiErrorMessage(usersQuery.error.value) : "",
);
const departmentErrorMessage = computed(() =>
  departmentsQuery.error.value ? getApiErrorMessage(departmentsQuery.error.value) : "",
);

watch(
  () => [
    filters.createdRange.join("|"),
    filters.role,
    filters.status,
    filters.userId,
    filters.username,
  ],
  () => {
    currentPage.value = 1;
  },
);

watch(pageSize, () => {
  currentPage.value = 1;
});

watch(selectedDepartmentKey, () => {
  currentPage.value = 1;
});

function updateFilters(nextFilters: Partial<UserFilters>) {
  Object.assign(filters, nextFilters);
}

function resetFilters() {
  Object.assign(filters, createDefaultUserFilters());
}

function refreshUsers() {
  void usersQuery.refetch();
  void departmentsQuery.refetch();
}

function handleQuery() {
  currentPage.value = 1;
}

function handleSelectionChange(rows: AdminUserListItem[]) {
  selectedUsers.value = rows;
}

function toggleSearchPanel() {
  searchPanelVisible.value = !searchPanelVisible.value;
}

function showDeferredFeature(featureName: string) {
  ElMessage.info(`${featureName}将在 CRUD 和权限按钮阶段接入`);
}
</script>

<template>
  <main class="user-management-page">
    <UserDepartmentPanel
      v-model:selected-key="selectedDepartmentKey"
      :departments="departments"
      :loading="departmentsQuery.asyncStatus.value === 'loading'"
    />

    <section class="user-management-page__content">
      <UserSearchPanel
        v-show="searchPanelVisible"
        :filters="filters"
        :loading="isFetching"
        @collapse="searchPanelVisible = false"
        @query="handleQuery"
        @reset="resetFilters"
        @update-filters="updateFilters"
      />

      <ElAlert
        v-if="departmentErrorMessage"
        :closable="false"
        :description="departmentErrorMessage"
        show-icon
        title="部门数据加载失败"
        type="error"
      />

      <ElAlert
        v-if="errorMessage"
        :closable="false"
        :description="errorMessage"
        show-icon
        title="用户列表加载失败"
        type="error"
      />

      <AdminDataTable
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :columns="userTableColumns"
        empty-text="暂无用户数据"
        :loading="isFetching"
        :page-sizes="[10, 20, 50]"
        panel-label="用户列表"
        row-key="id"
        :rows="pagedUsers"
        :search-panel-visible="searchPanelVisible"
        selectable
        show-density-tool
        show-fullscreen-tool
        show-refresh-tool
        show-search-tool
        title="用户列表"
        :total="filteredUsers.length"
        @refresh="refreshUsers"
        @selection-change="handleSelectionChange"
        @toggle-search="toggleSearchPanel"
      >
        <template #toolbarActions>
          <ElButton :icon="Plus" type="primary" @click="showDeferredFeature('新增用户')">
            新增用户名
          </ElButton>
        </template>

        <template #cell-username="{ row }: { row: AdminUserListItem }">
          <span class="user-management-page__username">
            <span>{{ row.username }}</span>
            <ElTag v-if="row.is_system" effect="plain" size="small" type="danger">系统</ElTag>
          </span>
        </template>

        <template #cell-status="{ row }: { row: AdminUserListItem }">
          <ElTag :type="row.is_active === 0 ? 'info' : 'success'" effect="light">
            {{ getUserStatusLabel(row) }}
          </ElTag>
        </template>

        <template #cell-role="{ row }: { row: AdminUserListItem }">
          <ElTag :type="getUserRoleTagType(row)" effect="light">
            {{ getUserRoleLabel(row) }}
          </ElTag>
        </template>

        <template #cell-actions>
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
      </AdminDataTable>
    </section>
  </main>
</template>

<style scoped>
.user-management-page {
  --user-control-height: 34px;

  display: grid;
  min-height: calc(100vh - 88px);
  gap: 16px;
  align-items: start;
  grid-template-columns: minmax(240px, 16%) minmax(0, 1fr);
}

.user-management-page__content {
  display: flex;
  min-width: 0;
  min-height: calc(100vh - 88px);
  flex-direction: column;
  gap: 12px;
}

.user-management-page__username {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.user-management-page :deep(.el-input__wrapper),
.user-management-page :deep(.el-select__wrapper),
.user-management-page :deep(.el-date-editor.el-input__wrapper) {
  min-height: var(--user-control-height);
  color: hsl(var(--foreground));
  background: hsl(var(--input-background));
  box-shadow: 0 0 0 1px hsl(var(--border)) inset;
}

.user-management-page :deep(.el-input__wrapper:hover),
.user-management-page :deep(.el-select__wrapper:hover),
.user-management-page :deep(.el-date-editor.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px hsl(var(--input)) inset;
}

.user-management-page :deep(.el-input__wrapper.is-focus),
.user-management-page :deep(.el-select__wrapper.is-focused),
.user-management-page :deep(.el-date-editor.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px hsl(var(--primary)) inset;
}

.user-management-page :deep(.el-input__inner),
.user-management-page :deep(.el-select__placeholder),
.user-management-page :deep(.el-range-input) {
  color: hsl(var(--foreground));
}

.user-management-page :deep(.el-input__inner::placeholder),
.user-management-page :deep(.el-range-input::placeholder),
.user-management-page :deep(.el-select__placeholder.is-transparent) {
  color: hsl(var(--input-placeholder));
}

.user-management-page :deep(.el-button:not(.el-button--primary, .el-button--danger, .is-link)) {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border-color: hsl(var(--border));
}

.user-management-page
  :deep(.el-button:not(.el-button--primary, .el-button--danger, .is-link):hover) {
  color: hsl(var(--primary));
  background: hsl(var(--accent));
  border-color: hsl(var(--primary));
}

@media (max-width: 980px) {
  .user-management-page {
    grid-template-columns: 1fr;
  }

  .user-management-page__content {
    min-height: auto;
  }
}
</style>
