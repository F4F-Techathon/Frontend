import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { defaultFilters, restaurants } from '@/data/restaurants'
import { createDebate } from '@/data/debate'
import { distanceKm, matchesFilters, parseRequirements, preferenceScore } from '@/lib/filtering'
import type { Filters, HistoryEntry } from '@/data/types'

const STORAGE_KEY = 'tonight-dining-v1'

export const useDiningStore = defineStore('dining', () => {
  const rawInput = ref('')
  const filters = ref<Filters>(defaultFilters())
  const selectedIds = ref<string[]>([])
  const messageIndex = ref(0)
  const history = ref<HistoryEntry[]>([])
  const winnerId = ref('')
  const savedAt = ref('')
  const paused = ref(false)
  const toast = ref('')
  let toastTimer: ReturnType<typeof setTimeout>

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && typeof saved.rawInput === 'string' && Array.isArray(saved.selectedIds) && Array.isArray(saved.history)) {
      rawInput.value = saved.rawInput
      filters.value = { ...defaultFilters(), ...saved.filters }
      selectedIds.value = saved.selectedIds.filter((id: string) => restaurants.some((r) => r.id === id)).slice(0, 3)
      messageIndex.value = Number(saved.messageIndex) || 0
      history.value = saved.history
      winnerId.value = saved.winnerId || ''
      savedAt.value = saved.savedAt || ''
      paused.value = true
    }
  } catch { /* A fresh session remains usable if browser storage is unavailable. */ }

  const candidates = computed(() => restaurants.filter((r) => matchesFilters(r, filters.value)).sort((a, b) => preferenceScore(b, filters.value) - preferenceScore(a, filters.value)))
  const selected = computed(() => selectedIds.value.map((id) => restaurants.find((r) => r.id === id)!).filter(Boolean))
  const messages = computed(() => createDebate(selected.value, filters.value))
  const currentMessage = computed(() => messages.value[messageIndex.value])
  const winner = computed(() => {
    const eligible = selected.value.filter((r) => matchesFilters(r, filters.value))
    return eligible.find((r) => r.id === winnerId.value) || eligible.sort((a, b) => preferenceScore(b, filters.value) - preferenceScore(a, filters.value))[0]
  })
  const conditionTags = computed(() => [
    { key: 'people', text: `${filters.value.people} 人`, hard: true },
    ...(filters.value.maxBudget || filters.value.minBudget ? [{ key: 'budget', text: filters.value.maxBudget ? `¥${filters.value.minBudget || 0}–${filters.value.maxBudget} / 人` : `¥${filters.value.minBudget} 以上`, hard: true }] : []),
    { key: 'radius', text: filters.value.radius ? `${filters.value.radius} km 内` : '距离不限', hard: true },
    ...(filters.value.scene ? [{ key: 'scene', text: filters.value.scene, hard: false }] : []),
    ...(filters.value.quiet ? [{ key: 'quiet', text: '安静一点', hard: false }] : []),
    ...(filters.value.mild && !filters.value.noSpice ? [{ key: 'mild', text: '偏好少辣', hard: false }] : []),
    ...(filters.value.noSpice ? [{ key: 'noSpice', text: '不吃辣', hard: true }] : []),
    ...(filters.value.allergy ? [{ key: 'allergy', text: `${filters.value.allergy}过敏`, hard: true }] : []),
    ...filters.value.cuisines.map((c) => ({ key: `cuisine:${c}`, text: c, hard: true })),
  ])

  watch([rawInput, filters, selectedIds, messageIndex, history, winnerId], () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ rawInput: rawInput.value, filters: filters.value, selectedIds: selectedIds.value, messageIndex: messageIndex.value, history: history.value, winnerId: winnerId.value, savedAt: new Date().toISOString() })) } catch { /* Storage does not block the flow. */ }
  }, { deep: true })

  // Gives brief action feedback without introducing blocking dialogs.
  function notify(text: string) { toast.value = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = '' }, 3000) }

  // Starts a new search while preserving an existing session until the user acts.
  function begin() { rawInput.value = ''; filters.value = defaultFilters(); selectedIds.value = []; messageIndex.value = 0; history.value = []; winnerId.value = '' }

  // Parses the initial description and starts the independent filter step.
  function understand(text: string) { rawInput.value = text.trim(); filters.value = parseRequirements(text, defaultFilters()); selectedIds.value = []; winnerId.value = ''; history.value = []; messageIndex.value = 0 }

  // Retains valid choices and visibly proposes up to three initial contestants.
  function prepareSelection() {
    selectedIds.value = selectedIds.value.filter((id) => candidates.value.some((r) => r.id === id))
    if (!selectedIds.value.length) selectedIds.value = candidates.value.slice(0, 3).map((r) => r.id)
  }

  // Enforces the contestant limit for both map markers and list cards.
  function toggleSelection(id: string) {
    if (selectedIds.value.includes(id)) selectedIds.value = selectedIds.value.filter((v) => v !== id)
    else if (selectedIds.value.length < 3) selectedIds.value.push(id)
    else notify('选手席满啦，先移除一位再邀请吧')
  }

  // Creates a fresh discussion for the current selection.
  function startDebate() { messageIndex.value = 0; history.value = []; paused.value = false; winnerId.value = '' }

  // Saves each delivered statement once, including its original evidence references.
  function recordCurrent() {
    const msg = currentMessage.value
    if (msg && !history.value.some((entry) => entry.id === msg.id)) history.value.push({ ...msg, time: new Date().toISOString() })
  }

  // Applies user interventions without overwriting previous statements or selections.
  function intervene(text: string) {
    recordCurrent()
    history.value.push({ id: `user-${Date.now()}`, restaurantId: '', speaker: '你', text, round: currentMessage.value?.round || 1, topic: '补充需求', evidenceIds: [], state: 'listening', time: new Date().toISOString(), user: true })
    filters.value = parseRequirements(text, filters.value)
    notify('收到，选手会带着你的新要求继续讨论')
  }

  // Chooses only contestants still satisfying hard constraints after an intervention.
  function decide() {
    recordCurrent()
    const ranked = selected.value.filter((r) => matchesFilters(r, filters.value)).sort((a, b) => preferenceScore(b, filters.value) - preferenceScore(a, filters.value))
    winnerId.value = ranked[0]?.id || ''
    paused.value = true
    return ranked[0]
  }

  function distance(id: string) { const r = restaurants.find((v) => v.id === id); return r ? distanceKm(filters.value.center, r.coordinates).toFixed(1) : '—' }

  return { rawInput, filters, selectedIds, messageIndex, history, winnerId, savedAt, paused, toast, candidates, selected, messages, currentMessage, winner, conditionTags, notify, begin, understand, prepareSelection, toggleSelection, startDebate, recordCurrent, intervene, decide, distance }
})
