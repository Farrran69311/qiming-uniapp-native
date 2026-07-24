<script setup lang="ts">
defineOptions({
  name: "Preferences"
});
</script>

<template>
  <div class="min-w-[180px] w-full max-w-full min-[769px]:max-w-[70%]">
    <h3 class="my-8">偏好设置</h3>
    <el-alert
      title="通知偏好服务尚未接入"
      description="服务器当前未提供通知偏好保存能力。系统主题和界面显示仍可在右侧系统配置中调整。"
      type="info"
      :closable="false"
      show-icon
    />
  </div>
</template>
