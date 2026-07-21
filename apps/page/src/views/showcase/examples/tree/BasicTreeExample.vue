<script setup lang="ts">
import { shallowRef } from "vue";

import { AdminTreePanel } from "@/components/common";
import CommonExampleCard from "@/views/showcase/examples/CommonExampleCard.vue";

const selectedKey = shallowRef("system");

const nodes = [
  {
    key: "system",
    label: "系统管理",
    children: [
      {
        key: "users",
        label: "用户管理",
      },
      {
        key: "roles",
        label: "角色管理",
      },
    ],
  },
  {
    key: "components",
    label: "公共组件",
    children: [
      {
        key: "table",
        label: "表格组件",
      },
      {
        key: "form",
        label: "查询表单",
      },
    ],
  },
];
</script>

<template>
  <CommonExampleCard title="基础树形筛选">
    <div class="basic-tree-example">
      <AdminTreePanel
        v-model:selected-key="selectedKey"
        :nodes="nodes"
        panel-label="基础树形筛选"
        search-placeholder="搜索节点..."
      />
    </div>
  </CommonExampleCard>
</template>

<style scoped>
.basic-tree-example {
  max-width: 360px;
}

.basic-tree-example :deep(.admin-tree-panel) {
  min-height: 360px;
}

@media (max-width: 760px) {
  .basic-tree-example {
    max-width: none;
  }
}
</style>
