import { onBeforeUnmount, ref } from 'vue'

interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface Recognition { lang: string; interimResults: boolean; continuous: boolean; onstart: (() => void) | null; onresult: ((e: { results: ArrayLike<SpeechResult> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void }
interface SpeechOptions { continuous?: boolean; onComplete?: (text: string) => void }

// Live words are for display; completion is delivered only after final results and the end event.
export function useSpeechInput(onText: (text: string) => void, options: SpeechOptions = {}) {
  const listening = ref(false), error = ref(''), transcript = ref('')
  let recognition: Recognition | undefined
  let stopping = false
  const speechWindow = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const ctor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

  // Wait for onend: releasing the button can still be followed by final recognition results.
  function stop() {
    if (!recognition || stopping) return
    stopping = true
    try { recognition.stop() }
    catch { cancel(); error.value = '语音暂时没连上，再长按试试。' }
  }

  // Disconnect before aborting so leaving the page never submits a canceled recording.
  function cancel() {
    const current = recognition
    recognition = undefined
    listening.value = false
    if (!current) return
    current.onstart = null; current.onresult = null; current.onerror = null; current.onend = null
    current.abort()
  }

  // Each recording owns its final transcript, preventing a retry from reusing earlier words.
  function start() {
    if (listening.value) return
    cancel()
    stopping = false
    error.value = ''; transcript.value = ''
    if (!ctor) { error.value = '当前浏览器暂不支持语音，请换个支持语音的浏览器。'; return }
    const current = new ctor()
    let finalText = ''
    recognition = current
    current.lang = 'zh-CN'; current.interimResults = true; current.continuous = options.continuous ?? true
    // A permission prompt may delay startup until after the user has already released.
    current.onstart = () => {
      if (recognition !== current || !stopping) return
      try { current.stop() }
      catch { cancel(); error.value = '语音暂时没连上，再长按试试。' }
    }
    current.onresult = (event) => {
      if (recognition !== current) return
      const results = Array.from(event.results)
      transcript.value = results.map((result) => result[0].transcript).join('')
      finalText = results.filter((result) => result.isFinal).map((result) => result[0].transcript).join('').trim()
      onText(transcript.value)
    }
    current.onerror = (event) => {
      if (recognition !== current) return
      error.value = event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? '请允许使用麦克风，再长按试试。'
        : event.error === 'audio-capture' ? '没连上麦克风，检查后再试试。'
          : event.error === 'no-speech' ? '没听清，再说一次吧。' : '语音连接断开了，再试一次吧。'
      listening.value = false
    }
    current.onend = () => {
      if (recognition !== current) return
      recognition = undefined
      listening.value = false
      if (error.value) return
      if (!finalText) { error.value = '没听清，再说一次吧。'; return }
      options.onComplete?.(finalText)
    }
    try { current.start(); listening.value = true }
    catch { cancel(); error.value = '语音暂时没连上，再长按试试。' }
  }

  onBeforeUnmount(cancel)
  return { listening, error, transcript, start, stop, cancel }
}
