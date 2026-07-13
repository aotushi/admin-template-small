<script setup lang="ts">
import { reactive } from "vue";

import { AdminSearchPanel } from "@/components/common";
import CommonExampleCard from "@/views/components/examples/CommonExampleCard.vue";

const filters = reactive({
  keyword: "",
  scene: "",
  type: "",
});

function handleReset() {
  filters.keyword = "";
  filters.scene = "";
  filters.type = "";
}
</script>

<template>
  <CommonExampleCard title="基础查询表单">
    <AdminSearchPanel label-width="88px" panel-label="基础查询表单">
      <ElFormItem label="组件名称">
        <ElInput v-model="filters.keyword" clearable placeholder="请输入" />
      </ElFormItem>

      <ElFormItem label="使用位置">
        <ElInput v-model="filters.scene" clearable placeholder="请输入" />
      </ElFormItem>

      <ElFormItem label="组件类型">
        <ElSelect v-model="filters.type" clearable placeholder="请选择">
          <ElOption label="表格" value="table" />
          <ElOption label="表单" value="form" />
          <ElOption label="树形筛选" value="tree" />
        </ElSelect>
      </ElFormItem>

      <ElFormItem class="basic-search-form-example__actions" label=" ">
        <ElButton @click="handleReset">重 置</ElButton>
        <ElButton type="primary">搜 索</ElButton>
      </ElFormItem>
    </AdminSearchPanel>
  </CommonExampleCard>
</template>

<style scoped>
.basic-search-form-example__actions :deep(.el-form-item__content) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
