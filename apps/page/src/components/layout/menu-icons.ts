import type { Component } from "vue";
import {
  Connection,
  DataLine,
  Document,
  Files,
  Grid,
  HomeFilled,
  Menu as MenuIcon,
  Setting,
  UserFilled,
} from "@element-plus/icons-vue";

const menuIconMap: Record<string, Component> = {
  Connection,
  DataLine,
  Document,
  Files,
  Grid,
  HomeFilled,
  Setting,
  UserFilled,
};

export function resolveMenuIcon(icon?: string): Component {
  return icon ? (menuIconMap[icon] ?? MenuIcon) : MenuIcon;
}
