<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";

import type { AdminDepartmentTreeItem, AdminUserListItem } from "@/api/modules/users";
import { USER_ROLE_OPTIONS, toRoleOption, type UserRoleOption } from "../userRoleOptions";

export interface UserFormValue {
  departmentId: null | number;
  email: string;
  password: string;
  roleOption: UserRoleOption;
  username: string;
}

const props = defineProps<{
  /** 当前登录者是否可分配角色（仅总管理员） */
  canAssignRole: boolean;
  /** 部门候选树（用户只能挂到末级部门，超级管理员不归属部门） */
  departments: AdminDepartmentTreeItem[];
  mode: "create" | "edit";
  submitting: boolean;
  /** edit 模式的目标用户 */
  user?: AdminUserListItem | null;
}>();

const emit = defineEmits<{
  submit: [value: UserFormValue];
}>();

const visible = defineModel<boolean>("visible", { required: true });

const form = reactive<UserFormValue>({
  departmentId: null,
  email: "",
  password: "",
  roleOption: "user",
  username: "",
});
let formRef: FormInstance | null = null;

const isEdit = computed(() => props.mode === "edit");
const title = computed(() =>
  isEdit.value ? `编辑用户：${props.user?.username ?? ""}` : "新增用户",
);

const rules = computed<FormRules>(() => ({
  // 创建时部门必填（super 除外）：无部门用户对 dept 数据范围的查看者不可见
  departmentId:
    !isEdit.value && form.roleOption !== "super"
      ? [{ message: "请选择部门", required: true, trigger: "change", type: "number" }]
      : [],
  password: isEdit.value
    ? [{ max: 18, message: "密码长度应为8-18位", min: 8, trigger: "blur" }]
    : [
        { message: "请输入密码", required: true, trigger: "blur" },
        { message: "密码至少6个字符", min: 6, trigger: "blur" },
      ],
  username: isEdit.value
    ? []
    : [
        { message: "请输入用户名", required: true, trigger: "blur" },
        { message: "用户名至少3个字符", min: 3, trigger: "blur" },
      ],
}));

// 打开对话框时按模式重置表单
watch(visible, (nextVisible) => {
  if (!nextVisible) {
    return;
  }

  form.password = "";
  if (isEdit.value && props.user) {
    form.departmentId = props.user.department_id ?? null;
    form.email = props.user.email ?? "";
    form.roleOption = toRoleOption(props.user);
    form.username = props.user.username;
  } else {
    form.departmentId = null;
    form.email = "";
    form.roleOption = "user";
    form.username = "";
  }
});

// 超级管理员不归属部门（与后端强制清空规则一致）
watch(
  () => form.roleOption,
  (roleOption) => {
    if (roleOption === "super") {
      form.departmentId = null;
      formRef?.clearValidate("departmentId");
    }
  },
);

// 用户只能挂到末级部门（后端同样校验），非叶子节点仅作展开用
function isDepartmentDisabled(data: AdminDepartmentTreeItem) {
  return data.children.length > 0;
}

function setFormRef(instance: unknown) {
  formRef = instance as FormInstance | null;
}

async function handleSubmit() {
  if (formRef) {
    const valid = await formRef.validate().catch(() => false);
    if (!valid) {
      return;
    }
  }

  emit("submit", { ...form });
}
</script>

<template>
  <ElDialog v-model="visible" :close-on-click-modal="false" :title="title" width="480px">
    <ElForm :ref="setFormRef" label-width="80px" :model="form" :rules="rules">
      <ElFormItem label="用户名" prop="username">
        <ElInput v-model="form.username" :disabled="isEdit" placeholder="至少3个字符" />
      </ElFormItem>

      <ElFormItem label="密码" prop="password">
        <ElInput
          v-model="form.password"
          :placeholder="isEdit ? '留空则不修改（8-18位，数字/字母/符号至少两种）' : '至少6个字符'"
          show-password
          type="password"
        />
      </ElFormItem>

      <ElFormItem label="邮箱" prop="email">
        <ElInput v-model="form.email" placeholder="选填" />
      </ElFormItem>

      <ElFormItem label="角色" prop="roleOption">
        <ElSelect v-model="form.roleOption" :disabled="!canAssignRole" style="width: 100%">
          <ElOption
            v-for="option in USER_ROLE_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </ElSelect>
        <div v-if="!canAssignRole" class="user-form-dialog__hint">只有总管理员可以分配角色</div>
      </ElFormItem>

      <ElFormItem label="部门" prop="departmentId">
        <ElTreeSelect
          v-model="form.departmentId"
          check-strictly
          clearable
          :data="departments"
          default-expand-all
          :disabled="form.roleOption === 'super'"
          node-key="id"
          :placeholder="isEdit ? '选填，仅可选择末级部门' : '仅可选择末级部门'"
          :props="{ children: 'children', disabled: isDepartmentDisabled, label: 'name' }"
          style="width: 100%"
        />
        <div v-if="form.roleOption === 'super'" class="user-form-dialog__hint">
          超级管理员不归属部门
        </div>
      </ElFormItem>
    </ElForm>

    <template #footer>
      <ElButton @click="visible = false">取消</ElButton>
      <ElButton :loading="submitting" type="primary" @click="handleSubmit">
        {{ isEdit ? "保存" : "创建" }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.user-form-dialog__hint {
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}
</style>
