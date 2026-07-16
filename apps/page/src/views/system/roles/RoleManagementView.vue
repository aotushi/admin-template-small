<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { PERMISSION_CODES } from "@admin-backend-3/admin-api-contract/permissions";

import type { AdminRoleItem, RolePayload } from "@/api/modules/roles";
import { getApiErrorMessage } from "@/api/request";
import { AdminDataTable, AdminFormDrawer, AdminSearchForm } from "@/components/common";
import type { AdminFormField, AdminFormModel } from "@/components/common";
import { useMenusTreeQuery } from "@/queries/menus";
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useRolesQuery,
  useUpdateRoleMutation,
} from "@/queries/roles";
import RoleMenuTree from "./components/RoleMenuTree.vue";
import { DATA_SCOPE_LABELS, roleTableColumns } from "./roleTableColumns";

const rolesQuery = useRolesQuery();
const menusQuery = useMenusTreeQuery();
const createRoleMutation = useCreateRoleMutation();
const updateRoleMutation = useUpdateRoleMutation();
const deleteRoleMutation = useDeleteRoleMutation();

const roles = computed(() => rolesQuery.data.value?.roles ?? []);
const menuTree = computed(() => menusQuery.data.value ?? []);
const errorMessage = computed(() =>
  rolesQuery.error.value ? getApiErrorMessage(rolesQuery.error.value) : "",
);

// ====== 查询表单（提交式筛选，本地过滤） ======

const searchFields: AdminFormField[] = [
  { component: "input", key: "name", label: "角色名称" },
  {
    component: "select",
    key: "status",
    label: "状态",
    options: [
      { label: "启用", value: 1 },
      { label: "停用", value: 0 },
    ],
  },
];

const filters = reactive<{ name: string; status: null | number }>({
  name: "",
  status: null,
});

function applyFilters(values: AdminFormModel) {
  filters.name = String(values.name ?? "").trim();
  filters.status =
    values.status === "" || values.status === undefined ? null : Number(values.status);
}

const currentPage = shallowRef(1);
const pageSize = shallowRef(10);
const searchPanelVisible = shallowRef(true);

const filteredRoles = computed(() =>
  roles.value.filter((role) => {
    const nameMatched = !filters.name || role.name.includes(filters.name);
    const statusMatched = filters.status === null || role.status === filters.status;
    return nameMatched && statusMatched;
  }),
);
const pagedRoles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRoles.value.slice(start, start + pageSize.value);
});

watch([() => filters.name, () => filters.status, pageSize], () => {
  currentPage.value = 1;
});

// ====== 新增/编辑抽屉 ======

const roleFormFields: AdminFormField[] = [
  { component: "input", key: "name", label: "角色名称", props: { maxlength: 20 }, required: true },
  {
    component: "radio-group",
    defaultValue: 1,
    key: "status",
    label: "状态",
    options: [
      { label: "启用", value: 1 },
      { label: "停用", value: 0 },
    ],
  },
  {
    component: "radio-group",
    defaultValue: "self",
    key: "data_scope",
    label: "数据范围",
    options: Object.entries(DATA_SCOPE_LABELS).map(([value, label]) => ({ label, value })),
  },
  { component: "input", key: "menu_ids", label: "菜单权限", slot: "menuTree" },
  {
    component: "textarea",
    key: "remark",
    label: "备注",
    props: { maxlength: 50, rows: 3, showWordLimit: true },
  },
];

const drawerOpen = shallowRef(false);
const editingRole = shallowRef<AdminRoleItem | null>(null);
const drawerTitle = computed(() => (editingRole.value ? "编辑角色" : "新增角色"));
const drawerInitialValues = computed<AdminFormModel>(() =>
  editingRole.value
    ? {
        data_scope: editingRole.value.data_scope,
        menu_ids: [...editingRole.value.menu_ids],
        name: editingRole.value.name,
        remark: editingRole.value.remark,
        status: editingRole.value.status,
      }
    : { menu_ids: [] },
);
const submitting = computed(
  () =>
    createRoleMutation.asyncStatus.value === "loading" ||
    updateRoleMutation.asyncStatus.value === "loading",
);

function openCreateDrawer() {
  editingRole.value = null;
  drawerOpen.value = true;
}

function openEditDrawer(role: AdminRoleItem) {
  editingRole.value = role;
  drawerOpen.value = true;
}

async function handleDrawerSubmit(values: AdminFormModel) {
  const payload: RolePayload = {
    data_scope: values.data_scope as RolePayload["data_scope"],
    menu_ids: values.menu_ids as number[],
    name: String(values.name).trim(),
    remark: String(values.remark ?? ""),
    status: values.status as 0 | 1,
  };

  try {
    if (editingRole.value) {
      await updateRoleMutation.mutateAsync({ payload, roleId: editingRole.value.id });
      ElMessage.success("角色更新成功，成员下次刷新令牌后生效");
    } else {
      await createRoleMutation.mutateAsync(payload);
      ElMessage.success("角色创建成功");
    }
    drawerOpen.value = false;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  }
}

async function handleDelete(role: AdminRoleItem) {
  const confirmed = await ElMessageBox.confirm(
    `确定删除角色「${role.name}」吗？该操作不可恢复。`,
    "删除角色",
    { cancelButtonText: "取消", confirmButtonText: "删除", type: "warning" },
  ).catch(() => false);

  if (!confirmed) {
    return;
  }

  try {
    await deleteRoleMutation.mutateAsync(role.id);
    ElMessage.success("角色删除成功");
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  }
}

function refreshRoles() {
  void rolesQuery.refetch();
  void menusQuery.refetch();
}
</script>

<template>
  <main class="role-management-page">
    <AdminSearchForm
      v-show="searchPanelVisible"
      :fields="searchFields"
      :loading="rolesQuery.asyncStatus.value === 'loading'"
      panel-label="角色筛选"
      @reset="applyFilters"
      @search="applyFilters"
    />

    <ElAlert
      v-if="errorMessage"
      :closable="false"
      :description="errorMessage"
      show-icon
      title="角色数据加载失败"
      type="error"
    />

    <AdminDataTable
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :columns="roleTableColumns"
      empty-text="暂无角色数据"
      :loading="rolesQuery.asyncStatus.value === 'loading'"
      :page-sizes="[10, 20, 50]"
      panel-label="角色列表"
      row-key="id"
      :rows="pagedRoles"
      :search-panel-visible="searchPanelVisible"
      show-density-tool
      show-fullscreen-tool
      show-refresh-tool
      show-search-tool
      title="角色列表"
      :total="filteredRoles.length"
      @refresh="refreshRoles"
      @toggle-search="searchPanelVisible = !searchPanelVisible"
    >
      <template #toolbarActions>
        <ElButton
          v-permission="PERMISSION_CODES.systemRoleCreate"
          :icon="Plus"
          type="primary"
          @click="openCreateDrawer"
        >
          新增角色
        </ElButton>
      </template>

      <template #cell-name="{ row }: { row: AdminRoleItem }">
        <span class="role-management-page__name">
          <span>{{ row.name }}</span>
          <ElTag v-if="row.code === 'super'" effect="plain" size="small" type="danger">
            内置
          </ElTag>
        </span>
      </template>

      <template #cell-status="{ row }: { row: AdminRoleItem }">
        <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="light">
          {{ row.status === 1 ? "启用" : "停用" }}
        </ElTag>
      </template>

      <template #cell-actions="{ row }: { row: AdminRoleItem }">
        <template v-if="row.code !== 'super'">
          <span v-permission="PERMISSION_CODES.systemRoleUpdate">
            <ElButton link type="primary" @click="openEditDrawer(row)">编辑</ElButton>
          </span>
          <span v-permission="PERMISSION_CODES.systemRoleDelete">
            <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
          </span>
        </template>
        <span v-else class="role-management-page__protected">内置角色不可操作</span>
      </template>
    </AdminDataTable>

    <AdminFormDrawer
      v-model="drawerOpen"
      :fields="roleFormFields"
      :initial-values="drawerInitialValues"
      size="520px"
      :submitting="submitting"
      :title="drawerTitle"
      @submit="handleDrawerSubmit"
    >
      <template #field-menuTree="{ model }">
        <RoleMenuTree
          :loading="menusQuery.asyncStatus.value === 'loading'"
          :model-value="(model.menu_ids as number[]) ?? []"
          :tree="menuTree"
          @update:model-value="model.menu_ids = $event"
        />
      </template>
    </AdminFormDrawer>
  </main>
</template>

<style scoped>
.role-management-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-management-page__name {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.role-management-page__protected {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
