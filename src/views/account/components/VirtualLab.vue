<template>
  <div class="virtual-lab" :class="currentTheme">
    <!-- 顶部介绍区域 -->
    <div class="lab-header">
      <div class="header-content">
        <div class="header-left">
          <h2>
            <LabIcon
              style="
                width: 28px;
                height: 28px;
                margin-right: 8px;
                vertical-align: middle;
              "
            />
            虚拟实验室
          </h2>
          <p>探索 HTML 动画与 AI 生成的互动小游戏，让学习更有趣！</p>
        </div>
        <div class="header-stats">
          <div class="stat-item">
            <span class="stat-value">{{ stats.animations }}</span>
            <span class="stat-label">动画数量</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.games }}</span>
            <span class="stat-label">小游戏</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.completed }}</span>
            <span class="stat-label">已完成</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 分类标签 -->
    <div class="category-tabs">
      <el-radio-group v-model="activeCategory" size="large">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="animation">HTML 动画</el-radio-button>
        <el-radio-button value="game">AI 小游戏</el-radio-button>
        <el-radio-button value="simulation">模拟实验</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 项目列表 -->
    <div class="lab-grid">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="lab-card"
        :class="{ 'is-featured': item.featured }"
        @click="openLab(item)"
      >
        <div class="card-preview" :style="{ background: item.gradient }">
          <div class="preview-icon">{{ item.icon }}</div>
          <el-tag v-if="item.featured" type="warning" class="featured-tag">
            精选
          </el-tag>
          <el-tag
            :type="getCategoryTagType(item.category)"
            class="category-tag"
          >
            {{ getCategoryLabel(item.category) }}
          </el-tag>
        </div>
        <div class="card-content">
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
          <div class="card-meta">
            <span class="difficulty" :class="item.difficulty">
              <el-icon><Star /></el-icon>
              {{ getDifficultyLabel(item.difficulty) }}
            </span>
            <span class="duration">
              <el-icon><Clock /></el-icon>
              {{ item.duration }}
            </span>
          </div>
        </div>
        <div class="card-actions">
          <el-button type="primary" size="small" round>
            开始体验
            <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="filteredItems.length === 0"
      description="暂无相关实验内容"
    />

    <!-- 实验室弹窗 -->
    <el-dialog
      v-model="labDialogVisible"
      :title="currentLab?.title"
      width="90%"
      class="student-lab-dialog lab-dialog"
      :before-close="handleDialogClose"
    >
      <div class="lab-iframe-container">
        <iframe
          v-if="currentLab"
          :src="currentLab.url"
          frameborder="0"
          allowfullscreen
          class="lab-iframe"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { TagProps } from "element-plus";
import { Star, Clock, ArrowRight } from "@element-plus/icons-vue";
import LabIcon from "@/new student interface icons/lab-medical-test-svgrepo-com.svg?component";

defineProps<{
  currentTheme?: string;
}>();

interface LabItem {
  id: number;
  title: string;
  description: string;
  icon: string;
  category: "animation" | "game" | "simulation";
  difficulty: "easy" | "medium" | "hard";
  duration: string;
  gradient: string;
  featured?: boolean;
  url: string;
}

const activeCategory = ref("all");
const labDialogVisible = ref(false);
const currentLab = ref<LabItem | null>(null);

const stats = ref({
  animations: 12,
  games: 8,
  completed: 5
});

const labItems = ref<LabItem[]>([
  {
    id: 1,
    title: "CSS 粒子动画",
    description: "学习使用纯 CSS 创建炫酷的粒子效果动画",
    icon: "✨",
    category: "animation",
    difficulty: "medium",
    duration: "15分钟",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    featured: true,
    url: "/demos/particle-animation.html"
  },
  {
    id: 2,
    title: "贪吃蛇大作战",
    description: "AI 生成的经典贪吃蛇游戏，支持多种难度模式",
    icon: "🐍",
    category: "game",
    difficulty: "easy",
    duration: "不限",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    featured: true,
    url: "/demos/snake-game.html"
  },
  {
    id: 3,
    title: "3D 旋转立方体",
    description: "CSS 3D 变换实现的旋转立方体效果",
    icon: "🎲",
    category: "animation",
    difficulty: "hard",
    duration: "20分钟",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    url: "/demos/3d-cube.html"
  },
  {
    id: 4,
    title: "物理弹球模拟",
    description: "模拟真实物理效果的弹球运动实验",
    icon: "⚽",
    category: "simulation",
    difficulty: "medium",
    duration: "10分钟",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    url: "/demos/physics-ball.html"
  },
  {
    id: 5,
    title: "记忆翻牌游戏",
    description: "AI 生成的记忆力训练小游戏",
    icon: "🃏",
    category: "game",
    difficulty: "easy",
    duration: "5分钟",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    url: "/demos/memory-game.html"
  },
  {
    id: 6,
    title: "波浪动画效果",
    description: "使用 SVG 和 CSS 创建流动的波浪效果",
    icon: "🌊",
    category: "animation",
    difficulty: "easy",
    duration: "10分钟",
    gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    url: "/demos/wave-animation.html"
  },
  {
    id: 7,
    title: "化学分子结构",
    description: "3D 可视化展示常见化学分子结构",
    icon: "⚗️",
    category: "simulation",
    difficulty: "hard",
    duration: "25分钟",
    gradient: "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)",
    featured: true,
    url: "/demos/molecule-3d.html"
  },
  {
    id: 8,
    title: "打字练习游戏",
    description: "AI 生成的打字速度训练游戏",
    icon: "⌨️",
    category: "game",
    difficulty: "medium",
    duration: "不限",
    gradient: "linear-gradient(135deg, #c3cfe2 0%, #c3cfe2 100%)",
    url: "/demos/typing-game.html"
  }
]);

const filteredItems = computed(() => {
  if (activeCategory.value === "all") {
    return labItems.value;
  }
  return labItems.value.filter(item => item.category === activeCategory.value);
});

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    animation: "动画",
    game: "游戏",
    simulation: "模拟"
  };
  return labels[category] || category;
};

const getCategoryTagType = (category: string) => {
  const types: Record<string, string> = {
    animation: "primary",
    game: "success",
    simulation: "info"
  };
  return (types[category] || "info") as TagProps["type"];
};

const getDifficultyLabel = (difficulty: string) => {
  const labels: Record<string, string> = {
    easy: "简单",
    medium: "中等",
    hard: "困难"
  };
  return labels[difficulty] || difficulty;
};

const openLab = (item: LabItem) => {
  currentLab.value = item;
  labDialogVisible.value = true;
};

const handleDialogClose = () => {
  labDialogVisible.value = false;
  currentLab.value = null;
};
</script>

<style lang="scss" scoped>
.virtual-lab {
  .lab-header {
    padding: 24px;
    margin-bottom: 24px;
    background: linear-gradient(135deg, #97b4f7 0%, #7c9cf5 60%, #a8c0ff 100%);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgb(151 180 247 / 25%);

    .dark & {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      box-shadow: 0 8px 32px rgb(0 0 0 / 40%);
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      h2 {
        margin: 0 0 8px;
        overflow: visible;
        font-size: 24px;
        font-weight: 700;
        line-height: 1.25;
        color: #1a2a4a;
        white-space: normal;
        word-break: keep-all;
      }

      p {
        margin: 0;
        font-size: 14px;
        color: #2a3f5f;
      }
    }

    .header-stats {
      display: flex;
      gap: 32px;

      .stat-item {
        text-align: center;

        .stat-value {
          display: block;
          font-size: 28px;
          font-weight: 700;
          color: #1a2a4a;
        }

        .stat-label {
          font-size: 12px;
          color: #2a3f5f;
        }
      }
    }
  }

  .category-tabs {
    margin-bottom: 24px;

    :deep(.el-radio-group) {
      display: flex;
      gap: 10px;

      .el-radio-button {
        .el-radio-button__inner {
          padding: 10px 22px;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          background: linear-gradient(135deg, #f8faff, #f0f4ff);
          border: 1px solid rgb(151 180 247 / 18%) !important;
          border-radius: 20px !important;
          box-shadow: none;
          transition: all 0.3s ease;

          .dark & {
            color: #94a3b8;
            background: #1e293b;
            border-color: #334155 !important;
          }

          &:hover {
            color: #7c9cf5;
            background: linear-gradient(135deg, #eef2ff, #dce2f7);
            border-color: rgb(151 180 247 / 35%) !important;

            .dark & {
              color: #97b4f7;
              background: rgb(56 189 248 / 8%);
            }
          }
        }
      }

      .el-radio-button__orig-radio:checked + .el-radio-button__inner {
        color: #fff !important;
        background: linear-gradient(135deg, #97b4f7, #7c9cf5) !important;
        border-color: transparent !important;
        box-shadow: 0 4px 14px rgb(151 180 247 / 40%) !important;

        .dark & {
          background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
          box-shadow: 0 4px 14px rgb(59 130 246 / 35%) !important;
        }
      }
    }
  }

  .lab-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
  }

  .lab-card {
    overflow: hidden;
    cursor: pointer;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgb(0 0 0 / 8%);
    transition: all 0.3s ease;

    .dark & {
      background: #1e293b;
      box-shadow: 0 4px 20px rgb(0 0 0 / 30%);
    }

    &:hover {
      box-shadow: 0 12px 40px rgb(0 0 0 / 15%);
      transform: translateY(-8px);

      .dark & {
        box-shadow: 0 12px 40px rgb(0 0 0 / 50%);
      }

      .card-preview .preview-icon {
        transform: scale(1.2);
      }
    }

    &.is-featured {
      border: 2px solid #f59e0b;
    }

    .card-preview {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 140px;

      .dark & {
        opacity: 0.9;
      }

      .preview-icon {
        font-size: 48px;
        transition: transform 0.3s ease;
      }

      .featured-tag {
        position: absolute;
        top: 12px;
        left: 12px;
      }

      .category-tag {
        position: absolute;
        top: 12px;
        right: 12px;
      }
    }

    .card-content {
      padding: 16px;

      h3 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 600;
        color: #333;

        .dark & {
          color: #f1f5f9;
        }
      }

      p {
        height: 40px;
        margin: 0 0 12px;
        font-size: 13px;
        line-height: 1.5;
        color: #666;

        .dark & {
          color: #94a3b8;
        }
      }

      .card-meta {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: #999;

        .dark & {
          color: #64748b;
        }

        span {
          display: flex;
          gap: 4px;
          align-items: center;

          &.difficulty {
            &.easy {
              color: #10b981;
            }

            &.medium {
              color: #f59e0b;
            }

            &.hard {
              color: #ef4444;
            }
          }
        }
      }
    }

    .card-actions {
      padding: 0 16px 16px;
    }
  }
}

.lab-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }

  .lab-iframe-container {
    height: 70vh;

    .lab-iframe {
      width: 100%;
      height: 100%;
    }
  }
}

@media (max-width: 767px) {
  .virtual-lab {
    .lab-header {
      padding: 18px;
      margin-bottom: 18px;
      border-radius: 20px;

      .header-content {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .header-left {
        h2 {
          margin-bottom: 8px;
          font-size: clamp(20px, 5.6vw, 24px);
          line-height: 1.28;
        }

        p {
          font-size: 13px;
          line-height: 1.55;
        }
      }

      .header-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;

        .stat-item {
          min-width: 0;
          padding: 10px 6px;
          background: rgb(255 255 255 / 32%);
          border: 1px solid rgb(255 255 255 / 28%);
          border-radius: 14px;

          .stat-value {
            font-size: 22px;
            line-height: 1.1;
          }

          .stat-label {
            display: block;
            margin-top: 4px;
            font-size: 11px;
            line-height: 1.2;
          }
        }
      }
    }

    .category-tabs {
      margin-bottom: 18px;
      overflow: hidden;

      :deep(.el-radio-group) {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 2px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;

        &::-webkit-scrollbar {
          display: none;
        }

        .el-radio-button {
          flex: 0 0 auto;

          .el-radio-button__inner {
            padding: 9px 18px;
            font-size: 13px;
            border-radius: 18px !important;
          }
        }
      }
    }

    .lab-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .lab-card {
      border-radius: 18px;

      &:hover {
        transform: none;
      }

      .card-preview {
        height: 118px;

        .preview-icon {
          font-size: 38px;
        }
      }

      .card-content {
        padding: 14px;

        p {
          height: auto;
          min-height: 0;
        }
      }

      .card-actions {
        padding: 0 14px 14px;
      }
    }
  }

  .lab-dialog {
    :deep(.el-dialog) {
      display: flex;
      flex-direction: column;
      width: calc(100vw - 24px) !important;
      max-height: calc(100vh - 24px);
      max-height: calc(100dvh - 24px);
      margin: 12px auto !important;
      border-radius: 20px;
    }

    :deep(.el-dialog__body) {
      flex: 1 1 auto;
      min-height: 0;
      padding: 0 !important;
    }

    .lab-iframe-container {
      height: min(calc(100vh - 132px), 560px);
      height: min(calc(100dvh - 132px), 560px);
    }
  }
}
</style>

<style lang="scss">
@media (max-width: 768px) {
  .student-lab-dialog {
    width: calc(100vw - 24px) !important;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
    margin: 12px auto !important;
    overflow: hidden;
    border-radius: 20px;

    .el-dialog__header {
      padding: 16px 18px 12px;
    }

    .el-dialog__body {
      flex: 1 1 auto;
      min-height: 0;
      padding: 0 !important;
    }

    .lab-iframe-container {
      height: min(calc(100vh - 132px), 560px);
      height: min(calc(100dvh - 132px), 560px);
    }
  }
}
</style>
