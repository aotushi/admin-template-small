<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";

import type { AdminUserListItem } from "@/api/users";
import { getApiErrorMessage } from "@/api/request";
import { useUsersListQuery } from "@/queries/users";
import UserDepartmentPanel from "./components/UserDepartmentPanel.vue";
import UserSearchPanel from "./components/UserSearchPanel.vue";
import UserTable from "./components/UserTable.vue";
import type { UserFilters } from "./types";
import { createDefaultUserFilters, filterUsers, paginateUsers } from "./userFilters";

const usersQuery = useUsersListQuery();
const filters = reactive<UserFilters>(createDefaultUserFilters());
const currentPage = shallowRef(1);
const pageSize = shallowRef(10);
const selectedDepartmentKey = shallowRef("jewelry");
const selectedUsers = shallowRef<AdminUserListItem[]>([]);
const searchPanelVisible = shallowRef(true);

const users = computed(() => usersQuery.data.value ?? []);
const filteredUsers = computed(() => filterUsers(users.value, filters));
const pagedUsers = computed(() =>
  paginateUsers(filteredUsers.value, {
    page: currentPage.value,
    pageSize: pageSize.value,
  }),
);
const isFetching = computed(() => usersQuery.asyncStatus.value === "loading");
const errorMessage = computed(() =>
  usersQuery.error.value ? getApiErrorMessage(usersQuery.error.value) : "",
);

watch(
  () => [
    filters.adminLevel,
    filters.createdRange.join("|"),
    filters.remark,
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

function updateFilters(nextFilters: Partial<UserFilters>) {
  Object.assign(filters, nextFilters);
}

function resetFilters() {
  Object.assign(filters, createDefaultUserFilters());
}

function refreshUsers() {
  void usersQuery.refetch();
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
    <UserDepartmentPanel v-model:selected-key="selectedDepartmentKey" />

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
        v-if="errorMessage"
        :closable="false"
        :description="errorMessage"
        show-icon
        title="用户列表加载失败"
        type="error"
      />

      <UserTable
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :loading="isFetching"
        :rows="pagedUsers"
        :search-panel-visible="searchPanelVisible"
        :total="filteredUsers.length"
        @add-user="showDeferredFeature('新增用户')"
        @refresh="refreshUsers"
        @selection-change="handleSelectionChange"
        @toggle-density="showDeferredFeature('表格密度')"
        @toggle-fullscreen="showDeferredFeature('表格全屏')"
        @toggle-search="toggleSearchPanel"
      />
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
