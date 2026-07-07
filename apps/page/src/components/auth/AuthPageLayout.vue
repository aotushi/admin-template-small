<script setup lang="ts">
import { computed } from "vue";

import VbenSlogan from "@/components/auth/VbenSlogan.vue";
import AppLogo from "@/components/layout/AppLogo.vue";

import type { LoginLayout, LoginTheme } from "@/composables/useLoginPreferences";

const props = defineProps<{
  copyright: string;
  layout: LoginLayout;
  pageDescription: string;
  pageTitle: string;
  theme: LoginTheme;
}>();

const pageClasses = computed(() => [`auth-page--${props.theme}`, `auth-page--${props.layout}`]);
const logoTheme = computed(() => (props.theme === "dark" ? "dark" : "light"));
</script>

<template>
  <main class="auth-page" :class="pageClasses">
    <slot name="toolbar" />

    <div class="auth-page__logo">
      <AppLogo text="Admin Backend" :theme="logoTheme" :size="42" />
    </div>

    <section v-if="layout !== 'center'" class="auth-page__intro">
      <div class="auth-page__background" />
      <div class="auth-page__intro-inner">
        <VbenSlogan class="auth-page__slogan" />
        <h1 class="auth-page__page-title">{{ pageTitle }}</h1>
        <p class="auth-page__page-description">{{ pageDescription }}</p>
      </div>
    </section>

    <section class="auth-page__auth">
      <div v-if="layout === 'center'" class="auth-page__background" />

      <div class="auth-page__auth-inner">
        <div class="auth-page__mobile-logo">
          <AppLogo text="Admin Backend" :theme="logoTheme" :size="36" />
        </div>
        <slot />
      </div>

      <footer class="auth-page__copyright">{{ copyright }}</footer>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  --auth-bg: #070709;
  --auth-panel-bg: hsl(220deg 13.06% 9%);
  --auth-text: hsl(0 0% 95%);
  --auth-muted: hsl(240 5% 64.9%);
  --auth-border: hsl(0deg 0% 100% / 10%);
  --auth-input-bg: hsl(0deg 0% 100% / 5%);
  --auth-toolbar-bg: hsl(216 5% 19%);
  --auth-toolbar-hover: hsl(216 5% 24%);
  --auth-panel-float-bg: hsl(220deg 13.06% 9%);
  --auth-captcha-bg: hsl(220deg 13.06% 9%);
  --el-border-radius-base: 6px;
  --el-color-primary: hsl(var(--primary));
  --el-color-primary-light-3: hsl(var(--primary) / 90%);
  --el-color-primary-light-5: hsl(var(--primary) / 70%);
  --el-color-primary-light-7: hsl(var(--primary) / 45%);
  --el-color-primary-light-8: hsl(var(--primary) / 30%);
  --el-color-primary-light-9: hsl(var(--primary) / 15%);
  --el-color-primary-dark-2: hsl(var(--primary) / 90%);

  position: relative;
  display: flex;
  min-height: 100vh;
  overflow-x: hidden;
  color: var(--auth-text);
  font-family: var(--font-family);
  user-select: none;
  background: var(--auth-bg);
}

.auth-page--light {
  --auth-bg: hsl(216 20.11% 95.47%);
  --auth-panel-bg: hsl(0 0% 100%);
  --auth-text: hsl(210 6% 21%);
  --auth-muted: hsl(240 3.8% 46.1%);
  --auth-border: hsl(240 5.9% 90%);
  --auth-input-bg: hsl(0 0% 100%);
  --auth-toolbar-bg: hsl(240 5% 96%);
  --auth-toolbar-hover: hsl(216 14% 93%);
  --auth-panel-float-bg: hsl(0 0% 100%);
  --auth-captcha-bg: hsl(216 20.11% 95.47%);
}

.auth-page--left {
  flex-direction: row-reverse;
}

.auth-page__logo {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  display: flex;
  height: 42px;
  align-items: center;
}

.auth-page--left .auth-page__logo {
  right: 16px;
  left: auto;
}

.auth-page--center .auth-page__logo {
  right: auto;
  left: 16px;
}

.auth-page__intro {
  position: relative;
  display: block;
  width: 60%;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  background: var(--auth-bg);
}

.auth-page__background {
  position: absolute;
  inset: 0;
  background: linear-gradient(154deg, #07070915 30%, hsl(var(--primary) / 20%) 48%, #07070915 64%);
  filter: blur(100px);
}

.auth-page--light .auth-page__background {
  background: linear-gradient(
    154deg,
    transparent 28%,
    hsl(var(--primary) / 24%) 48%,
    transparent 66%
  );
}

.auth-page__intro-inner {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-right: 80px;
}

.auth-page--left .auth-page__intro-inner {
  padding-right: 0;
  padding-left: 80px;
}

.auth-page__slogan {
  width: 40%;
  height: 256px;
  animation: auth-float 5s linear infinite;
}

.auth-page__page-title {
  margin: 24px 0 0;
  color: var(--auth-text);
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}

.auth-page__page-description {
  margin: 8px 0 0;
  color: var(--auth-muted);
  font-size: 16px;
  line-height: 24px;
}

.auth-page__auth {
  position: relative;
  display: flex;
  width: 40%;
  min-width: 468px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  background: var(--auth-panel-bg);
}

.auth-page--center .auth-page__auth {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  background: var(--auth-bg);
}

.auth-page__auth-inner {
  position: relative;
  z-index: 1;
  width: min(448px, 100%);
  transform: translateY(7px);
}

.auth-page--center .auth-page__auth-inner {
  width: min(520px, calc(100vw - 40px));
  padding: 36px 48px 68px;
  transform: none;
  background: var(--auth-panel-bg);
  border: 1px solid var(--auth-border);
  border-radius: 24px;
  box-shadow: 0 18px 70px hsl(var(--primary) / 8%);
}

.auth-page__mobile-logo {
  display: none;
  height: 44px;
  margin-bottom: 32px;
}

.auth-page__copyright {
  position: absolute;
  right: 0;
  bottom: 12px;
  left: 0;
  z-index: 1;
  color: var(--auth-muted);
  font-size: 12px;
  text-align: center;
}

@keyframes auth-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-20px);
  }
}

@media (max-width: 1080px) {
  .auth-page__intro,
  .auth-page__logo {
    display: none;
  }

  .auth-page__auth {
    width: 100%;
    min-width: 0;
  }

  .auth-page__mobile-logo {
    display: flex;
  }
}

@media (max-width: 640px) {
  .auth-page__auth {
    padding: 40px 20px;
  }

  .auth-page--center .auth-page__auth-inner {
    width: 100%;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
