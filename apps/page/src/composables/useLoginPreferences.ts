import { computed } from "vue";

import {
  setAuthPageLayout,
  setLocale,
  setPrimaryColor,
  themePrimaryOptions,
  usePreferences,
  type AppTheme,
  type LoginLayout as PreferenceLoginLayout,
  type LoginLocale as PreferenceLoginLocale,
} from "@/composables/preferences";

export type LoginLayout = PreferenceLoginLayout;
export type LoginLocale = PreferenceLoginLocale;
export type LoginTheme = AppTheme;

const layoutOptions: Array<{
  label: Record<LoginLocale, string>;
  value: LoginLayout;
}> = [
  {
    label: {
      "en-US": "Right panel",
      "zh-CN": "右侧面板",
    },
    value: "right",
  },
  {
    label: {
      "en-US": "Left panel",
      "zh-CN": "左侧面板",
    },
    value: "left",
  },
  {
    label: {
      "en-US": "Center panel",
      "zh-CN": "居中面板",
    },
    value: "center",
  },
];

const zhLabels = {
  accountTip: "还没有账号?",
  captchaPassed: "验证通过",
  captchaTip: "请按住滑块拖动",
  copyright: "Copyright © 2026 Admin Backend",
  createAccount: "创建账号",
  forgetPassword: "忘记密码?",
  layout: "布局",
  login: "登录",
  loginSuccess: "登录成功",
  loginSubtitle: "请输入您的账户信息以开始管理您的项目",
  mobileLogin: "手机号登录",
  pageDescription: "工程化、高性能、跨组件库的前端模版",
  pageTitle: "开箱即用的大型中后台管理系统",
  password: "密码",
  qrcodeLogin: "扫码登录",
  rememberMe: "记住账号",
  selectAccount: "快速选择账号",
  theme: "暗黑模式",
  themeColor: "主题色",
  thirdPartyLogin: "其他登录方式",
  username: "请输入用户名",
  usernamePasswordRequired: "请输入用户名和密码",
  verifyRequired: "请先完成滑块验证",
  welcomeBack: "欢迎回来",
};

const enLabels: typeof zhLabels = {
  accountTip: "No account yet?",
  captchaPassed: "Verified",
  captchaTip: "Hold and slide",
  copyright: "Copyright © 2026 Admin Backend",
  createAccount: "Create account",
  forgetPassword: "Forgot password?",
  layout: "Layout",
  login: "Login",
  loginSuccess: "Login successful",
  loginSubtitle: "Enter your account information to start managing your project",
  mobileLogin: "Mobile login",
  pageDescription: "Engineering, high performance, cross-component frontend template",
  pageTitle: "Ready-to-use enterprise admin system",
  password: "Password",
  qrcodeLogin: "QR code login",
  rememberMe: "Remember me",
  selectAccount: "Select account",
  theme: "Theme",
  themeColor: "Theme color",
  thirdPartyLogin: "Other login methods",
  username: "Username",
  usernamePasswordRequired: "Please enter username and password",
  verifyRequired: "Please complete slider verification first",
  welcomeBack: "Welcome back",
};

export function useLoginPreferences() {
  const { isDark, preferences, theme, toggleTheme } = usePreferences();
  const layout = computed(() => preferences.app.authPageLayout);
  const locale = computed(() => preferences.app.locale);
  const primaryColor = computed(() => preferences.theme.colorPrimary);

  const labels = computed(() => (locale.value === "zh-CN" ? zhLabels : enLabels));

  function setLayout(value: LoginLayout) {
    setAuthPageLayout(value);
  }

  function toggleLocale() {
    setLocale(locale.value === "zh-CN" ? "en-US" : "zh-CN");
  }

  return {
    colorOptions: themePrimaryOptions,
    isDark,
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
  };
}
