<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef, watch } from "vue";
import type { ElTree } from "element-plus";

import type { AdminMenuNode } from "@/api/modules/menus";

const props = defineProps<{
  loading?: boolean;
  tree: AdminMenuNode[];
}>();

// 值为选中菜单 id 的全闭包（含半选父节点），与后端 role_menus 存储口径一致
const model = defineModel<number[]>({ required: true });

const treeRef = useTemplateRef<InstanceType<typeof ElTree>>("treeRef");
// 回填期间临时开启 check-strictly：父节点原样勾选不向下级联，保证绑定还原无损
const checkStrictly = shallowRef(false);

// 读取树当前勾选闭包（全选 + 半选父），与 model 存储口径一致
function readCheckedClosure() {
  const tree = treeRef.value;
  if (!tree) {
    return [];
  }

  return [
    ...(tree.getCheckedKeys(false) as number[]),
    ...(tree.getHalfCheckedKeys() as number[]),
  ].sort((a, b) => a - b);
}

watch(
  [() => props.tree, model],
  async ([tree]) => {
    if (tree.length === 0) {
      return;
    }

    // 树勾选与 model 已一致（含自身勾选 emit 的回流）则跳过，避免重复回填
    const expected = [...(model.value ?? [])].sort((a, b) => a - b);
    if (expected.join(",") === readCheckedClosure().join(",")) {
      return;
    }

    checkStrictly.value = true;
    await nextTick();
    treeRef.value?.setCheckedKeys(expected);
    await nextTick();
    checkStrictly.value = false;
  },
  { immediate: true },
);

function handleCheck() {
  if (!treeRef.value) {
    return;
  }

  model.value = readCheckedClosure();
}
</script>

<template>
  <div v-loading="props.loading" class="role-menu-tree">
    <ElTree
      ref="treeRef"
      :check-strictly="checkStrictly"
      :data="props.tree"
      default-expand-all
      node-key="id"
      :props="{ children: 'children', label: 'title' }"
      show-checkbox
      @check="handleCheck"
    >
      <template #default="{ data }: { data: AdminMenuNode }">
        <span class="role-menu-tree__node">
          <span>{{ data.title }}</span>
          <span v-if="data.auth_code" class="role-menu-tree__code">{{ data.auth_code }}</span>
        </span>
      </template>
    </ElTree>
  </div>
</template>

<style scoped>
.role-menu-tree {
  width: 100%;
  padding: 8px;
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.role-menu-tree__node {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.role-menu-tree__code {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
