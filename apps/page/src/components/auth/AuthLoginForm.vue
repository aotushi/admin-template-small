<script setup lang="ts">
import { computed, reactive, shallowRef } from "vue";

import AuthGithubIcon from "@/components/auth/icons/AuthGithubIcon.vue";
import AuthGoogleIcon from "@/components/auth/icons/AuthGoogleIcon.vue";
import AuthQqIcon from "@/components/auth/icons/AuthQqIcon.vue";
import AuthSliderCaptcha from "@/components/auth/AuthSliderCaptcha.vue";
import AuthWechatIcon from "@/components/auth/icons/AuthWechatIcon.vue";

import type { LoginTheme } from "@/composables/useLoginPreferences";

interface LoginLabels {
  accountTip: string;
  captchaPassed: string;
  captchaTip: string;
  createAccount: string;
  forgetPassword: string;
  login: string;
  loginSubtitle: string;
  mobileLogin: string;
  password: string;
  qrcodeLogin: string;
  rememberMe: string;
  selectAccount: string;
  thirdPartyLogin: string;
  username: string;
  welcomeBack: string;
}

interface QuickAccount {
  label: string;
  password: string;
  username: string;
}

const props = defineProps<{
  labels: LoginLabels;
  loading: boolean;
  quickAccounts: QuickAccount[];
  theme: LoginTheme;
}>();

const emit = defineEmits<{
  submit: [value: { password: string; username: string; verified: boolean }];
}>();

const defaultAccount = props.quickAccounts[0];
const remember = shallowRef(true);
const quickAccount = shallowRef(defaultAccount?.username ?? "");
const captchaPassed = shallowRef(false);
const form = reactive({
  password: defaultAccount?.password ?? "",
  username: defaultAccount?.username ?? "",
});
const selectPopperClass = computed(() =>
  ["auth-login__select-popper", `auth-login__select-popper--${props.theme}`].join(" "),
);

const thirdPartyIcons = [
  {
    alt: "Wechat",
    icon: AuthWechatIcon,
  },
  {
    alt: "QQ",
    icon: AuthQqIcon,
  },
  {
    alt: "GitHub",
    icon: AuthGithubIcon,
  },
  {
    alt: "Google",
    icon: AuthGoogleIcon,
  },
];

function handleQuickAccount(value: string, accounts: QuickAccount[]) {
  const account = accounts.find((item) => item.username === value);

  if (!account) {
    return;
  }

  form.username = account.username;
  form.password = account.password;
}

function handleSubmit() {
  emit("submit", {
    password: form.password,
    username: form.username,
    verified: captchaPassed.value,
  });
}
</script>

<template>
  <div class="auth-login" @keydown.enter.prevent="handleSubmit">
    <header class="auth-login__header">
      <h2>
        {{ labels.welcomeBack }}
        <span aria-hidden="true">👋🏻</span>
      </h2>
      <p>{{ labels.loginSubtitle }}</p>
    </header>

    <form class="auth-login__form" @submit.prevent="handleSubmit">
      <ElSelect
        v-model="quickAccount"
        class="auth-login__control"
        :popper-class="selectPopperClass"
        :placeholder="labels.selectAccount"
        size="large"
        @change="handleQuickAccount($event, quickAccounts)"
      >
        <ElOption
          v-for="account in quickAccounts"
          :key="account.username"
          :label="account.label"
          :value="account.username"
        />
      </ElSelect>

      <ElInput
        v-model="form.username"
        autocomplete="username"
        class="auth-login__control"
        :placeholder="labels.username"
        size="large"
      />

      <ElInput
        v-model="form.password"
        autocomplete="current-password"
        class="auth-login__control"
        :placeholder="labels.password"
        show-password
        size="large"
        type="password"
      />

      <AuthSliderCaptcha
        v-model="captchaPassed"
        class="auth-login__control"
        :success-text="labels.captchaPassed"
        :text="labels.captchaTip"
      />

      <div class="auth-login__row">
        <ElCheckbox v-model="remember">{{ labels.rememberMe }}</ElCheckbox>
        <RouterLink to="/login/forgot-password" :aria-label="labels.forgetPassword">
          {{ labels.forgetPassword }}
        </RouterLink>
      </div>

      <ElButton
        :loading="loading"
        class="auth-login__submit"
        native-type="submit"
        size="large"
        type="primary"
      >
        {{ labels.login }}
      </ElButton>

      <div class="auth-login__alt">
        <RouterLink class="auth-login__alt-button" to="/login/mobile">
          {{ labels.mobileLogin }}
        </RouterLink>
        <RouterLink class="auth-login__alt-button" to="/login/qrcode">
          {{ labels.qrcodeLogin }}
        </RouterLink>
      </div>

      <div class="auth-login__divider">
        <span />
        <strong>{{ labels.thirdPartyLogin }}</strong>
        <span />
      </div>

      <div class="auth-login__providers" aria-label="其他登录方式">
        <button
          v-for="provider in thirdPartyIcons"
          :key="provider.alt"
          class="auth-login__provider"
          type="button"
          :aria-label="provider.alt"
        >
          <component :is="provider.icon" class="auth-login__provider-icon" />
        </button>
      </div>

      <p class="auth-login__register">
        {{ labels.accountTip }}
        <RouterLink to="/login/register">{{ labels.createAccount }}</RouterLink>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-login__header {
  margin-bottom: 28px;
}

.auth-login__header h2 {
  margin: 0 0 12px;
  color: var(--auth-text);
  font-size: 36px;
  font-weight: 700;
  line-height: 40px;
  letter-spacing: 0;
}

.auth-login__header p {
  margin: 0;
  color: var(--auth-muted);
  font-size: 14px;
  line-height: 20px;
}

.auth-login__form {
  display: block;
  font-family: var(--font-family);
}

.auth-login__control {
  width: calc(100% - 2px);
  margin-right: 1px;
  margin-bottom: 18px;
  margin-left: 1px;
}

.auth-login__form :deep(.el-select) {
  height: 36px;
}

.auth-login__form :deep(.el-input) {
  height: 40px;
}

.auth-login__form :deep(.el-input__wrapper),
.auth-login__form :deep(.el-select__wrapper) {
  padding: 0 12px;
  color: var(--auth-text);
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  background: var(--auth-input-bg);
  border: 1px solid var(--auth-border);
  border-radius: 6px;
  box-shadow: none;
}

.auth-login__form :deep(.el-input__wrapper) {
  height: 40px;
  min-height: 40px;
}

.auth-login__form :deep(.el-select__wrapper) {
  height: 36px;
  min-height: 36px;
}

.auth-login__form :deep(.el-input__wrapper:hover),
.auth-login__form :deep(.el-select__wrapper:hover),
.auth-login__form :deep(.el-input__wrapper.is-focus),
.auth-login__form :deep(.el-select__wrapper.is-focused) {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 18%);
}

.auth-login__form :deep(.el-input__inner),
.auth-login__form :deep(.el-select__placeholder),
.auth-login__form :deep(.el-select__selected-item) {
  height: 20px;
  color: var(--auth-text);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.auth-login__form :deep(.el-input__inner::placeholder),
.auth-login__form :deep(.el-select__placeholder) {
  color: hsl(var(--muted-foreground) / 50%);
}

.auth-login__form :deep(.el-checkbox) {
  height: 20px;
}

.auth-login__form :deep(.el-checkbox__label) {
  color: var(--auth-text);
  font-size: 14px;
}

.auth-login__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
}

.auth-login__row a,
.auth-login__register a {
  color: hsl(var(--primary));
}

.auth-login__submit {
  width: 100%;
  height: 36px;
  margin-top: 0;
  border-radius: 6px;
  color: hsl(var(--primary-foreground));
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
  padding: 8px 16px;
}

.auth-login__submit:hover {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary) / 90%);
  border-color: hsl(var(--primary) / 90%);
}

.auth-login__alt {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
  margin-bottom: 8px;
}

.auth-login__alt-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 36px;
  margin: 0;
  color: var(--auth-text);
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  background: transparent;
  border: 1px solid var(--auth-border);
  border-radius: 6px;
  padding: 8px 16px;
}

.auth-login__alt-button:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 35%);
}

.auth-login__divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
}

.auth-login__divider span {
  flex: 1;
  height: 1px;
  background: var(--auth-border);
}

.auth-login__divider strong {
  color: var(--auth-muted);
  font-size: 12px;
  font-weight: 400;
}

.auth-login__providers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}

.auth-login__provider {
  display: grid;
  width: 32px;
  height: 32px;
  margin-bottom: 12px;
  color: var(--auth-text);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 999px;
  place-items: center;
}

.auth-login__provider:hover {
  background: var(--auth-toolbar-hover);
}

.auth-login__provider-icon {
  display: block;
  width: 16px;
  height: 16px;
}

.auth-login__register {
  margin: 0;
  color: var(--auth-text);
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

:global(.auth-login__select-popper) {
  border: 1px solid var(--auth-select-popper-border) !important;
  border-radius: 6px !important;
  background: var(--auth-select-popper-bg) !important;
  box-shadow: var(--auth-select-popper-shadow) !important;
}

:global(.auth-login__select-popper--dark) {
  --auth-select-popper-bg: hsl(220deg 13.06% 9%);
  --auth-select-popper-border: hsl(0deg 0% 100% / 10%);
  --auth-select-popper-shadow: 0 12px 36px hsl(0 0% 0% / 28%);
  --auth-select-option-text: hsl(0 0% 95%);
  --auth-select-option-hover-bg: hsl(216 5% 24%);
  --auth-select-option-hover-text: hsl(0 0% 98%);
}

:global(.auth-login__select-popper--light) {
  --auth-select-popper-bg: hsl(0 0% 100%);
  --auth-select-popper-border: hsl(240 5.9% 90%);
  --auth-select-popper-shadow: 0 12px 36px hsl(220 24% 20% / 12%);
  --auth-select-option-text: hsl(210 6% 21%);
  --auth-select-option-hover-bg: hsl(216 14% 93%);
  --auth-select-option-hover-text: hsl(210 6% 21%);
}

:global(.auth-login__select-popper .el-popper__arrow::before) {
  border-color: var(--auth-select-popper-border) !important;
  background: var(--auth-select-popper-bg) !important;
}

:global(.auth-login__select-popper .el-select-dropdown__list) {
  padding: 4px;
}

:global(.auth-login__select-popper .el-select-dropdown__item) {
  height: 32px;
  border-radius: 4px;
  color: var(--auth-select-option-text);
  font-size: 14px;
  line-height: 32px;
}

:global(.auth-login__select-popper .el-select-dropdown__item.is-hovering),
:global(.auth-login__select-popper .el-select-dropdown__item.is-selected) {
  color: var(--auth-select-option-hover-text);
  background: var(--auth-select-option-hover-bg);
}

@media (max-width: 640px) {
  .auth-login__header h2 {
    font-size: 30px;
    line-height: 36px;
  }

  .auth-login__alt {
    gap: 10px;
  }
}
</style>
