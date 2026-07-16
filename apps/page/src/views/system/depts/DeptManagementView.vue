<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { PERMISSION_CODES } from "@admin-backend-3/admin-api-contract/permissions";

import type { AdminDepartmentNode, DepartmentPayload } from "@/api/modules/departments";
import { getApiErrorMessage } from "@/api/request";
import { AdminDataTable, AdminFormDrawer } from "@/components/common";
import type { AdminFormField, AdminFormModel } from "@/components/common";
import {
  useCreateDepartmentMutation,
  useDeleteDepartmentMutation,
  useDepartmentsManageTreeQuery,
  useUpdateDepartmentMutation,
} from "@/queries/departments";
import { deptTableColumns } from "./deptTableColumns";

const deptsQuery = useDepartmentsManageTreeQuery();
const createDeptMutation = useCreateDepartmentMutation();
const updateDeptMutation = useUpdateDepartmentMutation();
const deleteDeptMutation = useDeleteDepartmentMutation();

const deptTree = computed(() => deptsQuery.data.value ?? []);
const errorMessage = computed(() =>
  deptsQuery.error.value ? getApiErrorMessage(deptsQuery.error.value) : "",
);

// 树表格不分页，但 AdminDataTable 的分页 model 必传，给占位值
const currentPage = shallowRef(1);
const pageSize = shallowRef(10);

function countNodes(nodes: AdminDepartmentNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}
const totalCount = computed(() => countNodes(deptTree.value));

// ====== 新增/编辑抽屉 ======

const drawerOpen = shallowRef(false);
const editingDept = shallowRef<AdminDepartmentNode | null>(null);
const drawerTitle = computed(() => (editingDept.value ? "编辑部门" : "新增部门"));

const deptFormFields: AdminFormField[] = [
  { component: "input", defaultValue: null, key: "parent_id", label: "上级部门", slot: "parent" },
  { component: "input", key: "name", label: "部门名称", props: { maxlength: 20 }, required: true },
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
    key: "sort_order",
    label: "排序",
    props: { type: "number" },
  },
  { component: "textarea", key: "remark", label: "备注", props: { maxlength: 100, rows: 3 } },
];

const drawerInitialValues = computed<AdminFormModel>(() =>
  editingDept.value
    ? {
        name: editingDept.value.name,
        parent_id: editingDept.value.parent_id,
        remark: editingDept.value.remark ?? "",
        sort_order: editingDept.value.sort_order,
        status: editingDept.value.status,
      }
    : {},
);

// 上级部门候选树：编辑时剔除自身（连带其子树），防止选出环（后端同样校验）
function buildParentOptions(
  nodes: AdminDepartmentNode[],
  excludeId: null | number,
): AdminDepartmentNode[] {
  return nodes
    .filter((node) => node.id !== excludeId)
    .map((node) => ({ ...node, children: buildParentOptions(node.children, excludeId) }));
}
const parentOptions = computed(() =>
  buildParentOptions(deptTree.value, editingDept.value?.id ?? null),
);

const submitting = computed(
  () =>
    createDeptMutation.asyncStatus.value === "loading" ||
    updateDeptMutation.asyncStatus.value === "loading",
);

function openCreateDrawer() {
  editingDept.value = null;
  drawerOpen.value = true;
}

function openEditDrawer(dept: AdminDepartmentNode) {
  editingDept.value = dept;
  drawerOpen.value = true;
}

async function handleDrawerSubmit(values: AdminFormModel) {
  const payload: DepartmentPayload = {
    name: String(values.name).trim(),
    parent_id:
      values.parent_id == null || values.parent_id === "" ? null : Number(values.parent_id),
    remark: String(values.remark ?? "").trim() || null,
    sort_order: Number(values.sort_order ?? 0),
    status: values.status as 0 | 1,
  };

  try {
    if (editingDept.value) {
      await updateDeptMutation.mutateAsync({ deptId: editingDept.value.id, payload });
      ElMessage.success("部门更新成功");
    } else {
      await createDeptMutation.mutateAsync(payload);
      ElMessage.success("部门创建成功");
    }
    drawerOpen.value = false;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  }
}

async function handleDelete(dept: AdminDepartmentNode) {
  const confirmed = await ElMessageBox.confirm(
    `确定删除部门「${dept.name}」吗？存在子部门或仍有用户归属时无法删除。`,
    "删除部门",
    { cancelButtonText: "取消", confirmButtonText: "删除", type: "warning" },
  ).catch(() => false);

  if (!confirmed) {
    return;
  }

  try {
    await deleteDeptMutation.mutateAsync(dept.id);
    ElMessage.success("部门删除成功");
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  }
}

function refreshDepts() {
  void deptsQuery.refetch();
}
</script>

<template>
  <main class="dept-management-page">
    <ElAlert
      v-if="errorMessage"
      :closable="false"
      :description="errorMessage"
      show-icon
      title="部门数据加载失败"
      type="error"
    />

    <AdminDataTable
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :columns="deptTableColumns"
      default-expand-all
      empty-text="暂无部门数据"
      :loading="deptsQuery.asyncStatus.value === 'loading'"
      panel-label="部门列表"
      row-key="id"
      :rows="deptTree"
      show-fullscreen-tool
      show-refresh-tool
      :show-pagination="false"
      title="部门列表"
      :total="totalCount"
      :tree-props="{ children: 'children' }"
      @refresh="refreshDepts"
    >
      <template #toolbarActions>
        <ElButton
          v-permission="PERMISSION_CODES.systemDeptCreate"
          :icon="Plus"
          type="primary"
          @click="openCreateDrawer"
        >
          新增部门
        </ElButton>
      </template>

      <template #cell-name="{ row }: { row: AdminDepartmentNode }">
        <span class="dept-management-page__name">{{ row.name }}</span>
      </template>

      <template #cell-status="{ row }: { row: AdminDepartmentNode }">
        <ElTag effect="light" :type="row.status === 1 ? 'success' : 'info'">
          {{ row.status === 1 ? "启用" : "停用" }}
        </ElTag>
      </template>

      <template #cell-actions="{ row }: { row: AdminDepartmentNode }">
        <span v-permission="PERMISSION_CODES.systemDeptUpdate">
          <ElButton link type="primary" @click="openEditDrawer(row)">编辑</ElButton>
        </span>
        <span v-permission="PERMISSION_CODES.systemDeptDelete">
          <ElButton link type="danger" @click="handleDelete(row)">删除</ElButton>
        </span>
      </template>
    </AdminDataTable>

    <AdminFormDrawer
      v-model="drawerOpen"
      :fields="deptFormFields"
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
          :model-value="model.parent_id"
          node-key="id"
          placeholder="不选则为顶级部门"
          :props="{ children: 'children', label: 'name' }"
          style="width: 100%"
          @update:model-value="model.parent_id = $event"
        />
      </template>
    </AdminFormDrawer>
  </main>
</template>

<style scoped>
.dept-management-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dept-management-page__name {
  font-weight: 500;
}
</style>
