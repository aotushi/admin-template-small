<script setup lang="ts">
import { computed, shallowRef } from "vue";

import AdminTreePanel from "@/components/common/tree/AdminTreePanel.vue";
import CommonExampleCard from "@/views/components/examples/CommonExampleCard.vue";

interface TreeNode {
  children?: TreeNode[];
  key: string;
  label: string;
}

const selectedKey = shallowRef("table-panel");

const nodes: TreeNode[] = [
  {
    key: "table",
    label: "表格组件",
    children: [
      {
        key: "table-panel",
        label: "AdminTablePanel",
      },
      {
        key: "pagination",
        label: "AdminPagination",
      },
    ],
  },
  {
    key: "form",
    label: "查询表单",
    children: [
      {
        key: "search-panel",
        label: "AdminSearchPanel",
      },
    ],
  },
];

const selectedNode = computed(() => findNodeByKey(nodes, selectedKey.value));

function findNodeByKey(tree: readonly TreeNode[], key: string): TreeNode | undefined {
  for (const node of tree) {
    if (node.key === key) {
      return node;
    }

    const matchedNode = node.children ? findNodeByKey(node.children, key) : undefined;

    if (matchedNode) {
      return matchedNode;
    }
  }

  return undefined;
}
</script>

<template>
  <CommonExampleCard title="左右分栏筛选">
    <div class="split-tree-example">
      <AdminTreePanel
        v-model:selected-key="selectedKey"
        aria-label="左右分栏筛选"
        :nodes="nodes"
        search-placeholder="搜索组件..."
      />

      <section class="split-tree-example__detail">
        <p class="split-tree-example__label">当前节点</p>
        <h3 class="split-tree-example__title">{{ selectedNode?.label }}</h3>
        <p class="split-tree-example__description">
          业务页面根据左侧选中的 key 刷新右侧内容，树组件只负责筛选和选中状态。
        </p>
      </section>
    </div>
  </CommonExampleCard>
</template>

<style scoped>
.split-tree-example {
  display: grid;
  gap: 16px;
  grid-template-columns: 360px minmax(260px, 1fr);
}

.split-tree-example :deep(.admin-tree-panel),
.split-tree-example__detail {
  min-height: 360px;
}

.split-tree-example__detail {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 24px;
}

.split-tree-example__label {
  margin: 0 0 8px;
  color: hsl(var(--primary));
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
}

.split-tree-example__title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}

.split-tree-example__description {
  max-width: 520px;
  margin: 12px 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  line-height: 22px;
}

@media (max-width: 760px) {
  .split-tree-example {
    grid-template-columns: 1fr;
  }

  .split-tree-example__detail {
    min-height: auto;
  }
}
</style>
