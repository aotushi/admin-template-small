<script setup lang="ts">
import { computed, ref } from "vue";
import { Bell } from "@element-plus/icons-vue";

interface NotificationItem {
  id: number;
  isRead: boolean;
  message: string;
  time: string;
  title: string;
}

const notifications = ref<NotificationItem[]>([
  {
    id: 1,
    isRead: false,
    message: "昨日数据报表已完成生成，等待审核。",
    time: "刚刚",
    title: "报表生成完成",
  },
  {
    id: 2,
    isRead: false,
    message: "有 2 个 Excel 文件解析失败，请检查上传内容。",
    time: "12 分钟前",
    title: "文件处理提醒",
  },
  {
    id: 3,
    isRead: true,
    message: "管理员更新了 API Key 使用策略。",
    time: "今天 09:30",
    title: "系统策略更新",
  },
]);

const unreadCount = computed(() => notifications.value.filter((item) => !item.isRead).length);
const hasUnread = computed(() => unreadCount.value > 0);

function markAllRead() {
  notifications.value = notifications.value.map((item) => ({
    ...item,
    isRead: true,
  }));
}

function clearNotifications() {
  notifications.value = [];
}
</script>

<template>
  <ElPopover
    popper-class="admin-notifications-popover"
    placement="bottom-end"
    trigger="click"
    :width="336"
  >
    <template #reference>
      <button class="admin-notifications__button" type="button" aria-label="通知">
        <ElBadge :hidden="!hasUnread" is-dot>
          <ElIcon>
            <Bell />
          </ElIcon>
        </ElBadge>
      </button>
    </template>

    <section class="admin-notifications">
      <header class="admin-notifications__header">
        <div>
          <h2 class="admin-notifications__title">通知</h2>
          <p class="admin-notifications__subtitle">{{ unreadCount }} 条未读</p>
        </div>
        <button class="admin-notifications__link" type="button" @click="markAllRead">
          全部已读
        </button>
      </header>

      <div v-if="notifications.length" class="admin-notifications__list">
        <article
          v-for="item in notifications"
          :key="item.id"
          class="admin-notifications__item"
          :class="{ 'is-unread': !item.isRead }"
        >
          <span class="admin-notifications__status" aria-hidden="true" />
          <div class="admin-notifications__body">
            <h3 class="admin-notifications__item-title">{{ item.title }}</h3>
            <p class="admin-notifications__message">{{ item.message }}</p>
            <time class="admin-notifications__time">{{ item.time }}</time>
          </div>
        </article>
      </div>

      <p v-else class="admin-notifications__empty">暂无通知</p>

      <footer class="admin-notifications__footer">
        <button class="admin-notifications__link" type="button" @click="clearNotifications">
          清空通知
        </button>
      </footer>
    </section>
  </ElPopover>
</template>

<style scoped>
.admin-notifications__button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  place-items: center;
}

.admin-notifications__button:hover {
  background: hsl(var(--accent));
}

.admin-notifications__button .el-icon {
  font-size: 18px;
}

.admin-notifications {
  color: hsl(var(--foreground));
}

.admin-notifications__header,
.admin-notifications__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-notifications__header {
  padding-bottom: 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.admin-notifications__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.admin-notifications__subtitle {
  margin: 2px 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
}

.admin-notifications__link {
  color: hsl(var(--primary));
  cursor: pointer;
  background: transparent;
  border: 0;
  font-size: 13px;
}

.admin-notifications__list {
  display: grid;
  max-height: 300px;
  overflow: auto;
  padding: 8px 0;
}

.admin-notifications__item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
}

.admin-notifications__status {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  margin-top: 8px;
  background: hsl(var(--border));
  border-radius: 999px;
}

.admin-notifications__item.is-unread .admin-notifications__status {
  background: hsl(var(--primary));
}

.admin-notifications__body {
  min-width: 0;
}

.admin-notifications__item-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.admin-notifications__message {
  margin: 3px 0;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 20px;
}

.admin-notifications__time {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
}

.admin-notifications__empty {
  margin: 24px 0;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  text-align: center;
}

.admin-notifications__footer {
  padding-top: 10px;
  border-top: 1px solid hsl(var(--border));
}
</style>
