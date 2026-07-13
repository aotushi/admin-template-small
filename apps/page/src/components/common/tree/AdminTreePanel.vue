<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { Search } from "@element-plus/icons-vue";

import type { AdminTreeNode } from "./types";

const selectedKey = defineModel<string>("selectedKey", { required: true });

const props = withDefaults(
  defineProps<{
    nodes: AdminTreeNode[];
    panelLabel: string;
    searchPlaceholder?: string;
  }>(),
  {
    searchPlaceholder: "搜索...",
  },
);

const emit = defineEmits<{
  nodeClick: [node: AdminTreeNode];
}>();

const searchKeyword = shallowRef("");

const defaultExpandedKeys = computed(() => props.nodes.map((item) => item.key));
const visibleNodes = computed(() => filterTreeNodes(props.nodes, searchKeyword.value));

function handleNodeClick(node: AdminTreeNode) {
  selectedKey.value = node.key;
  emit("nodeClick", node);
}

function filterTreeNodes(tree: readonly AdminTreeNode[], keyword: string): AdminTreeNode[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return [...tree];
  }

  const visibleNodes: AdminTreeNode[] = [];

  for (const node of tree) {
    const children = node.children ? filterTreeNodes(node.children, normalizedKeyword) : undefined;
    const matches = node.label.toLowerCase().includes(normalizedKeyword);

    if (!matches && !children?.length) {
      continue;
    }

    visibleNodes.push({
      ...node,
      ...(children ? { children } : {}),
    });
  }

  return visibleNodes;
}
</script>

<template>
  <aside class="admin-tree-panel" :aria-label="props.panelLabel">
    <ElInput
      v-model="searchKeyword"
      class="admin-tree-panel__search"
      clearable
      :placeholder="props.searchPlaceholder"
      :prefix-icon="Search"
    />

    <ElTree
      class="admin-tree-panel__tree"
      :current-node-key="selectedKey"
      :data="visibleNodes"
      :default-expanded-keys="defaultExpandedKeys"
      default-expand-all
      highlight-current
      node-key="key"
      @node-click="handleNodeClick"
    />
  </aside>
</template>

<style scoped>
.admin-tree-panel {
  min-height: calc(100vh - 88px);
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 24px;
}

.admin-tree-panel__search {
  margin-bottom: 12px;
}

.admin-tree-panel__tree {
  --el-tree-node-hover-bg-color: hsl(var(--accent));
  --el-tree-node-hover-text-color: hsl(var(--foreground) / 85%);
  --el-tree-text-color: hsl(var(--foreground) / 85%);
  background: transparent;
  color: hsl(var(--foreground) / 85%);
  font-size: 14px;
}

.admin-tree-panel__tree :deep(.el-tree-node__content) {
  height: 28px;
  margin: 2px 0;
  border-radius: 4px;
  font-weight: 500;
}

.admin-tree-panel__tree :deep(.el-tree-node__expand-icon),
.admin-tree-panel__tree :deep(.el-tree-node__label) {
  color: hsl(var(--foreground) / 85%);
}

.admin-tree-panel__tree :deep(.el-tree-node__content:hover .el-tree-node__expand-icon),
.admin-tree-panel__tree :deep(.el-tree-node__content:hover .el-tree-node__label) {
  color: hsl(var(--foreground));
}

.admin-tree-panel__tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: hsl(var(--accent));
  color: hsl(var(--foreground));
}

.admin-tree-panel__tree
  :deep(.el-tree-node.is-current > .el-tree-node__content .el-tree-node__expand-icon),
.admin-tree-panel__tree
  :deep(.el-tree-node.is-current > .el-tree-node__content .el-tree-node__label) {
  color: hsl(var(--foreground));
}

@media (max-width: 980px) {
  .admin-tree-panel {
    min-height: auto;
  }
}
</style>
