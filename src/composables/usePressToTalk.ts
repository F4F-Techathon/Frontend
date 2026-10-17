import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSpeechInput } from './useSpeechInput'

interface PressToTalkOptions {
  disabled?: () => boolean
  onStart?: () => void
  onComplete: (text: string) => void
}

// Share one hold gesture across intake and stage, keeping final words until the user releases.
export function usePressToTalk(onText: (text: string) => void, options: PressToTalkOptions) {
  const holding = ref(false)
  let accepting = false, pressedAt = 0, pendingText = ''
  let pointerId: number | undefined, captureTarget: HTMLElement | undefined, heldKey: string | undefined
  const speech = useSpeechInput(onText, { onComplete: (text) => {
    if (!accepting) return
    if (holding.value) pendingText = text
    else complete(text)
  } })
  const listening = computed(() => holding.value || speech.listening.value)
  const finishing = computed(() => !holding.value && speech.listening.value)

  function complete(text: string) { accepting = false; pendingText = ''; options.onComplete(text) }

  // Clear ownership before releasing capture: lostpointercapture must not cancel a completed hold.
  function releaseCapture() {
    const target = captureTarget, id = pointerId
    captureTarget = undefined; pointerId = undefined; heldKey = undefined
    if (target && id !== undefined && target.hasPointerCapture(id)) target.releasePointerCapture(id)
  }

  function cancel() {
    accepting = false; pendingText = ''; holding.value = false
    releaseCapture()
    speech.cancel()
  }

  // Start synchronously in the user gesture so microphone permission works on mobile browsers.
  function begin() {
    if (options.disabled?.() || accepting || listening.value) return false
    accepting = true; holding.value = true; pressedAt = performance.now()
    options.onStart?.()
    speech.start()
    if (!speech.listening.value) { cancel(); return false }
    return true
  }

  function release() {
    if (!holding.value) return
    if (performance.now() - pressedAt < 200) { cancel(); return }
    holding.value = false
    releaseCapture()
    if (pendingText) complete(pendingText)
    else speech.stop()
  }

  function pointerdown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || pointerId !== undefined || heldKey) return
    event.preventDefault()
    if (!begin()) return
    pointerId = event.pointerId
    captureTarget = event.currentTarget as HTMLElement
    try { captureTarget.setPointerCapture(event.pointerId) }
    catch { cancel() }
  }

  function pointerup(event: PointerEvent) { if (event.pointerId === pointerId) release() }
  function pointercancel(event: PointerEvent) { if (event.pointerId === pointerId) cancel() }
  function keydown(event: KeyboardEvent) {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!event.repeat && pointerId === undefined && !heldKey && begin()) heldKey = event.key
  }
  function keyup(event: KeyboardEvent) {
    if (event.key !== heldKey) return
    event.preventDefault()
    release()
  }
  function visibilitychange() { if (document.hidden) cancel() }

  watch(speech.error, (value) => { if (value) cancel() }, { flush: 'sync' })
  onMounted(() => { window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', visibilitychange) })
  onBeforeUnmount(() => { cancel(); window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', visibilitychange) })

  return {
    holding, listening, finishing, error: speech.error, transcript: speech.transcript, cancel,
    events: {
      pointerdown, pointerup, pointercancel, lostpointercapture: pointercancel, keydown, keyup,
      blur: () => { if (holding.value) cancel() },
      contextmenu: (event: Event) => event.preventDefault(), click: (event: Event) => event.preventDefault(),
    },
  }
}
