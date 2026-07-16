<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { PERMISSION_CODES } from "@admin-backend-3/admin-api-contract/permissions";
import type { MenuType } from "@admin-backend-3/admin-api-contract/permissions";

import type { AdminMenuNode, MenuPayload } from "@/api/modules/menus";
import { getApiErrorMessage } from "@/api/request";
import { AdminDataTable, AdminFormDrawer } from "@/components/common";
import type { AdminFormField, AdminFormModel } from "@/components/common";
import {
  useCreateMenuMutation,
  useDeleteMenuMutation,
  useMenusTreeQuery,
  useUpdateMenuMutation,
} from "@/queries/menus";
import { MENU_TYPE_LABELS, MENU_TYPE_TAG_TYPES, menuTableColumns } from "./menuTableColumns";

const menusQuery = useMenusTreeQuery();
const createMenuMutation = useCreateMenuMutation();
const updateMenuMutation = useUpdateMenuMutation();
const deleteMenuMutation = useDeleteMenuMutation();

const menuTree = computed(() => menusQuery.data.value ?? []);
const errorMessage = computed(() =>
  menusQuery.error.value ? getApiErrorMessage(menusQuery.error.value) : "",
);

// 树表格不分页，但 AdminDataTable 的分页 model 必传，给占位值
const currentPage = shallowRef(1);
const pageSize = shallowRef(10);

function countNodes(nodes: AdminMenuNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}
const totalCount = computed(() => countNodes(menuTree.value));

// ====== 新增/编辑抽屉 ======

const drawerOpen = shallowRef(false);
const editingMenu = shallowRef<AdminMenuNode | null>(null);
const drawerTitle = computed(() => (editingMenu.value ? "编辑菜单" : "新增菜单"));

const menuFormFields = computed<AdminFormField[]>(() => [
  {
    component: "radio-group",
    defaultValue: "menu",
    key: "type",
    label: "菜单类型",
    options: Object.entries(MENU_TYPE_LABELS).map(([value, label]) => ({ label, value })),
    // 编辑时锁定类型，避免已有子节点/绑定的节点切换类型造成数据不一致
    props: { disabled: Boolean(editingMenu.value) },
    required: true,
  },
  { component: "input", defaultValue: null, key: "pid", label: "上级菜单", slot: "parent" },
  { component: "input", key: "title", label: "菜单名称", props: { maxlength: 20 }, required: true },
  {
    component: "input",
    key: "auth_code",
    label: "权限标识",
    placeholder: "如 system:user:view",
    visible: (model) => model.type !== "catalog",
  },
  {
    component: "input",
    key: "path",
    label: "路由地址",
    placeholder: "如 /system/users",
    visible: (model) => model.type !== "button",
  },
  {
    component: "input",
    key: "component",
    label: "组件路径",
    placeholder: "如 views/system/users/UserManagementView.vue",
    visible: (model) => model.type === "menu",
  },
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
    component: "input",
    defaultValue: 0,
    key: "sort",
    label: "排序",
    props: { type: "number" },
  },
]);

const drawerInitialValues = computed<AdminFormModel>(() =>
  editingMenu.value
    ? {
        auth_code: editingMenu.value.auth_code ?? "",
        component: editingMenu.value.component ?? "",
        path: editingMenu.value.path ?? "",
        pid: editingMenu.value.pid,
        sort: editingMenu.value.sort,
        status: editingMenu.value.status,
        title: editingMenu.value.title,
        type: editingMenu.value.type,
      }
    : {},
);

// 上级菜单候选树：按钮不能作为父节点；编辑时剔除自身（连带其子树），防止选出环
function buildParentOptions(nodes: AdminMenuNode[], excludeId: null | number): AdminMenuNode[] {
  return nodes
    .filter((node) => node.type !== "button" && node.id !== excludeId)
    .map((node) => ({ ...node, children: buildParentOptions(node.children, excludeId) }));
}
const parentOptions = computed(() =>
  buildParentOptions(menuTree.value, editingMenu.value?.id ?? null),
);

const submitting = computed(
  () =>
    createMenuMutation.asyncStatus.value === "loading" ||
    updateMenuMutation.asyncStatus.value === "loading",
);

function openCreateDrawer() {
  editingMenu.value = null;
  drawerOpen.value = true;
}

function openEditDrawer(menu: AdminMenuNode) {
  editingMenu.value = menu;
  drawerOpen.value = true;
}

async function handleDrawerSubmit(values: AdminFormModel) {
  const type = values.type as MenuType;
  const authCode = String(values.auth_code ?? "").trim();

  if (type === "button" && !authCode) {
    ElMessage.error("按钮节点必须填写权限标识");
    return;
  }

  const payload: MenuPayload = {
    auth_code: type === "catalog" ? null : authCode || null,
    component: type === "menu" ? String(values.component ?? "").trim() || null : null,
    path: type === "button" ? null : String(values.path ?? "").trim() || null,
    pid: values.pid == null || values.pid === "" ? null : Number(values.pid),
    sort: Number(values.sort ?? 0),
    status: values.status as 0 | 1,
    title: String(values.title).trim(),
    type,
  };

  try {
    if (editingMenu.value) {
      await updateMenuMutation.mutateAsync({ menuId: editingMenu.value.id, payload });
      ElMessage.success("菜单更新成功");
    } else {
      await createMenuMutation.mutateAsync(payload);
      ElMessage.success("菜单创建成功");
    }
    drawerOpen.value = false;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  }
}

async function handleDelete(menu: AdminMenuNode) {
  const confirmed = await ElMessageBox.confirm(
    `确定删除菜单「${menu.title}」吗？关联的角色绑定将一并清除。`,
    "删除菜单",
    { cancelButtonText: "取消", confirmButtonText: "删除", type: "warning" },
  ).catch(() => false);

  if (!confirmed) {
    return;
  }

  try {
    await deleteMenuMutation.mutateAsync(menu.id);
    ElMessage.success("菜单删除成功");
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  }
}

function refreshMenus() {
  void menusQuery.refetch();
}
</script>

<template>
  <main class="menu-management-page">
    <ElAlert
      v-if="errorMessage"
      :closable="false"
      :description="errorMessage"
      show-icon
      title="菜单数据加载失败"
      type="error"
    />

    <AdminDataTable
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :columns="menuTableColumns"
      default-expand-all
      empty-text="暂无菜单数据"
      :loading="menusQuery.asyncStatus.value === 'loading'"
      panel-label="菜单列表"
      row-key="id"
      :rows="menuTree"
      show-fullscreen-tool
      show-refresh-tool
      :show-pagination="false"
      title="菜单列表"
      :total="totalCount"
      :tree-props="{ children: 'children' }"
      @refresh="refreshMenus"
    >
      <template #toolbarActions>
        <ElButton
          v-permission="PERMISSION_CODES.systemMenuCreate"
          :icon="Plus"
          type="primary"
          @click="openCreateDrawer"
        >
          新增菜单
        </ElButton>
      </template>

      <template #cell-title="{ row }: { row: AdminMenuNode }">
        <span class="menu-management-page__title">{{ row.title }}</span>
      </template>

      <template #cell-type="{ row }: { row: AdminMenuNode }">
        <ElTag effect="plain" :type="MENU_TYPE_TAG_TYPES[row.type]">
          {{ MENU_TYPE_LABELS[row.type] }}
        </ElTag>
      </template>

      <template #cell-status="{ row }: { row: AdminMenuNode }">
        <ElTag effect="light" :type="row.status === 1 ? 'success' : 'info'">
          {{ row.status === 1 ? "启用" : "停用" }}
        </ElTag>
      </template>

      <template #cell-actions="{ row }: { row: AdminMenuNode }">
        <span v-permission="PERMISSION_CODES.systemMenuUpdate">
          <ElButton link type="primary" @click="openEditDrawer(row)">编辑</ElButton>
        </span>
        <span v-permission="PERMISSION_CODES.systemMenuDelete">
          <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
        </span>
      </template>
    </AdminDataTable>

    <AdminFormDrawer
      v-model="drawerOpen"
      :fields="menuFormFields"
      :initial-values="drawerInitialValues"
      size="520px"
      :submitting="submitting"
      :title="drawerTitle"
      @submit="handleDrawerSubmit"
    >
      <template #field-parent="{ model }">
        <ElTreeSelect
          check-strictly
          clearable
          :data="parentOptions"
          default-expand-all
          :model-value="model.pid"
          node-key="id"
          placeholder="不选则为顶级菜单"
          :props="{ children: 'children', label: 'title' }"
          style="width: 100%"
          @update:model-value="model.pid = $event"
        />
      </template>
    </AdminFormDrawer>
  </main>
</template>

<style scoped>
.menu-management-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.menu-management-page__title {
  font-weight: 500;
}
</style>
