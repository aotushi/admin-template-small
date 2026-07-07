import { computed, shallowRef, watch } from "vue";

export type LoginLayout = "center" | "left" | "right";
export type LoginLocale = "en-US" | "zh-CN";
export type LoginTheme = "dark" | "light";

const STORAGE_PREFIX = "admin-backend-3-page-login";

const colorOptions = [
  {
    label: "Blue",
    value: "212 100% 45%",
  },
  {
    label: "Violet",
    value: "262 83% 58%",
  },
  {
    label: "Sky",
    value: "198 93% 48%",
  },
  {
    label: "Emerald",
    value: "154 59% 45%",
  },
  {
    label: "Rose",
    value: "346 77% 50%",
  },
] as const;

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

function readStored<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const stored = window.localStorage.getItem(`${STORAGE_PREFIX}-${key}`);
  return allowed.includes(stored as T) ? (stored as T) : fallback;
}

export function useLoginPreferences() {
  const theme = shallowRef<LoginTheme>(readStored("theme", "dark", ["dark", "light"]));
  const layout = shallowRef<LoginLayout>(
    readStored("layout", "right", ["right", "left", "center"]),
  );
  const locale = shallowRef<LoginLocale>(readStored("locale", "zh-CN", ["zh-CN", "en-US"]));
  const primaryColor = shallowRef(
    window.localStorage.getItem(`${STORAGE_PREFIX}-primary`) || colorOptions[0].value,
  );

  const labels = computed(() => (locale.value === "zh-CN" ? zhLabels : enLabels));
  const isDark = computed(() => theme.value === "dark");

  watch(
    theme,
    (value) => {
      window.localStorage.setItem(`${STORAGE_PREFIX}-theme`, value);
    },
    { immediate: true },
  );

  watch(
    layout,
    (value) => {
      window.localStorage.setItem(`${STORAGE_PREFIX}-layout`, value);
    },
    { immediate: true },
  );

  watch(
    locale,
    (value) => {
      window.localStorage.setItem(`${STORAGE_PREFIX}-locale`, value);
    },
    { immediate: true },
  );

  watch(
    primaryColor,
    (value) => {
      document.documentElement.style.setProperty("--primary", value);
      window.localStorage.setItem(`${STORAGE_PREFIX}-primary`, value);
    },
    { immediate: true },
  );

  function setLayout(value: LoginLayout) {
    layout.value = value;
  }

  function setPrimaryColor(value: string) {
    primaryColor.value = value;
  }

  function toggleLocale() {
    locale.value = locale.value === "zh-CN" ? "en-US" : "zh-CN";
  }

  function toggleTheme() {
    theme.value = theme.value === "dark" ? "light" : "dark";
  }

  return {
    colorOptions,
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
