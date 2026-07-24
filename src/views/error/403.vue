<script setup lang="ts">
import { useRouter } from "vue-router";
import noAccess from "@/assets/status/403.svg?component";

defineOptions({
  name: "403"
});

const router = useRouter();
</script>

<template>
  <div class="error-page flex justify-center items-center h-[640px]">
    <noAccess class="error-page__art" />
    <div class="error-page__copy ml-12">
      <p
        v-motion
        class="font-medium text-4xl mb-4 dark:text-white"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 80
          }
        }"
      >
        403
      </p>
      <p
        v-motion
        class="mb-4 text-gray-500"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 120
          }
        }"
      >
        抱歉，你无权访问该页面
      </p>
      <el-button
        v-motion
        type="primary"
        :initial="{
          opacity: 0,
          y: 100
        }"
        :enter="{
          opacity: 1,
          y: 0,
          transition: {
            delay: 160
          }
        }"
        @click="router.push('/')"
      >
        返回首页
      </el-button>
    </div>
  </div>
</template>

<style scoped>
@media (width <= 520px) {
  .error-page {
    flex-direction: column;
    gap: 20px;
    width: 100%;
    min-height: calc(100dvh - 96px);
    height: auto;
    padding: 16px;
    text-align: center;
  }

  .error-page__art {
    width: min(68vw, 240px);
    max-height: 42dvh;
  }

  .error-page__copy {
    margin-left: 0;
  }
}
</style>
