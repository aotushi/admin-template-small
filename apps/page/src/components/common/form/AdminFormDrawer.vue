<script setup lang="ts">
import { computed, nextTick, reactive, useTemplateRef, watch } from "vue";
import type { FormInstance } from "element-plus";

import AdminFormFieldControl from "./AdminFormFieldControl.vue";
import { buildFormModel, buildFormRules } from "./schema";
import type { AdminFormField, AdminFormModel } from "./types";

const props = withDefaults(
  defineProps<{
    fields: readonly AdminFormField[];
    /** 编辑场景的初始值，打开时与 schema 默认值合并 */
    initialValues?: AdminFormModel;
    labelWidth?: string;
    size?: string;
    submitting?: boolean;
    title: string;
  }>(),
  {
    initialValues: undefined,
    labelWidth: "88px",
    size: "480px",
    submitting: false,
  },
);

const open = defineModel<boolean>({ required: true });

const emit = defineEmits<{
  submit: [values: AdminFormModel];
}>();

defineSlots<{
  [name: `field-${string}`]:
    | ((props: { field: AdminFormField; model: AdminFormModel }) => unknown)
    | undefined;
}>();

const formRef = useTemplateRef<FormInstance>("formRef");
// 表单值由抽屉内部持有，避免变异使用方传入的对象；提交时交出快照
const model = reactive<AdminFormModel>({});
const rules = computed(() => buildFormRules(props.fields));
// 条件显隐：隐藏字段不渲染也不参与校验（ElForm 只校验已注册的表单项）
const visibleFields = computed(() => props.fields.filter((f) => !f.visible || f.visible(model)));

// 每次打开都按 schema 默认值 + initialValues 重建，保证编辑/新增互不残留
watch(
  open,
  async (value) => {
    if (!value) {
      return;
    }

    for (const key of Object.keys(model)) {
      delete model[key];
    }
    Object.assign(model, buildFormModel(props.fields), props.initialValues);

    await nextTick();
    formRef.value?.clearValidate();
  },
  { immediate: true },
);

async function handleConfirm() {
  const valid = await (formRef.value?.validate().catch(() => false) ?? Promise.resolve(true));

  if (!valid) {
    return;
  }

  emit("submit", { ...model });
}

function handleCancel() {
  open.value = false;
}

defineExpose({ formRef });
</script>

<template>
  <ElDrawer
    v-model="open"
    class="admin-form-drawer"
    :close-on-click-modal="!props.submitting"
    :close-on-press-escape="!props.submitting"
    :size="props.size"
    :title="props.title"
  >
    <ElForm
      ref="formRef"
      label-position="right"
      :label-width="props.labelWidth"
      :model="model"
      :rules="rules"
      @submit.prevent
    >
      <ElFormItem
        v-for="field in visibleFields"
        :key="field.key"
        :label="field.label"
        :prop="field.key"
      >
        <slot v-if="field.slot" :name="`field-${field.slot}`" :field="field" :model="model" />
        <AdminFormFieldControl v-else v-model="model[field.key]" :field="field" />
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton :disabled="props.submitting" @click="handleCancel">取 消</ElButton>
      <ElButton :loading="props.submitting" type="primary" @click="handleConfirm">确 认</ElButton>
    </template>
  </ElDrawer>
</template>

<style scoped>
.admin-form-drawer :deep(.el-date-editor) {
  width: 100%;
}
</style>
