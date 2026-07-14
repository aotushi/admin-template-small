<script setup lang="ts">
import { computed } from "vue";

import type { AdminDepartmentTreeItem } from "@/api/modules/users";
import { AdminTreePanel } from "@/components/common";
import type { AdminTreeNode } from "@/components/common";
import { ALL_DEPARTMENTS_KEY, createDepartmentKey } from "@/views/system/users/departmentTree";

const selectedKey = defineModel<string>("selectedKey", { required: true });

const props = defineProps<{
  departments: readonly AdminDepartmentTreeItem[];
  loading?: boolean;
}>();

const departmentTree = computed<AdminTreeNode[]>(() => [
  {
    children: props.departments.map(toDepartmentNode),
    key: ALL_DEPARTMENTS_KEY,
    label: "全部部门",
  },
]);

function toDepartmentNode(department: AdminDepartmentTreeItem): AdminTreeNode {
  return {
    children: department.children.map(toDepartmentNode),
    key: createDepartmentKey(department.id),
    label: department.name,
  };
}
</script>

<template>
  <AdminTreePanel
    v-model:selected-key="selectedKey"
    panel-label="部门树"
    v-loading="props.loading"
    :nodes="departmentTree"
    search-placeholder="搜索部门..."
  />
</template>
