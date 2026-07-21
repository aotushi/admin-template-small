<script setup lang="ts">
import { shallowRef } from "vue";
import { ElMessage } from "element-plus";

import { AdminFormDrawer } from "@/components/common";
import type { AdminFormField, AdminFormModel } from "@/components/common";
import CommonExampleCard from "@/views/showcase/examples/CommonExampleCard.vue";

// 抽屉表单 schema：与角色管理等业务页共用同一套 AdminFormDrawer 封装
const fields: AdminFormField[] = [
  {
    component: "input",
    key: "name",
    label: "角色名称",
    props: { maxlength: 20 },
    required: true,
  },
  {
    component: "radio-group",
    defaultValue: 1,
    key: "status",
    label: "状态",
    options: [
      { label: "启用", value: 1 },
      { label: "禁用", value: 0 },
    ],
  },
  {
    component: "textarea",
    key: "remark",
    label: "备注",
    props: { maxlength: 50, rows: 3, showWordLimit: true },
  },
];

const createOpen = shallowRef(false);
const editOpen = shallowRef(false);
const submitting = shallowRef(false);
const lastSubmit = shallowRef<AdminFormModel | null>(null);

const editInitialValues: AdminFormModel = {
  name: "运营专员",
  remark: "只读运营数据",
  status: 0,
};

function handleSubmit(values: AdminFormModel) {
  submitting.value = true;

  // 演示提交流程：模拟请求耗时后关闭抽屉
  setTimeout(() => {
    submitting.value = false;
    createOpen.value = false;
    editOpen.value = false;
    lastSubmit.value = values;
    ElMessage.success("提交成功");
  }, 500);
}
</script>

<template>
  <CommonExampleCard title="抽屉表单">
    <div class="form-drawer-example">
      <div class="form-drawer-example__actions">
        <ElButton type="primary" @click="createOpen = true">新增（默认值）</ElButton>
        <ElButton @click="editOpen = true">编辑（initialValues 回填）</ElButton>
      </div>

      <p v-if="lastSubmit" class="form-drawer-example__output">
        最近一次提交：{{ JSON.stringify(lastSubmit) }}
      </p>

      <AdminFormDrawer
        v-model="createOpen"
        :fields="fields"
        :submitting="submitting"
        title="新增角色"
        @submit="handleSubmit"
      />

      <AdminFormDrawer
        v-model="editOpen"
        :fields="fields"
        :initial-values="editInitialValues"
        :submitting="submitting"
        title="编辑角色"
        @submit="handleSubmit"
      />
    </div>
  </CommonExampleCard>
</template>

<style scoped>
.form-drawer-example {
  display: grid;
  gap: 12px;
}

.form-drawer-example__actions {
  display: flex;
  gap: 8px;
}

.form-drawer-example__output {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 20px;
  word-break: break-all;
}
</style>
