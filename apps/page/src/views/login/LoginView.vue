<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";

import { getApiErrorMessage } from "@/api/request";
import AuthLoginForm from "@/components/auth/AuthLoginForm.vue";
import AuthPageLayout from "@/components/auth/AuthPageLayout.vue";
import AuthToolbar from "@/components/auth/AuthToolbar.vue";
import { useLoginPreferences } from "@/composables/useLoginPreferences";
import { useLoginMutation } from "@/queries/auth";
import { resolvePostLoginRedirect } from "@/router/redirect";
import { quickAccounts } from "@/views/login/loginAccounts";

const route = useRoute();
const router = useRouter();
const loginMutation = useLoginMutation();
const {
  colorOptions,
  labels,
  layout,
  layoutOptions,
  locale,
  primaryColor,
  setLayout,
  setPrimaryColor,
  theme,
  toggleLocale,
  toggleTheme,
} = useLoginPreferences();
const submitting = computed(() => loginMutation.isLoading.value);

async function handleLogin(payload: { password: string; username: string; verified: boolean }) {
  if (!payload.username || !payload.password) {
    ElMessage.warning(labels.value.usernamePasswordRequired);
    return;
  }

  if (!payload.verified) {
    ElMessage.warning(labels.value.verifyRequired);
    return;
  }

  try {
    await loginMutation.mutateAsync({
      password: payload.password,
      username: payload.username,
    });

    ElMessage.success(labels.value.loginSuccess);
    await router.replace(resolvePostLoginRedirect(route.query.redirect));
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  }
}
</script>

<template>
  <AuthPageLayout
    :copyright="labels.copyright"
    :layout="layout"
    :page-description="labels.pageDescription"
    :page-title="labels.pageTitle"
    :theme="theme"
  >
    <template #toolbar>
      <AuthToolbar
        :color-options="colorOptions"
        :layout="layout"
        :layout-options="layoutOptions"
        :locale="locale"
        :primary-color="primaryColor"
        :theme="theme"
        @set-layout="setLayout"
        @set-primary-color="setPrimaryColor"
        @toggle-locale="toggleLocale"
        @toggle-theme="toggleTheme"
      />
    </template>

    <AuthLoginForm
      :labels="labels"
      :loading="submitting"
      :quick-accounts="quickAccounts"
      :theme="theme"
      @submit="handleLogin"
    />
  </AuthPageLayout>
</template>
