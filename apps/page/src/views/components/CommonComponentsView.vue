<script setup lang="ts">
import type { Component } from "vue";

import { computed } from "vue";
import { useRoute } from "vue-router";

import FormExamplesView from "@/views/components/examples/form/FormExamplesView.vue";
import TableExamplesView from "@/views/components/examples/table/TableExamplesView.vue";
import TreeExamplesView from "@/views/components/examples/tree/TreeExamplesView.vue";

const route = useRoute();

const examples: Record<string, Component> = {
  CommonComponentsForm: FormExamplesView,
  CommonComponentsTable: TableExamplesView,
  CommonComponentsTree: TreeExamplesView,
};

const currentExamples = computed(() => examples[String(route.name)] ?? TableExamplesView);
</script>

<template>
  <main class="common-components-page">
    <component :is="currentExamples" />
  </main>
</template>

<style scoped>
.common-components-page {
  min-height: calc(100vh - 88px);
  padding: 16px;
}
</style>
