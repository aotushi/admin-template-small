<script setup lang="ts">
import type { Component } from "vue";

import { computed } from "vue";
import { useRoute } from "vue-router";

import FormExamplesView from "@/views/showcase/examples/form/FormExamplesView.vue";
import BasicTableExample from "@/views/showcase/examples/table/BasicTableExample.vue";
import SearchTableExample from "@/views/showcase/examples/table/SearchTableExample.vue";
import TreeExamplesView from "@/views/showcase/examples/tree/TreeExamplesView.vue";

const route = useRoute();

const examples: Record<string, Component> = {
  CommonComponentsForm: FormExamplesView,
  CommonComponentsTableBasic: BasicTableExample,
  CommonComponentsTableSearch: SearchTableExample,
  CommonComponentsTree: TreeExamplesView,
};

const currentExamples = computed(() => examples[String(route.name)] ?? BasicTableExample);
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
