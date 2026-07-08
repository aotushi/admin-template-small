<script setup lang="ts">
import { reactive } from "vue";

import AdminSearchPanel from "@/components/common/form/AdminSearchPanel.vue";
import CommonExampleCard from "@/views/components/examples/CommonExampleCard.vue";

const filters = reactive({
  owner: "",
  status: "",
  version: "",
});

function handleReset() {
  filters.owner = "";
  filters.status = "";
  filters.version = "";
}
</script>

<template>
  <CommonExampleCard title="状态查询表单">
    <AdminSearchPanel aria-label="状态查询表单" label-width="88px">
      <ElFormItem label="归属模块">
        <ElInput v-model="filters.owner" clearable placeholder="请输入" />
      </ElFormItem>

      <ElFormItem label="接入状态">
        <ElSelect v-model="filters.status" clearable placeholder="请选择">
          <ElOption label="已接入" value="ready" />
          <ElOption label="规划中" value="draft" />
        </ElSelect>
      </ElFormItem>

      <ElFormItem label="版本阶段">
        <ElSelect v-model="filters.version" clearable placeholder="请选择">
          <ElOption label="第一阶段" value="v1" />
          <ElOption label="第二阶段" value="v2" />
        </ElSelect>
      </ElFormItem>

      <ElFormItem class="status-search-form-example__actions" label=" ">
        <ElButton @click="handleReset">重 置</ElButton>
        <ElButton type="primary">搜 索</ElButton>
      </ElFormItem>
    </AdminSearchPanel>
  </CommonExampleCard>
</template>

<style scoped>
.status-search-form-example__actions :deep(.el-form-item__content) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
