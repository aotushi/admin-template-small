<script setup lang="ts">
import { computed, shallowRef } from "vue";

import type { LoginLayout, LoginLocale, LoginTheme } from "@/composables/useLoginPreferences";

const props = defineProps<{
  colorOptions: ReadonlyArray<{
    label: string;
    value: string;
  }>;
  layout: LoginLayout;
  layoutOptions: ReadonlyArray<{
    label: Record<LoginLocale, string>;
    value: LoginLayout;
  }>;
  locale: LoginLocale;
  primaryColor: string;
  theme: LoginTheme;
}>();

const emit = defineEmits<{
  setLayout: [value: LoginLayout];
  setPrimaryColor: [value: string];
  toggleLocale: [];
  toggleTheme: [];
}>();

type PanelName = "color" | "layout";

const activePanel = shallowRef<PanelName | null>(null);
const localeText = computed(() => (props.locale === "zh-CN" ? "中" : "EN"));
const nextLocaleText = computed(() => (props.locale === "zh-CN" ? "English" : "中文"));

function togglePanel(name: PanelName) {
  activePanel.value = activePanel.value === name ? null : name;
}

function chooseColor(value: string) {
  emit("setPrimaryColor", value);
  activePanel.value = null;
}

function chooseLayout(value: LoginLayout) {
  emit("setLayout", value);
  activePanel.value = null;
}
</script>

<template>
  <div class="auth-toolbar" aria-label="页面工具">
    <button
      class="auth-toolbar__tool auth-toolbar__tool--desktop"
      type="button"
      aria-label="主题色"
      :aria-expanded="activePanel === 'color'"
      @click="togglePanel('color')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 22a10 10 0 1 1 9.94-8.87 2.8 2.8 0 0 1-2.77 3.11h-1.05a2 2 0 0 0-1.74 2.96l.17.29A1.68 1.68 0 0 1 15.11 22H12Z"
        />
        <circle cx="7.5" cy="10.5" r="1.1" />
        <circle cx="10.5" cy="7.5" r="1.1" />
        <circle cx="14.5" cy="7.5" r="1.1" />
        <circle cx="17" cy="11" r="1.1" />
      </svg>
    </button>
    <button
      class="auth-toolbar__tool auth-toolbar__tool--desktop"
      type="button"
      aria-label="布局"
      :aria-expanded="activePanel === 'layout'"
      @click="togglePanel('layout')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </svg>
    </button>
    <button
      class="auth-toolbar__tool"
      type="button"
      :aria-label="`切换语言到 ${nextLocaleText}`"
      @click="$emit('toggleLocale')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 8 6 6" />
        <path d="m4 14 6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="m22 22-5-10-5 10" />
        <path d="M14 18h6" />
      </svg>
      <span class="auth-toolbar__locale">{{ localeText }}</span>
    </button>
    <button
      class="auth-toolbar__tool"
      type="button"
      aria-label="暗黑模式"
      @click="$emit('toggleTheme')"
    >
      <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 7.4 8 8 0 1 1-9-7.4Z" />
      </svg>
    </button>

    <div v-if="activePanel === 'color'" class="auth-toolbar__panel auth-toolbar__panel--color">
      <button
        v-for="option in colorOptions"
        :key="option.value"
        class="auth-toolbar__swatch"
        :class="{ 'is-active': option.value === primaryColor }"
        type="button"
        :aria-label="option.label"
        :style="{ backgroundColor: option.value }"
        @click="chooseColor(option.value)"
      />
    </div>

    <div v-if="activePanel === 'layout'" class="auth-toolbar__panel auth-toolbar__panel--layout">
      <button
        v-for="option in layoutOptions"
        :key="option.value"
        class="auth-toolbar__layout"
        :class="{ 'is-active': option.value === layout }"
        type="button"
        @click="chooseLayout(option.value)"
      >
        {{ option.label[locale] }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.auth-toolbar {
  position: absolute;
  top: 16px;
  right: 8px;
  z-index: 20;
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: var(--auth-toolbar-bg);
  border-radius: 999px;
}

.auth-toolbar__tool {
  display: inline-grid;
  width: 28px;
  height: 28px;
  color: var(--auth-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 999px;
  place-items: center;
}

.auth-toolbar__tool svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.auth-toolbar__tool svg circle:not(:first-child) {
  fill: currentcolor;
  stroke: none;
}

.auth-toolbar__locale {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.auth-toolbar__tool:hover,
.auth-toolbar__tool[aria-expanded="true"] {
  color: var(--auth-text);
  background: var(--auth-toolbar-hover);
}

.auth-toolbar__panel {
  position: absolute;
  top: 42px;
  right: 0;
  padding: 10px;
  background: var(--auth-panel-float-bg);
  border: 1px solid var(--auth-border);
  border-radius: 10px;
  box-shadow: 0 12px 36px hsl(0 0% 0% / 28%);
}

.auth-toolbar__panel--color {
  display: grid;
  grid-template-columns: repeat(5, 24px);
  gap: 8px;
}

.auth-toolbar__panel--layout {
  display: grid;
  width: 130px;
  gap: 6px;
}

.auth-toolbar__swatch {
  width: 24px;
  height: 24px;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 999px;
}

.auth-toolbar__swatch.is-active {
  border-color: var(--auth-text);
}

.auth-toolbar__layout {
  height: 30px;
  color: var(--auth-muted);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  text-align: left;
}

.auth-toolbar__layout:hover,
.auth-toolbar__layout.is-active {
  color: var(--auth-text);
  background: var(--auth-toolbar-hover);
}

@media (max-width: 640px) {
  .auth-toolbar {
    right: 12px;
  }

  .auth-toolbar__tool--desktop {
    display: none;
  }
}
</style>
