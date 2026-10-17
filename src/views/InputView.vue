<template>
  <section class="input-page" :class="{ 'has-draft': intake.result, 'is-departing': pickerArrival.active }">
    <NavHeader title="说说你的想法" @back="router.push('/')" />
    <div class="input-content">
      <h2 class="page-title">今晚想吃点什么<span>？</span></h2>
      <div class="orb-area"><div class="orb-anchor" data-guide-orb-anchor="input" aria-hidden="true"></div></div>
      <div class="heard-area" aria-live="polite" aria-atomic="true">
        <p v-if="speech.error.value" class="speech-error">{{ speech.error.value }}</p>
        <p v-else-if="speech.listening.value || finishing" class="heard-text">{{ text || '我在听…' }}</p>
        <p v-else-if="intake.loading" class="thinking-text">我整理一下…</p>
        <p v-else-if="intake.error" class="speech-error">{{ intake.error }}</p>
        <p v-else-if="intake.result" class="orb-reply">{{ intake.result.question || intake.result.reply }}</p>
        <button v-if="intake.error && !speech.listening.value && !finishing && !intake.loading" class="text-btn retry-button" @click="retryIntake"><AppIcon name="refresh" :size="15" />重新整理</button>
      </div>
      <Transition name="draft">
        <RequirementsCard v-if="intake.result && hasFacts" :requirements="intake.result.requirements" />
      </Transition>
      <div v-if="places.length" class="location-choices" aria-label="确认用餐位置">
        <p>你说的是哪一处？</p>
        <button v-for="place in places" :key="`${place.location.lng},${place.location.lat}`" @click="choosePlace(place)">
          <AppIcon name="pin" :size="18" /><span><b>{{ place.name }}</b><small>{{ place.address }}</small></span><AppIcon name="check" :size="16" />
        </button>
      </div>
      <p v-if="locationError" class="location-error" role="status">{{ locationError }}</p>
    </div>
    <div class="voice-action">
      <button class="btn voice-button" :class="{ listening: speech.listening.value }"
        :disabled="intake.loading || processing || finishing || pickerArrival.active" :aria-pressed="speech.holding.value" :aria-busy="intake.loading || finishing"
        :aria-label="speech.holding.value ? '松开发送' : '长按说话'" v-on="speech.events">
        <span v-if="speech.listening.value" class="voice-wave" aria-hidden="true"><i v-for="n in 5" :key="n"></i></span>
        <AppIcon v-else name="mic" :size="23" />
        <span>{{ intake.loading ? '整理中…' : finishing ? '稍等…' : speech.holding.value ? '松开发送' : '长按说话' }}</span>
      </button>
      <button v-if="intake.result" class="continue-button" :disabled="!canContinue" @click="continueFlow">{{ processing ? '准备一下…' : '就这样，去挑饭店' }}<AppIcon name="arrow" :size="17" /></button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDiningStore } from '@/stores/dining'
import { useIntakeStore } from '@/stores/intake'
import { usePickerArrivalStore } from '@/stores/pickerArrival'
import { usePressToTalk } from '@/composables/usePressToTalk'
import { filtersFromRequirements, requirementRows } from '@/lib/intakeRequirements'
import { findDiningPlaces, locateDiningCenter } from '@/lib/amap'
import type { Place } from '@/lib/amap'
import type { Coordinates } from '@/data/types'
import NavHeader from '@/components/NavHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import RequirementsCard from '@/components/RequirementsCard.vue'

const router = useRouter(), store = useDiningStore(), intake = useIntakeStore()
const pickerArrival = usePickerArrivalStore()
const text = ref(''), processing = ref(false)
const places = ref<Place[]>([]), locationError = ref('')
const resolvedLocation = ref<{ query: string; name: string; center: Coordinates }>()
const speech = usePressToTalk((value) => { text.value = value }, {
  disabled: () => intake.loading || processing.value || pickerArrival.active,
  onStart: () => { text.value = ''; locationError.value = '' },
  onComplete: (value) => { void intake.submit(value) },
})
const finishing = speech.finishing
const hasFacts = computed(() => intake.result && requirementRows(intake.result.requirements).length > 0)
const canContinue = computed(() => intake.canConfirm && !speech.listening.value && !finishing.value && !processing.value)
let alive = true

watch(speech.listening, (value) => { pickerArrival.listening = value }, { immediate: true, flush: 'sync' })
watch(() => intake.loading, (value) => { pickerArrival.thinking = value }, { immediate: true, flush: 'sync' })
watch(() => intake.result?.requirements.location, () => { resolvedLocation.value = undefined; places.value = []; locationError.value = '' })

function retryIntake() { speech.error.value = ''; void intake.retry() }

function choosePlace(place: Place) {
  resolvedLocation.value = { query: intake.result!.requirements.location!, name: place.name, center: [place.location.lng, place.location.lat] }
  places.value = []
  locationError.value = ''
}

// Resolve explicit locations with map data, then commit the confirmed snapshot exactly once.
async function continueFlow() {
  if (!canContinue.value || !intake.result) return
  processing.value = true
  locationError.value = ''
  const draft = intake.result.requirements
  const query = draft.location && draft.location !== 'any' ? draft.location : typeof draft.radiusKm === 'number' ? 'nearby' : null
  try {
    if (query && resolvedLocation.value?.query !== query) {
      if (query === 'nearby') {
        const location = await locateDiningCenter()
        if (!alive) return
        resolvedLocation.value = { query, ...location }
      } else {
        const matches = await findDiningPlaces(query)
        if (!alive) return
        if (matches.length > 1) { places.value = matches; return }
        const place = matches[0]!
        resolvedLocation.value = { query, name: place.name, center: [place.location.lng, place.location.lat] }
      }
    }
    if (!alive) return
    const confirmed = filtersFromRequirements(draft, query ? resolvedLocation.value : undefined)
    const description = intake.turns.filter((turn) => turn.role === 'user').map((turn) => turn.content).join('\n')
    if (store.rawInput !== description || JSON.stringify(store.filters) !== JSON.stringify(confirmed)) store.understand(description, confirmed)
    speech.cancel()
    try { await router.push('/pick') }
    catch { pickerArrival.finish(); store.notify('候场暂时没打开，再试一次吧') }
  } catch (e) {
    if (alive) locationError.value = e instanceof Error ? e.message : '位置还没确定，再试一次吧。'
  } finally { if (alive) processing.value = false }
}

onBeforeUnmount(() => { alive = false; speech.cancel(); intake.cancel(); pickerArrival.listening = false; pickerArrival.thinking = false })
</script>

<style lang="less" scoped>
.input-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;

  :deep(.nav-header), .page-title, .heard-area, .voice-action, .requirements-card, .location-choices {
    transition: opacity .3s ease, transform .45s cubic-bezier(.22, .61, .36, 1);
  }

  .input-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 680px;
    margin-inline: auto;
    padding: clamp(20px, 5dvh, 64px) var(--inset-right) 12px var(--inset-left);

    .page-title { margin: 0; text-align: center; span { color: var(--red); } }

    .orb-area {
      flex: 1;
      width: 100%;
      min-height: clamp(180px, 32dvh, 380px);
      display: grid;
      place-items: center;
      padding: clamp(16px, 3dvh, 36px) 0;
      transition: min-height .8s cubic-bezier(.22, .8, .25, 1), flex-grow .8s ease, padding .8s ease;
      .orb-anchor { width: clamp(150px, min(42vw, 25dvh), 280px); aspect-ratio: 1; transition: width .8s cubic-bezier(.22, .8, .25, 1); }
    }

    .heard-area {
      flex: none;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: clamp(72px, 12dvh, 128px);
      width: 100%;
      padding: 8px 0 18px;
      text-align: center;
      p { margin: 0; font-size: var(--heading-size); color: #665365; line-height: var(--line-body); overflow-wrap: anywhere; }
      .thinking-text { font-size: var(--body-size); color: var(--muted); }
      .speech-error { font-size: var(--label-size); color: var(--red); }
      .retry-button { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; color: var(--green); }
    }

    .location-choices {
      width: 100%;
      margin-top: 16px;
      >p { margin: 0 0 8px; color: #665365; font-size: var(--body-size); }
      >button {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 13px 0;
        background: transparent;
        border: 0;
        border-bottom: 1px solid var(--line);
        text-align: left;
        color: var(--green);
        >span { flex: 1; min-width: 0; b { display: block; color: var(--ink); font-size: var(--body-size); } small { display: block; margin-top: 3px; color: var(--muted); overflow-wrap: anywhere; } }
      }
    }
    .location-error { color: var(--red); font-size: var(--label-size); margin: 14px 0 0; }
    .draft-enter-active { transition: opacity .55s ease .15s, transform .7s cubic-bezier(.22, .8, .25, 1) .15s; }
    .draft-enter-from { opacity: 0; transform: translateY(18px); }
  }

  &.has-draft {
    .input-content {
      .orb-area {
        flex-grow: 0;
        min-height: clamp(120px, 19dvh, 200px);
        padding: 16px 0;
        .orb-anchor { width: clamp(92px, min(26vw, 15dvh), 150px); }
      }
      .heard-area { min-height: 76px; }
    }
  }

  &.is-departing {
    :deep(.nav-header), .page-title, .heard-area, .requirements-card, .location-choices { opacity: 0; transform: translateY(-8px); }
    .voice-action { opacity: 0; transform: translateY(14px); }
  }

  .voice-action {
    position: sticky;
    bottom: 0;
    z-index: 2;
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
    background: #f5eee3ed;
    backdrop-filter: blur(10px);
    padding: 20px var(--inset-right) calc(clamp(20px, 4dvh, 40px) + env(safe-area-inset-bottom)) var(--inset-left);

    .voice-button {
      min-height: var(--control-height);
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      background: var(--gold);
      border-color: #dca64a;
      box-shadow: 0 4px 0 #c28e32, 0 9px 24px #b0893d1c;
      transition: background .35s, border-color .35s, box-shadow .35s, transform .15s;
      &.listening { background: #e6d8e8; border-color: #c9b4d0; box-shadow: 0 4px 0 #b49cbd, 0 9px 24px #7a5a9e16; color: #65476e; }
      .voice-wave {
        display: flex; align-items: center; justify-content: center; gap: 3px; width: 23px; height: 23px;
        i { width: 2px; height: 16px; border-radius: 3px; background: currentColor; animation: voice-wave .85s ease-in-out infinite alternate;
          &:nth-child(2) { animation-delay: -.25s; } &:nth-child(3) { animation-delay: -.5s; } &:nth-child(4) { animation-delay: -.15s; } &:nth-child(5) { animation-delay: -.4s; }
        }
      }
    }
    .continue-button { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 48px; margin-top: 14px; padding: 8px; border: 0; background: transparent; color: #77604b; font-size: var(--body-size); &:disabled { opacity: .35; } }
  }
  @keyframes voice-wave { from { transform: scaleY(.3); } to { transform: scaleY(1); } }
}
</style>
