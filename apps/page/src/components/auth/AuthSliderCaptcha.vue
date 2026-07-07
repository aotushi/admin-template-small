<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import { Check, DArrowRight } from "@element-plus/icons-vue";

const props = defineProps<{
  successText: string;
  text: string;
}>();

const emit = defineEmits<{
  success: [value: { time: string }];
}>();

const modelValue = defineModel<boolean>({ default: false });

const wrapperRef = useTemplateRef<HTMLDivElement>("wrapperRef");
const actionRef = useTemplateRef<HTMLDivElement>("actionRef");

const actionLeft = shallowRef(0);
const barWidth = shallowRef(0);
const endTime = shallowRef(0);
const isMoving = shallowRef(false);
const isReturning = shallowRef(false);
const moveDistance = shallowRef(0);
const startTime = shallowRef(0);

const isDragging = computed(() => actionLeft.value > 10 && !modelValue.value);
const actionStyle = computed(() => ({ left: `${actionLeft.value}px` }));
const barStyle = computed(() => ({ width: `${barWidth.value}px` }));

watch(
  modelValue,
  (value) => {
    if (!value) {
      resume();
    }
  },
  { flush: "post" },
);

function getEventPageX(event: MouseEvent | TouchEvent) {
  if ("pageX" in event) {
    return event.pageX;
  }

  return event.touches[0]?.pageX ?? 0;
}

function getOffset() {
  const wrapperWidth = wrapperRef.value?.offsetWidth ?? 220;
  const actionWidth = actionRef.value?.offsetWidth ?? 44;
  const offset = wrapperWidth - actionWidth - 6;

  return { actionWidth, offset, wrapperWidth };
}

function handleDragStart(event: MouseEvent | TouchEvent) {
  if (modelValue.value) {
    return;
  }

  moveDistance.value = getEventPageX(event) - actionLeft.value;
  startTime.value = Date.now();
  isMoving.value = true;
}

function handleDragMoving(event: MouseEvent | TouchEvent) {
  if (!isMoving.value || modelValue.value) {
    return;
  }

  const { actionWidth, offset, wrapperWidth } = getOffset();
  const moveX = getEventPageX(event) - moveDistance.value;

  if (moveX > 0 && moveX <= offset) {
    actionLeft.value = moveX;
    barWidth.value = moveX + actionWidth / 2;
    return;
  }

  if (moveX > offset) {
    actionLeft.value = wrapperWidth - actionWidth;
    barWidth.value = wrapperWidth - actionWidth / 2;
    pass();
  }
}

function handleDragOver(event: MouseEvent | TouchEvent) {
  if (!isMoving.value || modelValue.value) {
    return;
  }

  const { actionWidth, offset, wrapperWidth } = getOffset();
  const moveX = getEventPageX(event) - moveDistance.value;

  if (moveX < offset) {
    resume();
    return;
  }

  actionLeft.value = wrapperWidth - actionWidth;
  barWidth.value = wrapperWidth - actionWidth / 2;
  pass();
}

function pass() {
  if (modelValue.value) {
    return;
  }

  endTime.value = Date.now();
  isMoving.value = false;
  modelValue.value = true;
  emit("success", {
    time: ((endTime.value - startTime.value) / 1000).toFixed(1),
  });
}

function resume() {
  isMoving.value = false;
  moveDistance.value = 0;
  startTime.value = 0;
  endTime.value = 0;

  if (actionLeft.value === 0 && barWidth.value === 0) {
    return;
  }

  isReturning.value = true;
  actionLeft.value = 0;
  barWidth.value = 0;

  window.setTimeout(() => {
    isReturning.value = false;
  }, 300);
}
</script>

<template>
  <div
    ref="wrapperRef"
    class="auth-slider-captcha"
    :class="{ 'is-passing': modelValue }"
    @mouseleave="handleDragOver"
    @mousemove="handleDragMoving"
    @mouseup="handleDragOver"
    @touchend="handleDragOver"
    @touchmove.prevent="handleDragMoving"
  >
    <div
      class="auth-slider-captcha__bar"
      :class="{ 'is-returning': isReturning }"
      :style="barStyle"
    />

    <div class="auth-slider-captcha__content">
      {{ modelValue ? props.successText : props.text }}
    </div>

    <div
      ref="actionRef"
      class="auth-slider-captcha__action"
      :class="{ 'is-dragging': isDragging, 'is-returning': isReturning }"
      :style="actionStyle"
      name="captcha-action"
      @mousedown.prevent="handleDragStart"
      @touchstart.prevent="handleDragStart"
    >
      <ElIcon>
        <Check v-if="modelValue" />
        <DArrowRight v-else />
      </ElIcon>
    </div>
  </div>
</template>

<style scoped>
.auth-slider-captcha {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  overflow: hidden;
  color: var(--auth-muted);
  font-family: var(--font-family);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
  user-select: none;
  background: var(--auth-captcha-bg);
  border: 1px solid var(--auth-border);
  border-radius: 6px;
  touch-action: none;
}

.auth-slider-captcha__bar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  height: 100%;
  background: hsl(var(--success));
}

.auth-slider-captcha__bar.is-returning {
  transition: width 0.3s ease;
}

.auth-slider-captcha__content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--auth-muted);
  font-size: 12px;
  pointer-events: none;
}

.auth-slider-captcha__action {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 100%;
  color: var(--auth-muted);
  cursor: move;
  background: var(--auth-toolbar-bg);
  box-shadow:
    0 4px 6px -1px hsl(0 0% 0% / 10%),
    0 2px 4px -2px hsl(0 0% 0% / 10%);
}

.auth-slider-captcha__action.is-dragging {
  border-radius: 6px;
}

.auth-slider-captcha__action.is-returning {
  transition: left 0.3s ease;
}

.auth-slider-captcha.is-passing {
  color: hsl(0 0% 98%);
}

.auth-slider-captcha.is-passing .auth-slider-captcha__content {
  color: hsl(0 0% 98%);
}

.auth-slider-captcha.is-passing .auth-slider-captcha__action {
  color: hsl(var(--success));
}
</style>
