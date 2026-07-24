<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { emitter } from "@/utils/mitt";
import { getMine } from "@/api/user";

defineOptions({
  name: "AccountManagement"
});

const mobile = ref("");

const maskedMobile = computed(() => {
  if (!/^1\d{10}$/.test(mobile.value)) return "当前登录账号";
  return `${mobile.value.slice(0, 3)}****${mobile.value.slice(-4)}`;
});

const list = computed(() => [
  {
    title: "账户密码",
    illustrate: "定期更新密码可以提升账户安全性",
    button: "修改",
    available: true
  },
  {
    title: "登录手机",
    illustrate: `当前账号：${maskedMobile.value}`,
    button: "暂不可改",
    available: false
  },
  {
    title: "密保问题",
    illustrate: "服务器尚未提供密保问题设置能力",
    button: "暂不可用",
    available: false
  },
  {
    title: "备用邮箱",
    illustrate: "服务器尚未提供备用邮箱设置能力",
    button: "暂不可用",
    available: false
  }
]);

function onClick(item) {
  if (item.available) emitter.emit("openChangePassword");
}

onMounted(async () => {
  try {
    mobile.value = (await getMine()).data.phone;
  } catch {
    mobile.value = "";
  }
});
</script>

<template>
  <div class="min-w-[180px] w-full max-w-full min-[769px]:max-w-[70%]">
    <h3 class="my-8">账户管理</h3>
    <div v-for="(item, index) in list" :key="index">
      <div class="flex items-center">
        <div class="flex-1">
          <p>{{ item.title }}</p>
          <el-text class="mx-1" type="info">{{ item.illustrate }}</el-text>
        </div>
        <el-button
          type="primary"
          text
          :disabled="!item.available"
          @click="onClick(item)"
        >
          {{ item.button }}
        </el-button>
      </div>
      <el-divider />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.el-divider--horizontal {
  border-top: 0.1px var(--el-border-color) var(--el-border-style);
}
</style>
