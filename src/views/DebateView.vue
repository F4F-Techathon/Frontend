<template>
  <section class="debate-page" :class="{ 'is-opening': entrance.active }" :style="{ '--reveal': revealProgress }">
    <NavHeader :title="APP_NAME" dark @back="openSheet('more')">
      <button class="decision-button" @click="openDecision">做出决定<AppIcon name="arrow" :size="14" /></button>
    </NavHeader>
    <TheaterStage :restaurants="store.selected" :active-id="message?.restaurantId" :paused="store.paused"
      :listening="speech.listening.value" :speaking-state="message?.state" :entering="entrance.active" :progress="entrance.stageProgress" />
    <div class="discussion-area">
      <article v-if="message" class="speech-card" :class="{ 'is-listening': speech.listening.value }">
        <header>
          <span class="speaker-dot" :style="{ background: speech.listening.value ? 'var(--green)' : activeRestaurant?.color }"></span>
          <b>{{ speech.listening.value ? '正在听你说' : message.speaker }}</b>
          <template v-if="!speech.listening.value">
            <span>{{ activeRestaurant?.name }}</span>
            <button class="icon-btn audio-toggle" :aria-label="audio ? '关闭语音播放' : '开启语音播放'" @click="toggleAudio"><AppIcon :name="audio ? 'volume' : 'mute'" :size="17" /></button>
            <button class="icon-btn" :aria-label="store.paused ? '继续讨论' : '暂停讨论'" @click="store.paused = !store.paused"><AppIcon :name="store.paused ? 'play' : 'pause'" :size="17" /></button>
          </template>
        </header>
        <div class="speech-text" :aria-live="speech.listening.value ? 'polite' : 'off'">
          <span v-if="speech.listening.value">{{ interruption || '…' }}</span>
          <template v-else><span>{{ message.text.slice(0, visibleCount) }}</span><span class="unspoken">{{ message.text.slice(visibleCount) }}</span></template>
        </div>
        <div class="progress"><i :style="{ width: `${progress}%` }"></i></div>
      </article>
      <EvidencePanel v-if="!speech.listening.value && messageEvidence.length" :items="messageEvidence" dark />
    </div>
    <div class="debate-controls">
      <p v-if="speech.error.value" class="voice-error" role="status">{{ speech.error.value }}</p>
      <div class="control-row">
        <button class="interrupt-button" :class="{ listening: speech.listening.value }" :disabled="finishing || entrance.active || !!sheet"
          :aria-pressed="speech.holding.value" :aria-busy="finishing" :aria-label="speech.holding.value ? '松开发送' : '长按说话'" v-on="speech.events">
          <span v-if="speech.listening.value" class="voice-wave" aria-hidden="true"><i v-for="n in 5" :key="n"></i></span>
          <AppIcon v-else name="mic" :size="21" />
          <span>{{ finishing ? '稍等…' : speech.holding.value ? '松开发送' : '长按说话' }}</span>
        </button>
        <button class="pause-control icon-btn" :disabled="speech.listening.value" :aria-label="store.paused ? '继续讨论' : '暂停讨论'" @click="store.paused = !store.paused"><AppIcon :name="store.paused ? 'play' : 'pause'" :size="21" /></button>
      </div>
    </div>
    <DebateSheet v-model="sheet" />
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDiningStore } from '@/stores/dining'
import { usePressToTalk } from '@/composables/usePressToTalk'
import { APP_NAME } from '@/data/app'
import { getEvidence } from '@/data/restaurants'
import NavHeader from '@/components/NavHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import TheaterStage from '@/components/TheaterStage.vue'
import { useEntranceStore } from '@/stores/entrance'
import { segment } from '@/lib/entranceMotion'
import DebateSheet from '@/components/DebateSheet.vue'
import EvidencePanel from '@/components/EvidencePanel.vue'
const store = useDiningStore(), sheet = ref(''), audio = ref(false), visibleCount = ref(0)
const interruption = ref('')
const entrance = useEntranceStore()
const speech = usePressToTalk((text) => { interruption.value = text }, {
  disabled: () => entrance.active || !!sheet.value,
  onStart: beginInterruption,
  onComplete: submitInterruption,
})
const finishing = speech.finishing
const revealProgress = computed(() => entrance.active ? segment(entrance.stageProgress, .65, 1) : 1)
const message = computed(() => store.currentMessage), activeRestaurant = computed(() => store.selected.find((r) => r.id === message.value?.restaurantId))
const messageEvidence = computed(() => getEvidence(message.value?.evidenceIds || []))
const progress = computed(() => Math.min(100, visibleCount.value / (message.value?.text.length || 1) * 100))
let interval: ReturnType<typeof setInterval>, hold = 0, utterance: SpeechSynthesisUtterance | undefined, speechActive = false

// Native speech is optional; the caption timer always remains usable without audio.
function speakRemaining() {
  if (!audio.value || store.paused || !message.value || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  utterance = new SpeechSynthesisUtterance(message.value.text.slice(visibleCount.value)); utterance.lang = 'zh-CN'; utterance.rate = 1.05; speechActive = true
  utterance.onend = () => { speechActive = false; visibleCount.value = message.value?.text.length || 0 }
  utterance.onerror = (e) => { speechActive = false; if (e.error !== 'interrupted' && e.error !== 'canceled') { audio.value = false; store.notify('语音暂时无法播放，字幕会继续') } }
  window.speechSynthesis.speak(utterance)
}

// A bounded caption player can pause, resume and advance without a fixed film timeline.
function startPlayback(reset = false) {
  clearInterval(interval)
  if (reset) { visibleCount.value = 0; hold = 0 }
  if (entrance.active || store.paused || !message.value) return
  store.recordCurrent(); speakRemaining()
  interval = setInterval(() => { if (!message.value) return; if (visibleCount.value < message.value.text.length) visibleCount.value++; else if (!speechActive && ++hold > 32) nextMessage() }, 65)
}

function stopPlayback() { clearInterval(interval); speechActive = false; if (utterance) { utterance.onend = null; utterance.onerror = null }; window.speechSynthesis?.cancel() }
function nextMessage() { stopPlayback(); store.recordCurrent(); if (store.messageIndex < store.messages.length - 1) { store.messageIndex++; hold = 0; visibleCount.value = 0 } else openDecision() }
function toggleAudio() { if (!('speechSynthesis' in window)) { store.notify('这个浏览器不支持朗读，字幕模式仍可使用'); return }; audio.value = !audio.value; if (audio.value) { visibleCount.value = 0; speakRemaining() } else { stopPlayback(); startPlayback() } }
function openSheet(value: string) { speech.cancel(); store.paused = true; sheet.value = value }

// Speaking takes over the existing stage card and pauses the current restaurant in place.
function beginInterruption() {
  interruption.value = ''
  stopPlayback()
  store.paused = true
}

// The local UI demo continues when final recognition arrives, without a separate confirmation sheet.
function submitInterruption(text: string) {
  store.intervene(text)
  if (store.messageIndex < store.messages.length - 1) store.messageIndex++
  visibleCount.value = 0
  hold = 0
  store.paused = false
}
// Both the header action and the end of the discussion wait for the user's own choice.
function openDecision() { stopPlayback(); store.recordCurrent(); openSheet(store.decisionCandidates.length ? 'decision' : 'no-match') }
function onVisibility() { if (document.hidden) store.paused = true }
watch(() => entrance.active, (active) => { if (!active) startPlayback() })
watch(() => store.messageIndex, () => startPlayback(true))
watch(() => store.paused, (paused) => { if (paused) stopPlayback(); else startPlayback() })
onMounted(() => { if (store.messageIndex >= store.messages.length) store.messageIndex = 0; startPlayback(); document.addEventListener('visibilitychange', onVisibility) })
onBeforeUnmount(() => { stopPlayback(); document.removeEventListener('visibilitychange', onVisibility) })
</script>
<style lang="less" scoped>
.debate-page { min-height: 100dvh; display: flex; flex-direction: column; background: #211229; color: var(--cream); overflow: hidden;
  :deep(.nav-header), .discussion-area, .debate-controls {
    opacity: var(--reveal, 1);
  }
  .discussion-area, .debate-controls {
    transform: translateY(calc((1 - var(--reveal, 1)) * 16px));
  }
  .decision-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    gap: 6px;
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid #dca64a;
    border-radius: 18px;
    background: var(--gold);
    color: var(--ink);
    font-size: var(--label-size);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
    transition: transform .2s ease;
    &::before { content: ''; position: absolute; inset: -6px 0; }
    &:active { transform: scale(.97); }
  }

  .discussion-area {
    flex: 1;
    width: 100%;
    max-width: var(--content-width);
    margin: 0 auto;
    padding: 16px var(--inset-right) 0 var(--inset-left);

    .speech-card {
      background: #fff9ef;
      color: var(--ink);
      padding: clamp(14px, 2vw, 24px) clamp(16px, 2.5vw, 28px) 14px;
      border: 1px solid #d7bb92;
      border-radius: 16px;
      box-shadow: 0 4px 0 #10091944;
      transition: background .35s ease, border-color .35s ease;

      header {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 28px;
        margin-bottom: 9px;
        .speaker-dot { width: 6px; height: 6px; border-radius: 50%; }
        b { font-size: var(--label-size); }
        >span:last-of-type { font-size: var(--small-size); color: #ae9584; }
        .icon-btn { margin-left: 0; width: 28px; height: 28px; color: #8d7869; background: #ede4d5; &.audio-toggle { margin-left: auto; background: transparent; } }
      }
      .speech-text {
        font-size: var(--body-size);
        line-height: var(--line-body);
        min-height: 80px;
        overflow-wrap: anywhere;
        .unspoken { color: #cabcae; }
      }
      .progress {
        height: 2px;
        margin-top: 16px;
        background: #e4d8c4;
        transition: opacity .25s ease;
        i { height: 100%; display: block; background: var(--gold); transition: width .1s; }
      }
      &.is-listening {
        background: #f3eaf2;
        border-color: #d6c1d9;
        .speech-text { color: #66506d; }
        .progress { opacity: 0; }
      }
    }
  }

  .debate-controls {
    width: 100%;
    max-width: var(--content-width);
    margin: 0 auto;
    padding: 0 var(--inset-right) calc(14px + env(safe-area-inset-bottom)) var(--inset-left);
    background: #211229;
    .voice-error { margin: 0 0 12px; color: #e6b6b1; font-size: var(--label-size); line-height: var(--line-body); }
    .control-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;

      .pause-control {
        width: 46px;
        height: 46px;
        flex-shrink: 0;
        border: 1px solid #57415f;
        color: #c8b3c9;
        background: #ffffff03;
        &:disabled { opacity: .35; }
      }
      .interrupt-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        flex: 1;
        min-width: 0;
        min-height: var(--control-height);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        border-radius: 50px;
        background: var(--gold);
        color: var(--ink);
        border: 1px solid #ebc171;
        box-shadow: 0 3px 0 #89632f;
        font-size: var(--body-size);
        font-weight: var(--weight-semibold);
        transition: background .35s ease, color .35s ease, border-color .35s ease, box-shadow .35s ease;
        &.listening { background: #e6d8e8; color: #65476e; border-color: #c9b4d0; box-shadow: 0 3px 0 #9d83a7; }

        .voice-wave {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          width: 21px;
          height: 21px;
          i {
            width: 2px;
            height: 16px;
            border-radius: 3px;
            background: currentColor;
            animation: stage-voice-wave .85s ease-in-out infinite alternate;
            &:nth-child(2) { animation-delay: -.25s; }
            &:nth-child(3) { animation-delay: -.5s; }
            &:nth-child(4) { animation-delay: -.15s; }
            &:nth-child(5) { animation-delay: -.4s; }
          }
        }
      }
    }
  }

  @keyframes stage-voice-wave { from { transform: scaleY(.3); } to { transform: scaleY(1); } }
}
</style>
