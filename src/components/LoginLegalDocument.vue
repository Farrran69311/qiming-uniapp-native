<template>
  <section class="legal-document" role="document" :aria-labelledby="titleId">
    <header class="legal-header">
      <button type="button" class="legal-back" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"
          />
        </svg>
        返回登录
      </button>
      <div class="legal-heading">
        <span>启明智教</span>
        <h2 :id="titleId">{{ document.title }}</h2>
        <p>生效及更新日期：{{ LEGAL_EFFECTIVE_DATE }}</p>
      </div>
    </header>

    <div class="legal-scroll" tabindex="0">
      <p class="legal-summary">{{ document.summary }}</p>
      <section
        v-for="section in document.sections"
        :key="section.title"
        class="legal-section"
      >
        <h3>{{ section.title }}</h3>
        <p v-for="paragraph in section.paragraphs" :key="paragraph">
          {{ paragraph }}
        </p>
        <ul v-if="section.items">
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ul>
      </section>
    </div>

    <footer class="legal-footer">
      <span>请完整阅读后再确认授权</span>
      <button type="button" @click="emit('accept')">同意并返回</button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  LEGAL_EFFECTIVE_DATE,
  loginLegalDocuments,
  type LoginLegalDocumentType
} from "./loginLegalDocuments";

const props = defineProps<{
  type: LoginLegalDocumentType;
}>();

const emit = defineEmits<{
  (event: "back"): void;
  (event: "accept"): void;
}>();

const document = computed(() => loginLegalDocuments[props.type]);
const titleId = computed(() => `login-legal-${props.type}-title`);
</script>

<style lang="scss" scoped>
.legal-document {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 100%;
  height: min(720px, calc(100dvh - 132px));
  min-height: 440px;
  color: #243247;
}

.legal-header {
  position: relative;
  padding: 28px 34px 20px;
  border-bottom: 1px solid #edf1f5;
}

.legal-back {
  position: absolute;
  top: 30px;
  left: 30px;
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
  color: #4d8fbd;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;

  &:hover,
  &:focus-visible {
    color: #2878b0;
    background: #f2f7fb;
    outline: none;
  }
}

.legal-heading {
  padding: 0 100px;
  text-align: center;

  span {
    font-size: 12px;
    font-weight: 600;
    color: #5dade2;
  }

  h2 {
    margin: 3px 0 5px;
    font-size: 22px;
    line-height: 1.35;
    color: #1a1a2e;
  }

  p {
    margin: 0;
    font-size: 12px;
    color: #8a96a6;
  }
}

.legal-scroll {
  padding: 24px 38px 32px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: #c8d6e2 transparent;
  scrollbar-width: thin;

  &:focus-visible {
    outline: 2px solid #8bc9ef;
    outline-offset: -2px;
  }
}

.legal-summary {
  padding: 14px 16px;
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.8;
  color: #465568;
  background: #f4f8fb;
  border-left: 3px solid #5dade2;
  border-radius: 0 6px 6px 0;
}

.legal-section {
  & + & {
    margin-top: 22px;
  }

  h3 {
    margin: 0 0 9px;
    font-size: 16px;
    font-weight: 650;
    color: #1f2d3d;
  }

  p,
  li {
    font-size: 14px;
    line-height: 1.8;
    color: #526174;
  }

  p {
    margin: 7px 0 0;
  }

  ul {
    padding-left: 20px;
    margin: 7px 0 0;
  }

  li + li {
    margin-top: 6px;
  }
}

.legal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 30px;
  background: #fbfcfd;
  border-top: 1px solid #edf1f5;

  span {
    font-size: 12px;
    color: #8a96a6;
  }

  button {
    height: 38px;
    padding: 0 18px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    background: #3498db;
    border: 0;
    border-radius: 7px;

    &:hover,
    &:focus-visible {
      background: #267fb9;
      outline: 3px solid rgb(52 152 219 / 18%);
    }
  }
}

@media screen and (max-width: 768px) {
  .legal-document {
    height: calc(100dvh - 32px);
    min-height: 0;
  }

  .legal-header {
    padding: 20px 18px 15px;
  }

  .legal-back {
    position: static;
    padding: 4px 0;
    margin-bottom: 10px;
  }

  .legal-heading {
    padding: 0;
    text-align: left;

    h2 {
      font-size: 19px;
    }
  }

  .legal-scroll {
    padding: 18px 20px 24px;
  }

  .legal-summary,
  .legal-section p,
  .legal-section li {
    font-size: 13px;
    line-height: 1.75;
  }

  .legal-section h3 {
    font-size: 15px;
  }

  .legal-footer {
    gap: 12px;
    padding: 12px 18px;

    span {
      max-width: 130px;
    }

    button {
      flex-shrink: 0;
    }
  }
}
</style>
