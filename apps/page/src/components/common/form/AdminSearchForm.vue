<script setup lang="ts">
import { reactive } from "vue";

import AdminFormFieldControl from "./AdminFormFieldControl.vue";
import AdminSearchPanel from "./AdminSearchPanel.vue";
import { buildFormModel } from "./schema";
import type { AdminFormField, AdminFormModel } from "./types";

const props = withDefaults(
  defineProps<{
    fields: readonly AdminFormField[];
    /** 初始筛选值，重置时也回到这份值 */
    initialValues?: AdminFormModel;
    labelWidth?: string;
    loading?: boolean;
    panelLabel: string;
  }>(),
  {
    initialValues: undefined,
    labelWidth: "88px",
    loading: false,
  },
);

const emit = defineEmits<{
  reset: [values: AdminFormModel];
  search: [values: AdminFormModel];
}>();

// 表单值由组件内部持有，通过 search/reset 事件把快照交给使用方
const model = reactive<AdminFormModel>({
  ...buildFormModel(props.fields),
  ...props.initialValues,
});

function getValues(): AdminFormModel {
  return { ...model };
}

function handleSearch() {
  emit("search", getValues());
}

function handleReset() {
  Object.assign(model, buildFormModel(props.fields), props.initialValues);
  emit("reset", getValues());
}

defineExpose({ getValues });
</script>

<template>
  <AdminSearchPanel
    class="admin-search-form"
    :label-width="props.labelWidth"
    :panel-label="props.panelLabel"
  >
    <ElFormItem
      v-for="field in props.fields"
      :key="field.key"
      :label="field.label"
      @keyup.enter="handleSearch"
    >
      <AdminFormFieldControl v-model="model[field.key]" :disabled="props.loading" :field="field" />
    </ElFormItem>

    <ElFormItem class="admin-search-form__actions">
      <ElButton :disabled="props.loading" @click="handleReset">重 置</ElButton>
      <ElButton :loading="props.loading" type="primary" @click="handleSearch">搜 索</ElButton>
    </ElFormItem>
  </AdminSearchPanel>
</template>

<style scoped>
.admin-search-form :deep(.el-date-editor) {
  width: 100%;
}

.admin-search-form__actions {
  justify-self: end;
}

.admin-search-form__actions :deep(.el-form-item__content) {
  flex-wrap: nowrap;
  justify-content: flex-end;
}

@media (max-width: 1180px) {
  .admin-search-form__actions {
    justify-self: start;
  }
}
</style>
