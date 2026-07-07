<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import { clearAuthSession, getStoredUser } from "@/api/session";

const router = useRouter();
const user = computed(() => getStoredUser());

async function handleLogout() {
  clearAuthSession();
  await router.replace("/login");
}
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-panel">
      <p class="dashboard-panel__eyebrow">Admin Backend 3</p>
      <h1 class="dashboard-panel__title">登录成功</h1>
      <p class="dashboard-panel__description">
        当前页面用于验证登录成功后的跳转链路，后续再替换为正式后台首页。
      </p>

      <dl class="dashboard-panel__meta">
        <div>
          <dt>用户</dt>
          <dd>{{ user?.username || "-" }}</dd>
        </div>
        <div>
          <dt>角色</dt>
          <dd>{{ user?.role || "-" }}</dd>
        </div>
        <div>
          <dt>管理员层级</dt>
          <dd>{{ user?.admin_level || "-" }}</dd>
        </div>
      </dl>

      <ElButton type="primary" @click="handleLogout">退出登录</ElButton>
    </section>
  </main>
</template>

<style scoped>
.dashboard-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: #f5f7fb;
  padding: 24px;
}

.dashboard-panel {
  width: min(520px, 100%);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 32px;
  box-shadow: 0 18px 45px rgb(15 23 42 / 8%);
}

.dashboard-panel__eyebrow {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
}

.dashboard-panel__title {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.2;
}

.dashboard-panel__description {
  margin: 12px 0 24px;
  color: #4b5563;
  font-size: 15px;
  line-height: 1.7;
}

.dashboard-panel__meta {
  display: grid;
  gap: 12px;
  margin: 0 0 24px;
}

.dashboard-panel__meta div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #eef2f7;
  padding-bottom: 12px;
}

.dashboard-panel__meta dt {
  color: #6b7280;
  font-size: 14px;
}

.dashboard-panel__meta dd {
  margin: 0;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}
</style>
