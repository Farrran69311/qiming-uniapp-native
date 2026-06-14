<script setup lang="ts">
import { useNav } from "@/layout/hooks/useNav";

const { title, getLogo } = useNav();
</script>

<template>
  <div class="sidebar-logo-container">
    <router-link key="expand" :title="title" class="sidebar-logo-link" to="/">
      <img :src="getLogo()" alt="logo" class="app-logo-img" />
      <span class="sidebar-title">{{ title }}</span>
    </router-link>
  </div>
</template>

<style lang="scss" scoped>
.sidebar-logo-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 80px;
  padding: 0;
  overflow: hidden;

  .sidebar-logo-link {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0 16px;

    img {
      display: inline-block;
      height: 40px;
    }

    .sidebar-title {
      display: inline-block;
      height: 40px;
      margin: 2px 0 0 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family:
        "Arial Black", "Arial Narrow", "Inter Tight", "Inter",
        "Microsoft YaHei", sans-serif;
      font-size: 24px;
      font-style: italic;
      font-weight: 900;
      line-height: 40px;
      color: var(--el-color-primary);
      letter-spacing: -0.06em;
      white-space: nowrap;
      background: linear-gradient(
        135deg,
        var(--el-color-primary) 0%,
        color-mix(in srgb, var(--el-color-primary), #4facfe 100%) 100%
      );
      background-clip: text;
      transform: skewX(-8deg);
      transition: all 0.3s;
      -webkit-text-fill-color: transparent;
    }
  }
}
</style>
