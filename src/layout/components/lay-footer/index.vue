<script setup lang="ts">
import { getConfig } from "@/config";

const TITLE = getConfig("Title");
</script>

<template>
  <footer
    class="layout-footer text-[rgba(0,0,0,0.6)] dark:text-[rgba(220,220,242,0.8)]"
  >
    <div class="footer-container">
      <div class="line1">
        <span>长春工业大学</span>
        <span>吉林省长春市宽城区北远达大街 3000 号</span>
        <span>计算机学院 启明智教项目</span>
        <span class="domain">IntellEdu.com</span>
      </div>
      <div class="line2">
        Copyright (c) 2026 Est. 吉林省云创迅捷软件开发有限公司 All Rights
        Reserved
      </div>
    </div>
  </footer>
</template>

<style lang="scss" scoped>
.layout-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 16px 0;
  font-size: 13px;
  line-height: 1.8;
  text-align: center;

  .footer-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: min(100%, 960px);
    padding: 0 20px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  .domain {
    margin-left: 10px;
    font-weight: 500;
  }

  .line1 {
    opacity: 0.9;
    word-break: break-word;
  }

  .line2 {
    margin-top: 4px;
    font-size: 12px;
    opacity: 0.7;
  }
}

@media screen and (max-width: 768px) {
  .layout-footer {
    padding: 10px 0 6px;
    font-size: 12px;
    line-height: 1.65;

    .footer-container {
      width: 100%;
      max-width: 100%;
      padding-left: max(16px, calc(env(safe-area-inset-left, 0px) + 12px));
      padding-right: max(16px, calc(env(safe-area-inset-right, 0px) + 12px));
    }

    .line1 {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2px 8px;
      text-wrap: balance;
    }

    .line2 {
      margin-top: 6px;
      font-size: 11px;
      line-height: 1.55;
    }

    .domain {
      margin-left: 0;
    }
  }
}

@media screen and (max-width: 520px) {
  .layout-footer {
    padding: 8px 0 4px;
    font-size: 11px;

    .footer-container {
      align-items: stretch;
      padding-left: max(12px, calc(env(safe-area-inset-left, 0px) + 12px));
      padding-right: max(12px, calc(env(safe-area-inset-right, 0px) + 12px));
    }

    .line1,
    .line2 {
      text-align: left;
    }

    .line1 {
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1.6;
    }

    .line1 span {
      display: block;
    }

    .domain {
      margin-left: 0;
    }

    .line2 {
      margin-top: 4px;
      font-size: 10px;
      opacity: 0.6;
    }
  }
}
</style>
