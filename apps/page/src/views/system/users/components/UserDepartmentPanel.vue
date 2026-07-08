<script setup lang="ts">
import AdminTreePanel from "@/components/common/tree/AdminTreePanel.vue";

interface DepartmentNode {
  children?: DepartmentNode[];
  key: string;
  label: string;
}

const selectedKey = defineModel<string>("selectedKey", { required: true });

const departmentTree: DepartmentNode[] = [
  {
    children: [
      { key: "jewelry-computers-1", label: "Computers" },
      { key: "jewelry-computers-2", label: "Computers" },
      { key: "jewelry-baby", label: "Baby" },
      { key: "jewelry-music", label: "Music" },
      { key: "jewelry-leaf", label: "Jewelry" },
    ],
    key: "jewelry",
    label: "Jewelry",
  },
  {
    children: [
      { key: "electronics-outdoors-1", label: "Outdoors" },
      { key: "electronics-outdoors-2", label: "Outdoors" },
      { key: "electronics-beauty", label: "Beauty" },
      { key: "electronics-toys", label: "Toys" },
    ],
    key: "electronics",
    label: "Electronics",
  },
  {
    children: [
      { key: "tools-industrial", label: "Industrial" },
      { key: "tools-clothing", label: "Clothing" },
      { key: "tools-sports", label: "Sports" },
    ],
    key: "tools",
    label: "Tools",
  },
  {
    children: [
      { key: "electronics-health", label: "Health" },
      { key: "electronics-automotive", label: "Automotive" },
      { key: "electronics-grocery", label: "Grocery" },
      { key: "electronics-sports", label: "Sports" },
    ],
    key: "electronics-2",
    label: "Electronics",
  },
  {
    children: [
      { key: "clothing-automotive", label: "Automotive" },
      { key: "clothing-beauty", label: "Beauty" },
      { key: "clothing-industrial", label: "Industrial" },
    ],
    key: "clothing",
    label: "Clothing",
  },
];
</script>

<template>
  <AdminTreePanel
    v-model:selected-key="selectedKey"
    aria-label="部门树"
    :nodes="departmentTree"
    search-placeholder="搜索部门..."
  />
</template>
