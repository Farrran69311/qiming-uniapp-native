<template>
  <div
    class="smd"
    :class="{ 'smd--compact': compact }"
    :style="styleVars"
    :aria-label="`${demo.module}演示`"
  >
    <div class="smd__chrome">
      <div class="smd__appbar">
        <span class="smd__appmark" aria-hidden="true" />
        <div>
          <strong>{{ demo.module }}</strong>
          <span>智能工作流</span>
        </div>
      </div>
      <span class="smd__live"><i />实时协同</span>
    </div>

    <div class="smd__workspace">
      <aside class="smd__side">
        <div class="smd__brand">
          <strong>Q</strong>
          <span>启明智教</span>
        </div>
        <p>工作区</p>
        <button
          v-for="(item, i) in navItems"
          :key="item"
          type="button"
          :class="{ 'is-active': i === 0 }"
        >
          <i aria-hidden="true" />
          <span>{{ item }}</span>
        </button>
      </aside>

      <main class="smd__main">
        <div class="smd__top">
          <div class="smd__crumbs">
            <span>启明智教</span>
            <span>/</span>
            <strong>{{ demo.module }}</strong>
          </div>
          <span class="smd__mesh"><i />教学服务已连接</span>
        </div>

        <section class="smd__head">
          <div>
            <p>智能工作流演示</p>
            <h4>{{ demo.title || demo.module }}</h4>
          </div>
          <div class="smd__metrics">
            <article
              v-for="(metric, i) in demo.metrics"
              :key="metric.label"
              :style="{ animationDelay: `${i * 0.08}s` }"
            >
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
              <em>{{ metric.trend }}</em>
            </article>
          </div>
        </section>

        <section class="smd__viz">
          <div class="smd__bars" aria-hidden="true">
            <article
              v-for="bar in bars"
              :key="bar.label"
              :style="{ '--bar-h': `${bar.height}%`, '--bar-c': bar.color }"
            >
              <span>{{ bar.value }}</span>
              <i />
              <small>{{ bar.label }}</small>
            </article>
          </div>

          <svg class="smd__radar" viewBox="0 0 100 100" aria-hidden="true">
            <polygon points="50,7 91,35 75,84 25,84 9,35" />
            <polygon points="50,20 78,40 67,72 33,72 22,40" />
            <path d="M50 7V50M91 35 50 50M75 84 50 50M25 84 50 50M9 35 50 50" />
            <polygon class="smd__radarFill" :points="radarPoints" />
            <polyline
              class="smd__radarLine"
              :points="`${radarPoints} ${radarPoints.split(' ')[0]}`"
            />
          </svg>
        </section>

        <section class="smd__pipeline">
          <svg
            class="smd__flow"
            viewBox="0 0 640 80"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                :id="riverGradientId"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop
                  offset="0%"
                  :stop-color="demo.accent"
                  stop-opacity="0.1"
                />
                <stop offset="45%" :stop-color="demo.accent" />
                <stop offset="100%" stop-color="#10b981" />
              </linearGradient>
            </defs>
            <path
              d="M24 44 C 138 10, 194 70, 304 38 S 486 10, 616 44"
              class="smd__flowBase"
            />
            <path
              d="M24 44 C 138 10, 194 70, 304 38 S 486 10, 616 44"
              class="smd__flowLine"
              :stroke="`url(#${riverGradientId})`"
            />
            <circle r="5" class="smd__packet">
              <animateMotion
                dur="4.8s"
                repeatCount="indefinite"
                path="M24 44 C 138 10, 194 70, 304 38 S 486 10, 616 44"
              />
            </circle>
          </svg>

          <div class="smd__nodes">
            <article
              v-for="(step, i) in demo.steps"
              :key="step.label"
              :style="{ animationDelay: `${i * 0.1}s` }"
            >
              <span>{{ String(i + 1).padStart(2, "0") }}</span>
              <strong>{{ step.label }}</strong>
              <small>{{ step.detail }}</small>
            </article>
          </div>
        </section>

        <section class="smd__stack">
          <article
            v-for="item in demo.stack"
            :key="item.key"
            :title="`${item.label} · ${item.desc}`"
          >
            <strong>{{ item.key }}</strong>
            <span>{{ item.label }}</span>
          </article>
        </section>

        <section class="smd__console">
          <div
            v-for="(line, i) in demo.console.slice(0, compact ? 2 : 4)"
            :key="line"
            :style="{ animationDelay: `${i * 0.14}s` }"
          >
            <span />
            <code>{{ line }}</code>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface DemoStep {
  label: string;
  detail: string;
}

interface DemoMetric {
  label: string;
  value: string;
  trend: string;
}

interface StackItem {
  key: string;
  label: string;
  desc: string;
}

interface ScriptedMiniScene {
  module: string;
  title: string;
  path: string;
  accent: string;
  steps: DemoStep[];
  metrics: DemoMetric[];
  stack: StackItem[];
  console: string[];
}

const props = withDefaults(
  defineProps<{
    scene?: Partial<ScriptedMiniScene>;
    compact?: boolean;
  }>(),
  { compact: false }
);

const fallbackScene: ScriptedMiniScene = {
  module: "智能工作流",
  title: "AI 备课流水线",
  path: "intelledu.com/workspace",
  accent: "#4a90e2",
  steps: [
    { label: "指令解析", detail: "章节目标" },
    { label: "学情接入", detail: "薄弱点" },
    { label: "课堂编排", detail: "互动节奏" },
    { label: "评价闭环", detail: "诊断任务" }
  ],
  metrics: [
    { label: "串联模块", value: "6", trend: "+2" },
    { label: "生成耗时", value: "8s", trend: "-43%" },
    { label: "命中率", value: "96%", trend: "+11%" }
  ],
  stack: [
    { key: "智", label: "教学智能体", desc: "理解任务意图" },
    { key: "编", label: "任务编排", desc: "串联教学流程" },
    { key: "学", label: "学情状态", desc: "沉淀学生表现" },
    { key: "评", label: "评价闭环", desc: "反馈下一步行动" }
  ],
  console: [
    "章节扫描完成",
    "学情合并完成：45 名学生",
    "课堂节奏生成：7 个环节",
    "评价任务已下发"
  ]
};

const barPalette = ["#10b981", "#4a90e2", "#8b5cf6"];
const barHeights = [84, 66, 76];
const riverGradientId = `smd-flow-${Math.random().toString(36).slice(2, 9)}`;

const demo = computed<ScriptedMiniScene>(() => {
  const scene = props.scene ?? {};
  return {
    ...fallbackScene,
    ...scene,
    steps: scene.steps?.length ? scene.steps : fallbackScene.steps,
    metrics: scene.metrics?.length ? scene.metrics : fallbackScene.metrics,
    stack: scene.stack?.length ? scene.stack : fallbackScene.stack,
    console: scene.console?.length ? scene.console : fallbackScene.console
  };
});

const styleVars = computed(() => ({
  "--smd-accent": demo.value.accent
}));

const navItems = computed(() => [
  demo.value.module,
  ...demo.value.steps.slice(0, 4).map(item => item.label)
]);

const bars = computed(() =>
  demo.value.metrics.map((metric, i) => ({
    ...metric,
    height: barHeights[i % barHeights.length],
    color: i === 0 ? demo.value.accent : barPalette[i % barPalette.length]
  }))
);

const radarPoints = computed(() => {
  const values = [0.88, 0.76, 0.62, 0.82, 0.7];
  return values
    .map((value, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / values.length;
      const radius = 42 * value;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});
</script>

<style lang="scss" scoped>
.smd {
  --smd-border: rgb(0 0 0 / 8%);
  --smd-muted: rgb(0 0 0 / 52%);
  --smd-soft: rgb(246 248 251);

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 420px;
  color: rgb(17 24 39);
  background: #fff;
  border: 1px solid var(--smd-border);
  border-radius: 14px;
  box-shadow: 0 26px 70px -34px rgb(15 23 42 / 30%);
  overflow: hidden;
}

.smd--compact {
  min-height: 336px;
}

.smd__chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 14px;
  background: linear-gradient(90deg, #fafafa, #f4f6f9);
  border-bottom: 1px solid var(--smd-border);
}

.smd__appbar {
  display: flex;
  align-items: center;
  min-width: 0;

  > div {
    min-width: 0;
  }

  strong,
  span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 12px;
    font-weight: 800;
    color: rgb(17 24 39);
  }

  span {
    font-size: 10px;
    color: var(--smd-muted);
  }
}

.smd__appmark {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  margin-right: 9px;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 64% 34%,
      rgb(255 255 255 / 62%) 0 3px,
      transparent 4px
    ),
    linear-gradient(
      135deg,
      var(--smd-accent),
      color-mix(in srgb, var(--smd-accent) 58%, #10b981)
    );
  border-radius: 9px;
  box-shadow:
    0 8px 18px -13px var(--smd-accent),
    inset 0 0 0 1px rgb(255 255 255 / 28%);
}

.smd__url {
  display: flex;
  flex: 1 1 auto;
  gap: 6px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 24px;
  padding: 0 12px;
  font-size: 11px;
  color: rgb(0 0 0 / 42%);
  background: #fff;
  border: 1px solid var(--smd-border);
  border-radius: 999px;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.smd__live,
.smd__mesh {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 700;
  color: #047857;
  background: rgb(16 185 129 / 10%);
  border: 1px solid rgb(16 185 129 / 28%);
  border-radius: 999px;

  i {
    width: 8px;
    height: 8px;
    background: #34d399;
    border-radius: 50%;
    animation: smd-pulse 1.8s ease-in-out infinite;
  }
}

.smd__workspace {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  flex: 1 1 auto;
  min-height: 0;
  background:
    radial-gradient(circle at 1px 1px, rgb(0 0 0 / 8%) 1px, transparent 0) 0 0 /
      22px 22px,
    #fff;
}

.smd__side {
  min-width: 0;
  padding: 18px 10px;
  background: rgb(248 248 247 / 88%);
  border-right: 1px solid var(--smd-border);

  p {
    margin: 18px 10px 10px;
    font-size: 12px;
    color: var(--smd-muted);
  }

  button {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    height: 34px;
    padding: 0 10px;
    margin-bottom: 4px;
    font: inherit;
    font-size: 13px;
    color: rgb(0 0 0 / 68%);
    cursor: default;
    background: transparent;
    border: 0;
    border-radius: 7px;

    &.is-active {
      color: rgb(17 24 39);
      background: rgb(0 0 0 / 6%);
    }

    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    i {
      position: relative;
      display: inline-block;
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      overflow: hidden;
      background:
        radial-gradient(
          circle at 64% 34%,
          rgb(255 255 255 / 60%) 0 2px,
          transparent 3px
        ),
        color-mix(in srgb, var(--smd-accent) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--smd-accent) 24%, transparent);
      border-radius: 5px;

      &::after {
        position: absolute;
        inset: 5px;
        content: "";
        background: color-mix(in srgb, var(--smd-accent) 72%, #111827);
        border-radius: 999px;
      }
    }
  }
}

.smd__brand {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 0 10px;

  strong {
    display: inline-grid;
    width: 22px;
    height: 22px;
    place-items: center;
    font-size: 13px;
    color: #fff;
    background: #2f3437;
    border-radius: 5px;
  }

  span {
    min-width: 0;
    overflow: hidden;
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.smd__main {
  display: grid;
  grid-template-rows: auto auto minmax(132px, 1fr) auto auto auto;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  padding: 20px 24px;
  overflow: hidden;
}

.smd__top,
.smd__head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
}

.smd__crumbs {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  color: rgb(0 0 0 / 42%);

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.smd__mesh {
  height: 26px;
  text-transform: uppercase;
}

.smd__head {
  align-items: center;

  p {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 700;
    color: color-mix(in srgb, var(--smd-accent) 82%, #111827);
  }

  h4 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    line-height: 1.18;
    color: rgb(17 24 39);
  }
}

.smd__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(72px, 1fr));
  gap: 0;
  min-width: 236px;
  overflow: hidden;
  background: rgb(255 255 255 / 82%);
  border: 1px solid var(--smd-border);
  border-radius: 12px;

  article {
    min-width: 0;
    padding: 10px 12px;
    opacity: 0;
    transform: translateY(8px);
    animation: smd-rise 0.45s ease-out forwards;

    + article {
      border-left: 1px solid var(--smd-border);
    }
  }

  span,
  em {
    display: block;
    overflow: hidden;
    font-size: 11px;
    color: var(--smd-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    display: block;
    margin: 4px 0 2px;
    overflow: hidden;
    font-size: 20px;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  em {
    font-style: normal;
    color: #10b981;
  }
}

.smd__viz {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(120px, 0.85fr);
  gap: 20px;
  min-height: 0;
  padding: 10px 4px 0;
}

.smd__bars {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  align-items: end;
  min-height: 142px;
}

.smd__bars article {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  height: 100%;
  min-width: 0;
  text-align: center;

  span,
  small {
    overflow: hidden;
    color: rgb(0 0 0 / 66%);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    font-size: 13px;
    font-weight: 700;
  }

  small {
    font-size: 11px;
  }

  i {
    align-self: end;
    width: 100%;
    height: var(--bar-h);
    min-height: 28px;
    background: linear-gradient(
      180deg,
      var(--bar-c),
      color-mix(in srgb, var(--bar-c) 56%, #fff)
    );
    border-radius: 6px 6px 0 0;
    box-shadow: 0 14px 30px -18px var(--bar-c);
    animation: smd-grow 0.7s ease-out both;
    transform-origin: bottom;
  }
}

.smd__radar {
  width: 100%;
  min-width: 0;
  max-height: 180px;
  align-self: center;

  polygon,
  path {
    fill: rgb(74 144 226 / 3%);
    stroke: rgb(0 0 0 / 10%);
    stroke-width: 1;
  }
}

.smd__radarFill {
  fill: color-mix(in srgb, var(--smd-accent) 22%, transparent) !important;
  stroke: none !important;
  animation: smd-fade 0.8s ease-out both;
}

.smd__radarLine {
  fill: none;
  stroke: var(--smd-accent);
  stroke-width: 2;
  filter: drop-shadow(
    0 5px 10px color-mix(in srgb, var(--smd-accent) 24%, transparent)
  );
  stroke-dasharray: 210;
  stroke-dashoffset: 210;
  animation: smd-draw 1.2s ease-out forwards;
}

.smd__pipeline {
  position: relative;
  min-height: 112px;
  padding: 10px 12px;
  overflow: hidden;
  background: rgb(255 255 255 / 78%);
  border: 1px solid var(--smd-border);
  border-radius: 12px;
}

.smd__flow {
  position: absolute;
  top: 0;
  left: 10px;
  width: calc(100% - 20px);
  height: 74px;
}

.smd__flowBase,
.smd__flowLine {
  fill: none;
  stroke-linecap: round;
}

.smd__flowBase {
  stroke: rgb(0 0 0 / 8%);
  stroke-width: 9;
}

.smd__flowLine {
  stroke-width: 3;
  stroke-dasharray: 18 16;
  animation: smd-flow 1.8s linear infinite;
}

.smd__packet {
  fill: #fff;
  stroke: var(--smd-accent);
  stroke-width: 2;
}

.smd__nodes {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  height: 100%;
  padding-top: 42px;
}

.smd__nodes article {
  min-width: 0;
  padding: 10px;
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--smd-accent) 24%, var(--smd-border));
  border-radius: 10px;
  opacity: 0;
  transform: translateY(10px);
  animation: smd-rise 0.5s ease-out forwards;

  span {
    display: inline-grid;
    width: 28px;
    height: 22px;
    margin-bottom: 7px;
    place-items: center;
    font-size: 10px;
    font-weight: 800;
    color: #fff;
    background: var(--smd-accent);
    border-radius: 7px;
  }

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 12px;
    color: rgb(17 24 39);
  }

  small {
    margin-top: 4px;
    font-size: 10px;
    color: var(--smd-muted);
  }
}

.smd__stack {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;

  article {
    display: flex;
    gap: 7px;
    align-items: center;
    min-width: 0;
    height: 34px;
    padding: 0 9px;
    background: var(--smd-soft);
    border: 1px solid var(--smd-border);
    border-radius: 9px;
  }

  strong {
    display: inline-grid;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    place-items: center;
    font-size: 11px;
    color: #fff;
    background: var(--smd-accent);
    border-radius: 6px;
  }

  span {
    min-width: 0;
    overflow: hidden;
    font-size: 11px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.smd__console {
  display: grid;
  gap: 5px;
  min-height: 0;
  padding: 10px 12px;
  overflow: hidden;
  background: #f7fafc;
  border: 1px solid var(--smd-border);
  border-radius: 12px;

  div {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
    opacity: 0;
    transform: translateX(-8px);
    animation: smd-log 0.45s ease-out forwards;
  }

  span {
    flex: 0 0 auto;
    width: 6px;
    height: 6px;
    background: #10b981;
    border-radius: 50%;
  }

  code {
    display: block;
    min-width: 0;
    overflow: hidden;
    font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
    font-size: 11px;
    color: rgb(15 23 42 / 66%);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.smd--compact {
  .smd__workspace {
    grid-template-columns: 58px minmax(0, 1fr);
  }

  .smd__side {
    padding: 14px 8px;

    p,
    .smd__brand span,
    button span {
      display: none;
    }

    button {
      justify-content: center;
      padding: 0;
    }
  }

  .smd__main {
    grid-template-rows: auto auto minmax(108px, 1fr) auto auto;
    gap: 9px;
    padding: 14px;
  }

  .smd__mesh {
    display: none;
  }

  .smd__head {
    display: block;

    h4 {
      font-size: 17px;
    }
  }

  .smd__metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-width: 0;
    margin-top: 10px;

    article {
      padding: 8px 7px;
    }

    span {
      overflow: visible;
      font-size: 9px;
      line-height: 1.15;
      text-overflow: clip;
      white-space: normal;
    }

    strong {
      font-size: 15px;
    }
  }

  .smd__viz {
    grid-template-columns: minmax(0, 1fr) 92px;
    gap: 10px;
    padding-top: 0;
  }

  .smd__bars {
    gap: 9px;
    min-height: 106px;
  }

  .smd__nodes {
    gap: 7px;
    padding-top: 34px;
  }

  .smd__nodes article {
    padding: 8px 6px;

    span {
      width: 24px;
      height: 18px;
      margin-bottom: 5px;
      font-size: 9px;
    }

    strong {
      font-size: 10px;
    }

    small {
      display: none;
    }
  }

  .smd__pipeline {
    min-height: 90px;
  }

  .smd__stack {
    article {
      justify-content: center;
      padding: 0;
    }

    span {
      display: none;
    }
  }
}

@media (max-width: 680px) {
  .smd {
    min-height: 0;
    height: 100%;
  }

  .smd__chrome {
    height: 34px;
    padding: 0 10px;
    background: rgb(255 255 255 / 88%);
  }

  .smd__appmark {
    display: none;
  }

  .smd__workspace {
    display: block;
    min-height: 0;
  }

  .smd__side {
    display: none;
  }

  .smd__main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 214px;
    padding: 12px 12px 10px;
  }

  .smd__mesh {
    display: none;
  }

  .smd__live {
    height: 22px;
    padding: 0 8px;
    font-size: 10px;
  }

  .smd__head {
    display: block;

    h4 {
      font-size: 15px;
      line-height: 1.18;
    }
  }

  .smd__crumbs {
    font-size: 10px;
  }

  .smd__head p {
    margin-bottom: 3px;
    font-size: 10px;
  }

  .smd__metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-width: 0;
    margin-top: 5px;

    article {
      padding: 5px 5px;
    }

    span,
    em {
      font-size: 8px;
      line-height: 1.15;
    }

    strong {
      margin: 2px 0 1px;
      font-size: 12px;
    }
  }

  .smd__viz {
    display: none;
  }

  .smd__pipeline {
    min-height: 116px;
    padding: 8px 8px 6px;
  }

  .smd__flow {
    height: 64px;
  }

  .smd__nodes {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    padding-top: 30px;
  }

  .smd__nodes article {
    min-width: 0;
    padding: 5px 3px 3px;
  }

  .smd__nodes article span {
    width: 24px;
    height: 20px;
    margin: 0 auto 4px;
    font-size: 9px;
  }

  .smd__nodes article strong {
    font-size: 9px;
    line-height: 1.15;
  }

  .smd__nodes article small {
    display: none;
  }

  .smd__stack,
  .smd__console {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .smd *,
  .smd *::before,
  .smd *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}

@keyframes smd-pulse {
  50% {
    transform: scale(1.25);
    box-shadow: 0 0 0 7px rgb(16 185 129 / 12%);
  }
}

@keyframes smd-rise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes smd-grow {
  from {
    transform: scaleY(0.18);
  }
}

@keyframes smd-fade {
  from {
    opacity: 0;
    transform: scale(0.9);
    transform-origin: center;
  }
}

@keyframes smd-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes smd-flow {
  to {
    stroke-dashoffset: -34;
  }
}

@keyframes smd-log {
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
