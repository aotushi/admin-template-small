<script setup lang="ts">
import { AdminSearchForm } from "@/components/common";
import type { AdminFormField } from "@/components/common";
import CommonExampleCard from "@/views/showcase/examples/CommonExampleCard.vue";

// 演示 select 默认值与 date-range 字段类型
const fields: AdminFormField[] = [
  { component: "input", key: "owner", label: "归属模块" },
  {
    component: "select",
    key: "status",
    label: "接入状态",
    options: [
      { label: "已接入", value: "ready" },
      { label: "规划中", value: "draft" },
    ],
  },
  {
    component: "select",
    defaultValue: "v1",
    key: "version",
    label: "版本阶段",
    options: [
      { label: "第一阶段", value: "v1" },
      { label: "第二阶段", value: "v2" },
    ],
  },
  { component: "date-range", key: "createdRange", label: "创建时间" },
];
</script>

<template>
  <CommonExampleCard title="状态查询表单">
    <AdminSearchForm :fields="fields" panel-label="状态查询表单" />
  </CommonExampleCard>
</template>
