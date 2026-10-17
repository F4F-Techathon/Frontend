import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createRenderer, h, nextTick } from 'vue'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
}
const server = await createServer({
  configFile: false,
  resolve: { alias: { '@': process.cwd() + '/src' } },
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
})
after(() => server.close())

const { restaurants, evidence, defaultFilters } = await server.ssrLoadModule('/src/data/restaurants.ts')
const { matchesFilters, parseRequirements } = await server.ssrLoadModule('/src/lib/filtering.ts')
const { createDebate } = await server.ssrLoadModule('/src/data/debate.ts')
const { useDiningStore } = await server.ssrLoadModule('/src/stores/dining.ts')
const { runnerPose, curtainFolds, GATHER_DURATION } = await server.ssrLoadModule('/src/lib/entranceMotion.ts')
const { useEntranceStore } = await server.ssrLoadModule('/src/stores/entrance.ts')
const { useSpeechInput } = await server.ssrLoadModule('/src/composables/useSpeechInput.ts')

// A component lifecycle and a fake recognition service exercise event ordering without a browser.
function mountSpeech(t, options = {}, supported = true) {
  const previousWindow = globalThis.window
  const instances = [], heard = [], completed = []
  class FakeRecognition {
    constructor() { instances.push(this) }
    start() {}
    stop() { this.stopped = true }
    abort() { this.aborted = true }
    result(text, isFinal) { this.onresult?.({ results: [{ 0: { transcript: text }, isFinal }] }) }
    end() { this.onend?.() }
  }
  globalThis.window = supported ? { SpeechRecognition: FakeRecognition } : {}
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setElementText() {}, setText() {}, setComment() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  let speech
  const app = renderer.createApp({ setup() {
    speech = useSpeechInput((text) => heard.push(text), { ...options, onComplete: (text) => completed.push(text) })
    return () => h('div')
  } })
  app.mount({})
  t.after(() => { app.unmount(); if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow })
  return { speech, instances, heard, completed, app }
}

test('voice-only input waits for final words after stop before completing exactly once', (t) => {
  const { speech, instances, heard, completed } = mountSpeech(t, { continuous: false })
  speech.start()
  const recording = instances[0]
  assert.equal(recording.continuous, false)
  recording.result('两个人，人均', false)
  assert.equal(heard.at(-1), '两个人，人均')
  assert.deepEqual(completed, [])
  speech.stop()
  assert(recording.stopped)
  assert.equal(speech.listening.value, true)
  recording.result('两个人，人均200以内', true)
  assert.deepEqual(completed, [])
  recording.end()
  recording.end()
  assert.deepEqual(completed, ['两个人，人均200以内'])
  assert.equal(speech.listening.value, false)
})

test('failed, empty and interim-only recordings cannot submit stale requirements on a retry', (t) => {
  const { speech, instances, completed } = mountSpeech(t, { continuous: false })
  speech.start()
  instances[0].result('旧的需求', true)
  instances[0].onerror({ error: 'not-allowed' })
  instances[0].end()
  assert(speech.error.value.includes('麦克风'))
  speech.start()
  assert.equal(speech.error.value, '')
  assert.equal(speech.transcript.value, '')
  instances[1].end()
  assert(speech.error.value)
  speech.start()
  instances[2].result('没有确认的句子', false)
  instances[2].end()
  assert.deepEqual(completed, [])
  speech.start()
  instances[3].result('附近吃点清淡的', true)
  instances[3].end()
  assert.deepEqual(completed, ['附近吃点清淡的'])
})

test('discussion dictation stays continuous and leaving aborts without completing', (t) => {
  const { speech, instances, app, completed } = mountSpeech(t)
  speech.start()
  const recording = instances[0], lateEnd = recording.onend
  assert.equal(recording.continuous, true)
  recording.result('不吃辣', true)
  app.unmount()
  lateEnd()
  assert(recording.aborted)
  assert.equal(recording.onresult, null)
  assert.equal(recording.onerror, null)
  assert.equal(recording.onend, null)
  assert.deepEqual(completed, [])
})

test('unsupported speech recognition gives a retryable message without starting a session', (t) => {
  const { speech, instances, completed } = mountSpeech(t, {}, false)
  speech.start()
  assert(speech.error.value.includes('浏览器'))
  assert.equal(speech.listening.value, false)
  assert.deepEqual(instances, [])
  assert.deepEqual(completed, [])
})

test('entrance runners remain anchored and gather correctly across phone and tablet sizes', () => {
  for (const width of [320, 390, 768, 1024, 1366]) {
    const target = { x: width / 2, y: 400 }
    const size = Math.min(1.4, Math.max(1, width / 480))
    for (const count of [2, 3]) {
      for (let index = 0; index < count; index++) {
        const start = { x: width * (index + 1) / (count + 1), y: 180 + index * 75 }
        assert.equal(runnerPose(0, index, count, start, target, size).opacity, 0)
        const beforeRunning = runnerPose(1150, index, count, start, target, size)
        assert.equal(beforeRunning.x, start.x)
        assert.equal(beforeRunning.y, start.y)
        const arrived = runnerPose(3300, index, count, start, target, size)
        assert(Math.abs(arrived.x - target.x) <= 53 * size)
        assert(Math.abs(arrived.y - target.y) <= 38 * size)
        assert.equal(runnerPose(GATHER_DURATION, index, count, start, target, size).opacity, 0)
        for (let time = 0; time <= GATHER_DURATION; time += 25) {
          const pose = runnerPose(time, index, count, start, target, size)
          assert([pose.x, pose.y, pose.scale, pose.opacity].every(Number.isFinite))
          assert(pose.scale >= -1e-8)
        }
      }
    }
  }
})

test('cloth covers the center when closed and compresses to the wings on phone and tablet widths', () => {
  const widths = [88, 124, 70, 106, 136, 80, 112, 62, 98, 130, 69]
  for (const width of [320, 375, 390, 430, 480, 768, 834, 1024, 1194, 1366]) {
    const closed = curtainFolds(widths, 0, width / 2, 1)
    const closedEdge = closed.at(-1).x + closed.at(-1).width
    assert(closedEdge > width / 2)
    const open = curtainFolds(widths, 1, width / 2, 1)
    assert(open.at(-1).x + open.at(-1).width * open.at(-1).sx < width * .17)
    assert(open.every((fold) => fold.sx > 0 && fold.sy > 0))
  }
})

test('the visual sequence rejects duplicate starts and can be canceled and replayed', () => {
  setActivePinia(createPinia())
  const entrance = useEntranceStore()
  const scene = { actors: restaurants.slice(0, 3), mapAvailable: true, anchors: () => ({ starts: [], target: { x: 195, y: 400 } }), focusTarget() {} }
  assert(entrance.begin(scene))
  assert.equal(entrance.begin(scene), false)
  entrance.cover()
  assert.equal(entrance.phase, 'covered')
  entrance.reveal()
  assert.equal(entrance.stageProgress, 0)
  entrance.elapsed = 1900
  assert.equal(entrance.stageProgress, 1)
  entrance.finish()
  assert.equal(entrance.active, false)
  assert.equal(entrance.stageProgress, 1)
  assert(entrance.begin(scene))
  entrance.finish()
})

test('hard requirements exclude missing facts while soft preferences keep alternatives', () => {
  const filters = defaultFilters()
  assert.equal(matchesFilters(restaurants.find((r) => r.price === null), { ...filters, maxBudget: 200 }), false)
  assert.equal(matchesFilters(restaurants[0], { ...filters, quiet: true }), true)
  assert.equal(matchesFilters(restaurants[0], { ...filters, noSpice: true }), false)
  assert.equal(matchesFilters(restaurants.find((r) => r.allergens === null), { ...filters, allergy: '花生' }), false)
  const parsed = parseRequirements('两个人约会，人均200以内，想安静一点', filters)
  assert.equal(parsed.people, 2)
  assert.equal(parsed.maxBudget, 200)
  assert.equal(parsed.scene, '约会')
  assert.equal(parsed.quiet, true)
})

test('two- and three-contestant discussions have complete, correctly associated evidence', () => {
  for (const count of [2, 3]) {
    const messages = createDebate(restaurants.slice(0, count), defaultFilters())
    assert.equal(messages.length, count * 3)
    for (const message of messages) {
      assert(message.evidenceIds.length)
      for (const id of message.evidenceIds) assert(evidence.some((e) => e.id === id && e.restaurantId === message.restaurantId))
    }
  }
  assert(evidence.filter((e) => e.kind === 'review').every((e) => e.mock))
})

test('interventions preserve history and recommendations obey the latest hard requirements', async () => {
  storage.clear()
  setActivePinia(createPinia())
  const store = useDiningStore()
  store.understand('两个人约会，人均200以内')
  store.prepareSelection()
  assert.equal(store.selected.length, 3)
  store.startDebate()
  store.recordCurrent()
  const previousStatement = store.history[0].text
  store.intervene('我不能吃辣，人均不能超过150')
  assert.equal(store.history[0].text, previousStatement)
  assert.equal(store.filters.maxBudget, 150)
  assert.equal(store.filters.noSpice, true)
  const winner = store.decide()
  assert(winner)
  assert(matchesFilters(winner, store.filters))
  store.filters.maxBudget = 1
  assert.equal(store.decide(), undefined)
  assert.equal(store.winner, undefined)
  await nextTick()
  setActivePinia(createPinia())
  const restored = useDiningStore()
  assert.equal(restored.filters.maxBudget, 1)
  assert(restored.history.some((entry) => entry.user))
})
