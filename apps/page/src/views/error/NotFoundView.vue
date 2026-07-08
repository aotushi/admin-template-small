<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

function goDashboard() {
  return router.replace("/dashboard");
}
</script>

<template>
  <main class="error-page">
    <section class="error-page__panel">
      <p class="error-page__code">404</p>
      <h1 class="error-page__title">页面不存在</h1>
      <p class="error-page__description">当前地址没有匹配的页面。</p>
      <ElButton type="primary" @click="goDashboard">返回概览</ElButton>
    </section>
  </main>
</template>

<style scoped>
.error-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: #f5f7fb;
  padding: 24px;
}

.error-page__panel {
  width: min(520px, 100%);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 32px;
  text-align: center;
  box-shadow: 0 18px 45px rgb(15 23 42 / 8%);
}

.error-page__code {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 36px;
  font-weight: 700;
}

.error-page__title {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.2;
}

.error-page__description {
  margin: 12px 0 24px;
  color: #4b5563;
  font-size: 15px;
  line-height: 1.7;
}
</style>
