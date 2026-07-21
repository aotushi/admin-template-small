<script setup lang="ts">
import { shallowRef } from "vue";

import { AdminSearchForm } from "@/components/common";
import type { AdminFormField, AdminFormModel } from "@/components/common";
import CommonExampleCard from "@/views/showcase/examples/CommonExampleCard.vue";

// 字段 schema：业务页与演示页共用同一套 AdminSearchForm 封装
const fields: AdminFormField[] = [
  { component: "input", key: "keyword", label: "组件名称" },
  { component: "input", key: "scene", label: "使用位置" },
  {
    component: "select",
    key: "type",
    label: "组件类型",
    options: [
      { label: "表格", value: "table" },
      { label: "表单", value: "form" },
      { label: "树形筛选", value: "tree" },
    ],
  },
];

const lastQuery = shallowRef<AdminFormModel | null>(null);

function handleSearch(values: AdminFormModel) {
  lastQuery.value = values;
}

function handleReset(values: AdminFormModel) {
  lastQuery.value = values;
}
</script>

<template>
  <CommonExampleCard title="基础查询表单">
    <div class="basic-search-form-example">
      <AdminSearchForm
        :fields="fields"
        panel-label="基础查询表单"
        @reset="handleReset"
        @search="handleSearch"
      />

      <p v-if="lastQuery" class="basic-search-form-example__output">
        最近一次查询参数：{{ JSON.stringify(lastQuery) }}
      </p>
    </div>
  </CommonExampleCard>
</template>

<style scoped>
.basic-search-form-example {
  display: grid;
  gap: 12px;
}

.basic-search-form-example__output {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 20px;
  word-break: break-all;
}
</style>
