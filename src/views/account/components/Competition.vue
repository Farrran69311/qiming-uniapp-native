<template>
  <div class="competition-service" :class="currentTheme">
    <header class="competition-header">
      <div class="competition-header__title">
        <CompetitionIcon aria-hidden="true" />
        <div>
          <h2>赛事场</h2>
          <p>在线 OJ、题库训练、作文批改与知识竞赛</p>
        </div>
      </div>
      <el-button :icon="House" @click="returnToAccountHome">
        返回首页
      </el-button>
    </header>

    <section class="service-status" role="status" aria-live="polite">
      <el-icon class="service-status__icon"><WarningFilled /></el-icon>
      <div>
        <h3>赛事服务暂不可用</h3>
        <p>
          当前服务器尚未提供赛事、OJ、题库训练与作文批改能力。本页已停止展示模拟排名、题目和批改结果。
        </p>
      </div>
    </section>

    <section class="feature-list" aria-label="赛事功能">
      <article
        v-for="feature in features"
        :key="feature.name"
        class="feature-item"
      >
        <img :src="feature.icon" :alt="`${feature.name}图标`" />
        <div class="feature-item__copy">
          <h3>{{ feature.name }}</h3>
          <p>{{ feature.description }}</p>
        </div>
        <el-tag type="info" effect="plain">服务待接入</el-tag>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { House, WarningFilled } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import CompetitionIcon from "@/new student interface icons/trophy-prize-medal-3-svgrepo-com.svg?component";
import onlineOjJudgementIcon from "@/assets/comoprtitionarena/onlineojjudgement.svg?url";
import trainSetsIcon from "@/assets/comoprtitionarena/trainsets.svg?url";
import writingCorrectIcon from "@/assets/comoprtitionarena/writingcorrect.svg?url";
import encryptedKnowledgeIcon from "@/assets/comoprtitionarena/encryptedknowledge.svg?url";

defineProps<{
  currentTheme?: string;
}>();

const route = useRoute();
const router = useRouter();

const features = [
  {
    name: "在线 OJ",
    description: "算法编程在线评测",
    icon: onlineOjJudgementIcon
  },
  {
    name: "题库训练集",
    description: "按知识分类完成题目训练",
    icon: trainSetsIcon
  },
  {
    name: "作文批改检测",
    description: "中文与英文作文批改",
    icon: writingCorrectIcon
  },
  {
    name: "知识竞赛",
    description: "参与专题知识竞赛",
    icon: encryptedKnowledgeIcon
  }
];

const returnToAccountHome = () => {
  router.replace({
    path: "/account",
    query: { ...route.query, menu: "home" }
  });
};
</script>

<style lang="scss" scoped>
.competition-service {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  color: #1f2937;
}

.competition-header {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.competition-header__title {
  display: flex;
  gap: 14px;
  align-items: center;
  min-width: 0;

  > svg {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    color: #b45309;
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: 24px;
    line-height: 1.35;
  }

  p {
    margin-top: 4px;
    font-size: 14px;
    line-height: 1.6;
    color: #6b7280;
  }
}

.service-status {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 20px;
  margin-top: 18px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 17px;
    line-height: 1.5;
  }

  p {
    max-width: 68ch;
    margin-top: 5px;
    font-size: 14px;
    line-height: 1.7;
    color: #4b5563;
  }
}

.service-status__icon {
  flex: 0 0 auto;
  margin-top: 1px;
  font-size: 26px;
  color: #d97706;
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.feature-item {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-width: 0;
  padding: 18px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;

  img {
    width: 42px;
    height: 42px;
    object-fit: contain;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 16px;
    line-height: 1.45;
  }

  p {
    margin-top: 3px;
    font-size: 13px;
    line-height: 1.55;
    color: #6b7280;
  }
}

.feature-item__copy {
  min-width: 0;
}

.competition-service.dark {
  color: #f1f5f9;

  .competition-header,
  .feature-item {
    background: #172033;
    border-color: #334155;
  }

  .competition-header__title p,
  .feature-item p {
    color: #aebbd0;
  }

  .service-status {
    background: #292314;
    border-color: #713f12;

    p {
      color: #d6d3d1;
    }
  }
}

@media (width <= 768px) {
  .competition-header {
    align-items: stretch;
    flex-direction: column;
    padding: 18px;

    .el-button {
      width: 100%;
      min-height: 44px;
      margin-left: 0;
    }
  }

  .competition-header__title {
    align-items: flex-start;

    h2 {
      font-size: 21px;
    }
  }

  .service-status {
    padding: 14px;
  }

  .feature-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .feature-item {
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 10px;
    padding: 14px;

    .el-tag {
      grid-column: 2;
      justify-self: start;
    }
  }
}

@media (width <= 480px) {
  .competition-header__title {
    > svg {
      width: 30px;
      height: 30px;
    }

    p {
      font-size: 13px;
    }
  }

  .service-status {
    flex-direction: column;
  }
}
</style>
