<template>
  <div
    ref="container"
    class="character-avatar"
    :class="[`is-${state}`, { portrait }]"
    :style="{ '--facing': direction }"
    role="img"
    :aria-label="`${name || character}，${motion === 'run' ? '正在跑来' : labels[state]}`"
  ></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { RIG } from '@/lib/characterRig'
import type { CharacterId, CharacterState } from '@/data/types'

const props = withDefaults(defineProps<{
  character: CharacterId
  state?: CharacterState
  name?: string
  portrait?: boolean
  motion?: 'idle' | 'run' | 'hop'
  direction?: 1 | -1
}>(), { state: 'idle', portrait: false, motion: 'idle', direction: 1 })

const container = ref<HTMLElement>()
const id = `actor-${useId().replace(/[^a-z0-9]/gi, '')}`
const labels = { idle: '等候中', speaking: '正在发言', listening: '正在聆听', thinking: '思考中', happy: '开心', surprised: '惊讶', disagree: '有不同意见' }
const expressions = { idle: 'idle', speaking: 'pitch', listening: 'listen', thinking: 'think', happy: 'win', surprised: 'shock', disagree: 'sly' }
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
let rig: ReturnType<typeof RIG.create>
let actor: InstanceType<typeof RIG.Actor>
let raf = 0
let visible = true
let origin = 0
let expression = 'idle'
let observer: IntersectionObserver | undefined

// Expression changes blend through the original rig; running uses its arm and leg cycles.
function updateActor() {
  if (!rig) return
  origin = performance.now() / 1000
  actor = new RIG.Actor(rig, {
    seed: props.character === 'rong' ? 1 : props.character === 'hua' ? 3 : 5,
    expr: expression,
  })
  expression = expressions[props.state]
  actor.e(.01, expression)
  actor.p(.01, props.motion === 'run' ? 'run' : props.state === 'happy' ? 'cheer' : props.state === 'speaking' ? 'present' : props.state === 'disagree' ? 'hip' : 'rest')
  if (props.motion === 'run') actor.run(0, Number.POSITIVE_INFINITY, 3.4)
  if (props.motion === 'hop') actor.act(.02, 'hop', .42)
}

// Offscreen characters avoid SVG writes, and every animation frame is released on unmount.
function animate(time: number) {
  if (visible && actor) {
    const t = reducedMotion.matches ? 1 : Math.max(0, time / 1000 - origin)
    const state = actor.state(t)
    if (props.state === 'speaking') {
      state.mouth = `v${Math.floor(t * 9) % 6 + 1}`
      state.open = .3 + Math.abs(Math.sin(t * 11)) * .65
    }
    rig.render(state)
  }
  raf = requestAnimationFrame(animate)
}

watch(() => [props.state, props.motion], updateActor)
onMounted(() => {
  rig = RIG.create(container.value!, props.character, id, {
    viewBox: props.portrait ? '-175 -565 350 350' : '-210 -610 420 640',
  })
  updateActor()
  observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting })
  observer.observe(container.value!)
  raf = requestAnimationFrame(animate)
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); observer?.disconnect() })
</script>

<style lang="less" scoped>
.character-avatar {
  position: relative;
  width: 100%;
  height: 100%;

  :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    transform: scaleX(var(--facing, 1));
  }

  &.portrait {
    overflow: hidden;
    border-radius: inherit;

    :deep(svg) { overflow: hidden; }
  }
}
</style>
