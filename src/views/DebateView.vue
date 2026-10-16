<template>
  <section class="debate-page" :class="{ 'is-opening': entrance.active }" :style="{ '--reveal': revealProgress }"><NavHeader :title="`餐馆路演 · 第 ${message?.round || 1} 轮`" dark @back="openSheet('exit')"><div class="header-actions"><button class="icon-btn" aria-label="查看讨论历史" @click="openSheet('history')"><AppIcon name="history" :size="20" /></button><button class="icon-btn" aria-label="更多讨论操作" @click="openSheet('more')"><AppIcon name="more" :size="21" /></button></div></NavHeader><button class="requirements" @click="openSheet('conditions')"><span><i></i> {{ store.conditionTags.slice(0, 4).map((t) => t.text).join(' · ') }}</span><AppIcon name="filter" :size="14" /></button>
    <TheaterStage :restaurants="store.selected" :active-id="message?.restaurantId" :paused="store.paused"
      :listening="sheet === 'input'" :speaking-state="message?.state" :entering="entrance.active" :progress="entrance.stageProgress" />
    <div class="discussion-area"><article v-if="message" class="speech-card"><header><span class="speaker-dot" :style="{ background: activeRestaurant?.color }"></span><b>{{ message.speaker }}</b><span>{{ activeRestaurant?.name }}</span><button class="icon-btn audio-toggle" :aria-label="audio ? '关闭语音播放' : '开启语音播放'" @click="toggleAudio"><AppIcon :name="audio ? 'volume' : 'mute'" :size="17" /></button><button class="icon-btn" :aria-label="store.paused ? '继续讨论' : '暂停讨论'" @click="store.paused = !store.paused"><AppIcon :name="store.paused ? 'play' : 'pause'" :size="17" /></button></header><div class="speech-text" aria-live="off"><span>{{ message.text.slice(0, visibleCount) }}</span><span class="unspoken">{{ message.text.slice(visibleCount) }}</span></div><div class="speech-bottom"><div class="progress"><i :style="{ width: `${progress}%` }"></i></div><button @click="nextMessage">下一位<AppIcon name="chevron" :size="11" /></button></div></article><button v-if="message?.evidenceIds.length" class="evidence-preview" @click="showEvidence(message.evidenceIds, message.text)"><span class="book-icon"><AppIcon name="book" :size="17" /></span><span><b>查看依据 </b></span><AppIcon name="chevron" :size="16" /></button></div>
    <div class="debate-controls"><button class="decide-link" @click="finish">帮我做决定<AppIcon name="arrow" :size="14" /></button><div class="control-row"><button class="keyboard-control icon-btn" aria-label="用文字补充需求" @click="startInput(false)"><AppIcon name="keyboard" :size="23" /></button><button class="interrupt-button" @click="startInput(true)"><AppIcon name="mic" :size="21" /><span>我也说两句</span></button><button class="pause-control icon-btn" :aria-label="store.paused ? '继续讨论' : '暂停讨论'" @click="store.paused = !store.paused"><AppIcon :name="store.paused ? 'play' : 'pause'" :size="21" /></button></div></div>
    <BottomSheet :open="!!sheet" :title="sheetTitles[sheet] || ''" :size="sheet === 'history' || sheet === 'conditions' ? 'large' : 'medium'" @close="closeSheet"><div class="debate-sheet"><template v-if="sheet === 'history'"><div class="chips history-filters"><button class="chip" :class="{ active: !historyRole }" @click="historyRole = ''">全部</button><button v-for="r in store.selected" :key="r.id" class="chip" :class="{ active: historyRole === r.id }" @click="historyRole = r.id">{{ r.host }}</button><button class="chip" :class="{ active: historyRole === 'user' }" @click="historyRole = 'user'">我的补充</button></div><div v-if="!filteredHistory.length" class="empty-state"><AppIcon name="history" :size="30" /><p>这里还没有讨论记录。</p></div><article v-for="entry in filteredHistory" :key="entry.id" class="history-entry" :class="{ user: entry.user }"><header><b>{{ entry.speaker }}</b><time>{{ formatTime(entry.time) }}</time><span>{{ entry.user ? '补充需求' : `第 ${entry.round} 轮` }}</span></header><p>{{ entry.text }}</p><button v-if="entry.evidenceIds.length" class="text-btn" @click="showEvidence(entry.evidenceIds, entry.text)"><AppIcon name="book" :size="13" />查看当时的依据</button></article></template><template v-else-if="sheet === 'conditions'"><p class="small muted">硬条件决定是否符合，偏好影响最终排序。</p><FilterFields /><button class="btn btn-primary" @click="closeSheet(); store.notify('条件已更新，继续讨论时会使用新条件')">保存当前条件<AppIcon name="check" :size="18" /></button></template><template v-else-if="sheet === 'input'"><div class="input-intro"><GuideOrb small :listening="speech.listening.value" /><div><b>{{ speech.listening.value ? '正在听你说…' : '说说你的新想法' }}</b></div></div><textarea ref="inputEl" v-model="interruption" rows="4" maxlength="300" aria-label="补充用餐需求" placeholder="比如：我不想吃太辣，最好再安静一点…"></textarea><p v-if="speech.error.value" class="input-error">{{ speech.error.value }}</p><div class="input-actions"><button class="icon-btn" :class="{ recording: speech.listening.value }" :aria-label="speech.listening.value ? '结束录音' : '开始录音'" @click="speech.start"><AppIcon :name="speech.listening.value ? 'pause' : 'mic'" /></button><button class="btn btn-primary" :disabled="!interruption.trim()" @click="submitInterruption">更新条件，继续聊<AppIcon name="send" :size="18" /></button></div></template><template v-else-if="sheet === 'more'"><button class="menu-item" @click="finish"><AppIcon name="trophy" />结束讨论，看看结果<AppIcon name="chevron" :size="16" /></button><button class="menu-item" @click="sheet = 'conditions'"><AppIcon name="filter" />调整用餐条件<AppIcon name="chevron" :size="16" /></button><button class="menu-item" @click="sheet = 'exit'"><AppIcon name="map" />回地图换换选手<AppIcon name="chevron" :size="16" /></button></template><template v-else-if="sheet === 'exit'"><p class="exit-copy">想换换今晚的选手吗？当前条件和讨论记录会保留，重新开场时将开始新的讨论。</p><button class="btn btn-primary" @click="router.push('/map')">回地图挑选<AppIcon name="map" :size="19" /></button><button class="btn btn-secondary" @click="closeSheet">留在这场讨论</button></template><template v-else-if="sheet === 'no-match'"><div class="empty-state"><AppIcon name="filter" :size="32" /><h3>新条件下，选手还需要换一换</h3><p>目前没有选手符合全部硬条件。回地图重新筛选，不替你将就。</p><button class="btn btn-primary" @click="router.push('/filter')">重新圈定范围</button></div></template></div></BottomSheet><EvidenceSheet :open="evidenceOpen" :ids="evidenceIds" :claim="evidenceClaim" @close="evidenceOpen = false" />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDiningStore } from '@/stores/dining'
import { useSpeechInput } from '@/composables/useSpeechInput'
import NavHeader from '@/components/NavHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import TheaterStage from '@/components/TheaterStage.vue'
import { useEntranceStore } from '@/stores/entrance'
import { segment } from '@/lib/entranceMotion'
import BottomSheet from '@/components/BottomSheet.vue'
import EvidenceSheet from '@/components/EvidenceSheet.vue'
import FilterFields from '@/components/FilterFields.vue'
import GuideOrb from '@/components/GuideOrb.vue'
const store = useDiningStore(), router = useRouter(), sheet = ref(''), historyRole = ref(''), interruption = ref(''), inputEl = ref<HTMLTextAreaElement>(), audio = ref(false), visibleCount = ref(0), evidenceOpen = ref(false), evidenceIds = ref<string[]>([]), evidenceClaim = ref('')
const entrance = useEntranceStore()
const revealProgress = computed(() => entrance.active ? segment(entrance.stageProgress, .65, 1) : 1)
const speech = useSpeechInput((text) => { interruption.value = text })
const message = computed(() => store.currentMessage), activeRestaurant = computed(() => store.selected.find((r) => r.id === message.value?.restaurantId))
const progress = computed(() => Math.min(100, visibleCount.value / (message.value?.text.length || 1) * 100))
const filteredHistory = computed(() => store.history.filter((entry) => !historyRole.value || (historyRole.value === 'user' ? entry.user : entry.restaurantId === historyRole.value)))
const sheetTitles: Record<string, string> = { history: '这场饭局，聊到了这里', conditions: '今晚的用餐条件', input: '我也说两句', more: '这场讨论，你说了算', exit: '回地图换换选手？', 'no-match': '再找一位合适的选手' }
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
function nextMessage() { stopPlayback(); store.recordCurrent(); if (store.messageIndex < store.messages.length - 1) { store.messageIndex++; hold = 0; visibleCount.value = 0 } else finish() }
function toggleAudio() { if (!('speechSynthesis' in window)) { store.notify('这个浏览器不支持朗读，字幕模式仍可使用'); return }; audio.value = !audio.value; if (audio.value) { visibleCount.value = 0; speakRemaining() } else { stopPlayback(); startPlayback() } }
function openSheet(value: string) { store.paused = true; sheet.value = value }
function closeSheet() { speech.stop(); sheet.value = '' }
function showEvidence(ids: string[], claim: string) { store.paused = true; sheet.value = ''; evidenceIds.value = ids; evidenceClaim.value = claim; evidenceOpen.value = true }
async function startInput(voice: boolean) { openSheet('input'); interruption.value = ''; await nextTick(); if (voice) speech.start(); else inputEl.value?.focus() }

// New requirements regenerate only upcoming demo messages and retain prior history verbatim.
function submitInterruption() { if (!interruption.value.trim()) return; speech.stop(); store.intervene(interruption.value.trim()); sheet.value = ''; if (store.messageIndex < store.messages.length - 1) store.messageIndex++; visibleCount.value = 0; hold = 0; store.paused = false }
function finish() { stopPlayback(); const winner = store.decide(); if (winner) router.push('/result'); else openSheet('no-match') }
function formatTime(time: string) { return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
function onVisibility() { if (document.hidden) store.paused = true }
watch(() => entrance.active, (active) => { if (!active) startPlayback() })
watch(() => store.messageIndex, () => startPlayback(true))
watch(() => store.paused, (paused) => { if (paused) stopPlayback(); else startPlayback() })
onMounted(() => { if (store.messageIndex >= store.messages.length) store.messageIndex = 0; startPlayback(); document.addEventListener('visibilitychange', onVisibility) })
onBeforeUnmount(() => { stopPlayback(); document.removeEventListener('visibilitychange', onVisibility) })
</script>
<style lang="less" scoped>
.debate-page { min-height: 100dvh; display: flex; flex-direction: column; background: #211229; color: var(--cream); overflow: hidden;
  :deep(.nav-header), .requirements, .discussion-area, .debate-controls {
    opacity: var(--reveal, 1);
  }
  .discussion-area, .debate-controls {
    transform: translateY(calc((1 - var(--reveal, 1)) * 16px));
  }
  .header-actions { display: flex; gap: 1px; .icon-btn { color: #d0becf; width: 32px; } } .requirements { background: #ffffff08; border: 1px solid #735a763d; color: #d5c4cc; display: flex; align-items: center; justify-content: space-between; width: calc(100% - 40px); padding: 9px 12px; border-radius: 10px; margin: 0 20px 13px; font-size: 10px; >span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; i { width: 5px; height: 5px; border-radius: 50%; background: var(--gold); flex: none; } } }
  
  .discussion-area { flex: 1; padding: 16px 20px 0;  .speech-card { background: #fff9ef; color: var(--ink); padding: 14px 16px 11px; border: 1px solid #d7bb92; border-radius: 16px; box-shadow: 0 4px 0 #10091944; header { display: flex; align-items: center; gap: 6px; margin-bottom: 9px; .speaker-dot { width: 6px; height: 6px; border-radius: 50%; } b { font-size: 12px; } >span:last-of-type { font-size: 9px; color: #ae9584; } .icon-btn { margin-left: 0; width: 28px; height: 28px; color: #8d7869; background: #ede4d5; &.audio-toggle { margin-left: auto; background: transparent; } } } .speech-text { font-size: 14px; line-height: 1.9; min-height: 80px; .unspoken { color: #cabcae; } } .speech-bottom { display: flex; align-items: center; gap: 12px; margin-top: 11px; .progress { height: 2px; background: #e4d8c4; flex: 1; i { height: 100%; display: block; background: var(--gold); transition: width .1s; } } button { display: flex; align-items: center; gap: 4px; border: 0; background: none; color: #8f786b; font-size: 12px; padding: 3px 0; span { font-family: var(--font-round); color: #b09d8e; margin-right: 3px; } } } } .evidence-preview { width: 100%; display: flex; gap: 9px; align-items: center; padding: 12px 0; border: 0; background: none; color: #d3becf; text-align: left; .book-icon { width: 29px; height: 29px; border-radius: 8px; background: #e3b04b13; color: #d4b578; display: grid; place-items: center; } >span:nth-child(2) { flex: 1; b { display: block; font-size: 12px; font-weight: 500; i { font-size: 8px; font-style: normal; color: #b19676; margin-left: 5px; } } small { display: block; font-size: 8px; margin-top: 5px; color: #9c829f; } } } }
  .debate-controls { padding: 0 20px calc(14px + env(safe-area-inset-bottom)); background: #211229; .decide-link { display: flex; gap: 6px; align-items: center; justify-content: center; margin: 0 auto 13px; padding: 9px; background: none; border: 0; color: #d5b47b; font-size: 11px; } .control-row { display: flex; justify-content: space-between; align-items: center; gap: 14px; .keyboard-control, .pause-control { width: 43px; height: 43px; border: 1px solid #57415f; color: #c8b3c9; background: #ffffff03; } .interrupt-button { display: flex; align-items: center; justify-content: center; gap: 9px; flex: 1; height: 52px; border-radius: 50px; background: var(--gold); color: var(--ink); border: 1px solid #ebc171; box-shadow: 0 3px 0 #89632f; font-size: 14px; font-weight: 750; } } >p { font-size: 9px; color: #9e84a2; text-align: center; margin: 13px 0 0; } }
  .debate-sheet { color: var(--ink); .history-filters { margin: 4px 0 20px; gap: 6px; .chip { font-size: 10px; padding: 8px 12px; } } .history-entry { padding: 16px; border: 1px solid var(--line); border-radius: 14px; margin-bottom: 12px; &.user { background: #e9eddf; } header { display: flex; gap: 9px; align-items: center; b { font-size: 12px; } time { color: #a39380; font-size: 9px; } >span { margin-left: auto; color: #9f8a70; font-size: 9px; } } p { font-size: 12px; line-height: 1.8; } .text-btn { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--green); } } .input-intro { display: flex; gap: 10px; margin: 10px 0 22px; .guide-orb { margin: 0; flex: none; } b { font-size: 14px; } p { font-size: 10px; color: var(--muted); margin: 7px 0 0; } } textarea { width: 100%; resize: none; background: var(--cream); border: 1px solid var(--line); border-radius: 14px; padding: 15px; font-size: 14px; line-height: 1.8; } .input-error { color: var(--red); font-size: 11px; line-height: 1.7; } .input-actions { margin-top: 20px; display: flex; gap: 12px; .icon-btn { background: #eee2ed; width: 52px; height: 52px; flex: none; color: #7a5a9e; &.recording { background: var(--red); color: white; } } } .menu-item { display: flex; gap: 12px; width: 100%; align-items: center; background: none; border: 0; border-bottom: 1px solid var(--line); padding: 22px 0; font-size: 13px; .app-icon:last-child { margin-left: auto; } } .notice { margin-top: 20px; } .exit-copy { font-size: 13px; line-height: 1.9; color: #8c7683; margin: 10px 0 22px; } .btn + .btn { margin-top: 12px; } }
}
</style>
