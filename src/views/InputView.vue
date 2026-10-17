<template>
  <section class="input-page">
    <NavHeader title="说说你的想法" :step="1" @back="router.push('/')" />
    <div class="input-content">
      <h2 class="page-title">今晚想吃点什么<span>？</span></h2>
      <div class="orb-area"><GuideOrb :listening="speech.listening.value" /></div>
      <div class="heard-area" aria-live="polite" aria-atomic="true">
        <p v-if="speech.error.value" class="speech-error">{{ speech.error.value }}</p>
        <p v-else-if="text" class="heard-text">{{ text }}</p>
        <p v-else-if="speech.listening.value" class="listening-hint">我在听…</p>
      </div>
    </div>
    <div class="voice-action">
      <button class="btn voice-button" :class="{ listening: speech.listening.value }"
        :disabled="processing" :aria-pressed="speech.listening.value"
        :aria-label="speech.listening.value ? '结束说话并继续' : '点击说话'" @click="toggleSpeech">
        <span v-if="speech.listening.value" class="voice-wave" aria-hidden="true"><i v-for="n in 5" :key="n"></i></span>
        <AppIcon v-else name="mic" :size="23" />
        <span>{{ processing ? '出发…' : speech.listening.value ? '说好了' : '点击说话' }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDiningStore } from '@/stores/dining'
import { useSpeechInput } from '@/composables/useSpeechInput'
import NavHeader from '@/components/NavHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import GuideOrb from '@/components/GuideOrb.vue'

const router = useRouter(), store = useDiningStore()
const text = ref(''), processing = ref(false)
const speech = useSpeechInput((value) => { text.value = value }, { continuous: false, onComplete: continueFlow })

// One button starts listening or asks recognition to finish its last words.
function toggleSpeech() {
  if (speech.listening.value) speech.stop()
  else { text.value = ''; speech.start() }
}

// Only a completed recognition advances, so interim words never submit a partial request.
async function continueFlow(value: string) {
  if (processing.value) return
  text.value = value
  processing.value = true
  store.understand(value)
  try { await router.push('/filter') }
  finally { processing.value = false }
}
</script>

<style lang="less" scoped>
.input-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;

  .input-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(20px, 5dvh, 64px) var(--inset-right) 12px var(--inset-left);

    .page-title {
      margin: 0;
      font-size: var(--title-size);
      text-align: center;
      span { color: var(--red); }
    }

    .orb-area {
      flex: 1;
      width: 100%;
      min-height: clamp(180px, 32dvh, 380px);
      display: grid;
      place-items: center;
      padding: clamp(16px, 3dvh, 36px) 0;
      .guide-orb { width: clamp(150px, min(42vw, 25dvh), 280px); height: auto; aspect-ratio: 1; }
    }

    .heard-area {
      min-height: clamp(72px, 12dvh, 128px);
      width: 100%;
      max-width: 560px;
      text-align: center;
      p { margin: 0; line-height: 1.9; overflow-wrap: anywhere; }
      .heard-text { font-size: clamp(18px, 2.4vw, 24px); color: #665365; }
      .listening-hint { font-size: var(--body-size); color: var(--muted); }
      .speech-error { font-size: var(--label-size); color: var(--red); }
    }
  }

  .voice-action {
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
    padding: 20px var(--inset-right) calc(clamp(20px, 4dvh, 40px) + env(safe-area-inset-bottom)) var(--inset-left);

    .voice-button {
      min-height: var(--control-height);
      font-size: clamp(16px, 1.8vw, 19px);
      background: var(--gold);
      border-color: #dca64a;
      box-shadow: 0 4px 0 #c28e32, 0 9px 24px #b0893d1c;
      transition: background .35s, border-color .35s, box-shadow .35s, transform .15s;
      &.listening { background: #e6d8e8; border-color: #c9b4d0; box-shadow: 0 4px 0 #b49cbd, 0 9px 24px #7a5a9e16; color: #65476e; }

      .voice-wave {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 23px;
        height: 23px;
        i {
          width: 2px;
          height: 16px;
          border-radius: 3px;
          background: currentColor;
          animation: voice-wave .85s ease-in-out infinite alternate;
          &:nth-child(2) { animation-delay: -.25s; }
          &:nth-child(3) { animation-delay: -.5s; }
          &:nth-child(4) { animation-delay: -.15s; }
          &:nth-child(5) { animation-delay: -.4s; }
        }
      }
    }
  }

  @keyframes voice-wave { from { transform: scaleY(.3); } to { transform: scaleY(1); } }
}
</style>
