import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { defaultFilters, restaurants } from '@/data/restaurants'
import { MIN_CONTESTANTS, MAX_CONTESTANTS } from '@/data/app'
import { createDebate } from '@/data/debate'
import { distanceKm, matchesFilters, parseRequirements } from '@/lib/filtering'
import type { Filters, HistoryEntry } from '@/data/types'

const STORAGE_KEY = 'tonight-dining-v1'

export const useDiningStore = defineStore('dining', () => {
  const rawInput = ref('')
  const filters = ref<Filters>(defaultFilters())
  const selectedIds = ref<string[]>([])
  const swipeHistory = ref<{ id: string; liked: boolean }[]>([])
  const messageIndex = ref(0)
  const history = ref<HistoryEntry[]>([])
  const winnerId = ref('')
  const paused = ref(false)
  const toast = ref('')
  let toastTimer: ReturnType<typeof setTimeout>

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && typeof saved.rawInput === 'string' && Array.isArray(saved.selectedIds) && Array.isArray(saved.history)) {
      rawInput.value = saved.rawInput
      filters.value = { ...defaultFilters(), ...saved.filters }
      selectedIds.value = [...new Set<string>(saved.selectedIds.filter((id: string) => restaurants.some((r) => r.id === id)))].slice(0, MAX_CONTESTANTS)
      if (Array.isArray(saved.swipeHistory)) {
        swipeHistory.value = saved.swipeHistory.filter((choice: { id: string; liked: boolean }, index: number, choices: { id: string }[]) =>
          choice && typeof choice.liked === 'boolean' && restaurants.some((r) => r.id === choice.id) && choices.findIndex((item) => item?.id === choice.id) === index)
      }
      messageIndex.value = Number(saved.messageIndex) || 0
      history.value = saved.history
      winnerId.value = saved.winnerId || ''
      paused.value = true
    }
  } catch { /* A fresh session remains usable if browser storage is unavailable. */ }

  const candidates = computed(() => restaurants.filter((r) => matchesFilters(r, filters.value)))
  const selected = computed(() => selectedIds.value.map((id) => restaurants.find((r) => r.id === id)!).filter(Boolean))
  const swipeCandidates = computed(() => candidates.value.filter((r) => !selectedIds.value.includes(r.id) && !swipeHistory.value.some((choice) => choice.id === r.id)))
  const canStartDebate = computed(() => selected.value.length >= MIN_CONTESTANTS && selected.value.length <= MAX_CONTESTANTS)
  const messages = computed(() => createDebate(selected.value, filters.value))
  const currentMessage = computed(() => messages.value[messageIndex.value])
  const decisionCandidates = computed(() => selected.value.filter((r) => matchesFilters(r, filters.value)))
  const winner = computed(() => decisionCandidates.value.find((r) => r.id === winnerId.value))
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

  // New conditions start a fresh deck while keeping explicit invitations for reconciliation.
  watch(filters, () => { swipeHistory.value = [] }, { deep: true, flush: 'sync' })

  watch([rawInput, filters, selectedIds, swipeHistory, messageIndex, history, winnerId], () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ rawInput: rawInput.value, filters: filters.value, selectedIds: selectedIds.value, swipeHistory: swipeHistory.value, messageIndex: messageIndex.value, history: history.value, winnerId: winnerId.value })) } catch { /* Storage does not block the flow. */ }
  }, { deep: true })

  // Gives brief action feedback without introducing blocking dialogs.
  function notify(text: string) { toast.value = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = '' }, 3000) }

  // Clears the current dining flow when starting from the home page.
  function begin() { rawInput.value = ''; filters.value = defaultFilters(); selectedIds.value = []; swipeHistory.value = []; messageIndex.value = 0; history.value = []; winnerId.value = '' }

  // Parses the initial description before the user invites restaurants from the swipe deck.
  function understand(text: string) { rawInput.value = text.trim(); filters.value = parseRequirements(text, defaultFilters()); selectedIds.value = []; swipeHistory.value = []; winnerId.value = ''; history.value = []; messageIndex.value = 0 }

  // Condition edits remove ineligible invitations without silently adding other restaurants.
  function reconcileSelection() {
    selectedIds.value = selectedIds.value.filter((id) => candidates.value.some((r) => r.id === id))
  }

  // Commits the visible card once, so canceled gestures and duplicate animation events cannot vote.
  function swipeRestaurant(id: string, liked: boolean) {
    if (swipeCandidates.value[0]?.id !== id || (liked && selectedIds.value.length >= MAX_CONTESTANTS)) return false
    swipeHistory.value.push({ id, liked })
    if (liked) selectedIds.value.push(id)
    return true
  }

  // Undo restores the previous card and reverses its invitation, including after a reload.
  function undoSwipe() {
    const choice = swipeHistory.value.pop()
    if (choice?.liked) removeSelection(choice.id)
  }

  function removeSelection(id: string) { selectedIds.value = selectedIds.value.filter((value) => value !== id) }
  function resetSwipes() { swipeHistory.value = [] }

  // Creates a fresh discussion for the current selection.
  function startDebate() {
    if (!canStartDebate.value || selected.value.some((r) => !matchesFilters(r, filters.value))) return false
    messageIndex.value = 0; history.value = []; paused.value = false; winnerId.value = ''
    return true
  }

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

  // Commit only the restaurant explicitly confirmed by the user.
  function decide(id: string) {
    const choice = decisionCandidates.value.find((r) => r.id === id)
    if (!choice) return undefined
    recordCurrent()
    winnerId.value = choice.id
    paused.value = true
    return choice
  }

  function distance(id: string) { const r = restaurants.find((v) => v.id === id); return r ? distanceKm(filters.value.center, r.coordinates).toFixed(1) : '—' }

  return { rawInput, filters, selectedIds, swipeHistory, swipeCandidates, messageIndex, history, winnerId, paused, toast, candidates, selected, decisionCandidates, canStartDebate, messages, currentMessage, winner, conditionTags, notify, begin, understand, reconcileSelection, swipeRestaurant, undoSwipe, removeSelection, resetSwipes, startDebate, recordCurrent, intervene, decide, distance }
})
