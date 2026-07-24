<script setup lang="ts">
defineOptions({
  name: "SecurityLog"
});
</script>

<template>
  <div class="min-w-[180px] w-full max-w-full min-[769px]:max-w-[70%]">
    <h3 class="my-8">安全日志</h3>
    <el-alert
      title="安全日志服务尚未接入"
      description="服务器当前未提供个人安全日志查询能力，因此这里不展示模拟登录记录。"
      type="info"
      :closable="false"
      show-icon
    />
  </div>
</template>
