<template>
  <div class="evidence-disclosure" :class="{ dark, 'is-open': expanded }">
    <button class="evidence-toggle" :aria-expanded="expanded" :aria-controls="panelId" @click="toggle">
      <AppIcon name="book" :size="16" />
      <span>{{ expanded ? '收起依据' : label }}</span>
      <AppIcon name="chevron" :size="14" class="disclosure-arrow" />
    </button>
    <div :id="panelId" class="evidence-body" :aria-hidden="!expanded" :inert="!expanded || undefined">
      <div class="evidence-content">
        <div class="evidence-list">
          <span v-if="items.some((item) => item.mock)" class="demo-label">演示资料</span>
          <article v-for="item in items" :key="item.id" class="evidence-item">
            <h3>{{ item.title }}</h3>
            <blockquote>{{ item.text }}</blockquote>
            <footer><span>{{ item.source }}</span><time :datetime="item.date">{{ item.date }}</time></footer>
            <a v-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer">
              查看原始来源<AppIcon name="external" :size="13" />
            </a>
          </article>
          <p v-if="!items.length" class="empty-evidence">暂无可引用资料</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { evidence } from '@/data/restaurants'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{ ids: string[]; label?: string; dark?: boolean }>(), { label: '查看依据' })
const emit = defineEmits<{ expand: [] }>()
const expanded = ref(false)
const panelId = `evidence-${useId()}`
const items = computed(() => props.ids.map((id) => evidence.find((item) => item.id === id)).filter((item) => !!item))

// Opening keeps the sources beside their statement and lets the player pause for reading.
function toggle() {
  expanded.value = !expanded.value
  if (expanded.value) emit('expand')
}
</script>

<style lang="less" scoped>
.evidence-disclosure {
  --evidence-ink: #71616b;
  --evidence-muted: #9b897d;
  --evidence-accent: #786046;
  --evidence-line: #e3d6c1;

  .evidence-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 12px 0;
    border: 0;
    background: transparent;
    color: var(--evidence-accent);
    font-size: var(--label-size);
    text-align: left;

    .disclosure-arrow {
      margin-left: auto;
      transform: rotate(90deg);
      transition: transform .45s cubic-bezier(.22, .61, .36, 1);
    }
  }

  .evidence-body {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transition: grid-template-rows .45s cubic-bezier(.22, .61, .36, 1), opacity .3s ease;

    .evidence-content {
      min-height: 0;
      overflow: hidden;

      .evidence-list {
        padding: 2px 0 14px;

        .demo-label {
          display: block;
          margin-bottom: 10px;
          color: var(--evidence-muted);
          font-size: var(--small-size);
        }

        .evidence-item {
          padding: 12px 0 12px 14px;
          border-left: 1px solid var(--evidence-line);

          & + .evidence-item { margin-top: 4px; }

          h3 {
            margin: 0 0 7px;
            color: var(--evidence-accent);
            font-size: var(--label-size);
            font-weight: var(--weight-semibold);
          }

          blockquote {
            margin: 0;
            color: var(--evidence-ink);
            font-size: var(--body-size);
            line-height: var(--line-body);
            overflow-wrap: anywhere;
          }

          footer {
            display: flex;
            flex-wrap: wrap;
            gap: 4px 12px;
            margin-top: 10px;
            color: var(--evidence-muted);
            font-size: var(--small-size);
            line-height: var(--line-compact);
          }

          a {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            margin-top: 10px;
            color: var(--evidence-accent);
            font-size: var(--label-size);
          }
        }

        .empty-evidence {
          margin: 0;
          color: var(--evidence-muted);
          font-size: var(--label-size);
        }
      }
    }
  }

  &.is-open {
    .evidence-toggle .disclosure-arrow { transform: rotate(-90deg); }
    .evidence-body { grid-template-rows: 1fr; opacity: 1; }
  }

  &.dark {
    --evidence-ink: #d7c6d3;
    --evidence-muted: #a38aa3;
    --evidence-accent: #d6b780;
    --evidence-line: #6d526e;
  }
}
</style>
