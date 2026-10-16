<template>
  <div class="theater" :class="{ 'is-entering': entering }" :style="{ '--lights': lights }" data-stage-scene>
    <div class="theater-wall"></div>
    <div class="marquee">
      <i v-for="n in 12" :key="n" :style="{ left: `${(n - 1) * 9.09}%`, opacity: entering ? segment(progress, n * .018, n * .018 + .18) : 1 }"></i>
      <b>今晚有好戏</b>
    </div>
    <div class="floor"></div>
    <div v-for="restaurant in restaurants" :key="restaurant.id" class="actor-position"
      :class="[position(restaurant.id), { active: activeId === restaurant.id, paused }]"
      :style="{ '--actor-color': restaurant.color }">
      <div class="spotlight"></div>
      <div class="light-pool"></div>
      <div class="actor" :style="figureStyle(restaurant.id)">
        <CharacterAvatar :character="restaurant.character" :name="restaurant.host"
          :state="actorState(restaurant.id)" :motion="actorMotion(restaurant.id)"
          :direction="entering && position(restaurant.id) === 'side-right' ? -1 : 1" />
      </div>
      <div class="nameplate" :style="{ opacity: entering ? segment(progress, .6, .85) : 1 }">
        <span v-if="activeId === restaurant.id && !paused && !entering" class="speaking-dots"><i></i><i></i><i></i></span>
        <b>{{ restaurant.host }}</b>
      </div>
    </div>
    <StageCurtain :progress="clothProgress" />
    <div class="stage-front"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterState, Restaurant } from '@/data/types'
import { easeInOut, easeOutBack, segment } from '@/lib/entranceMotion'
import CharacterAvatar from './CharacterAvatar.vue'
import StageCurtain from './StageCurtain.vue'

const props = withDefaults(defineProps<{
  restaurants: Restaurant[]
  activeId?: string
  paused?: boolean
  listening?: boolean
  speakingState?: CharacterState
  entering?: boolean
  progress?: number
}>(), { speakingState: 'speaking', progress: 1 })
const clothProgress = computed(() => props.entering ? easeInOut(segment(props.progress, .07, .9)) : 1)
const lights = computed(() => props.entering ? segment(props.progress, .25, .8) : 1)

// The current speaker advances to the center; the others retain their stage positions.
function position(id: string) {
  if (props.activeId === id) return 'center'
  return props.restaurants.filter((r) => r.id !== props.activeId)[0]?.id === id ? 'side-left' : 'side-right'
}

function entryProgress(id: string) {
  const index = props.restaurants.findIndex((r) => r.id === id)
  return props.entering ? segment(props.progress, .2 + index * .065, .62 + index * .065) : 1
}

// Contestants run into their places behind the opening cloth and settle with a small bounce.
function figureStyle(id: string) {
  const progress = entryProgress(id)
  const eased = easeOutBack(progress)
  const side = position(id)
  const x = side === 'side-left' ? -110 : side === 'side-right' ? 110 : -35
  return {
    opacity: segment(progress, 0, .18),
    transform: `translate(${x * (1 - easeInOut(progress))}px, ${18 * (1 - eased)}px) scale(${.86 + .14 * eased})`,
  }
}

function actorMotion(id: string) {
  const progress = entryProgress(id)
  return props.entering && progress > 0 && progress < .9 ? 'run' : 'idle'
}

function actorState(id: string): CharacterState {
  if (props.entering) return entryProgress(id) > .85 ? 'happy' : 'idle'
  if (props.listening) return 'listening'
  if (props.activeId === id) return props.paused ? 'thinking' : props.speakingState
  return 'listening'
}
</script>

<style lang="less" scoped>
.theater { position: relative; height: clamp(290px, 36dvh, 370px); min-height: 290px; overflow: hidden; .theater-wall { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, #35203e 0, #35203e 23px, #3c2645 23px, #3c2645 25px); mask-image: linear-gradient(#000, #0003); }   .marquee { position: relative; display: flex; align-items: center; flex-direction: column; padding: 8px 22px 6px; border: 2px solid #ab8046; background: #28172e; border-radius: 8px; width: 168px; margin: 9px auto 0; z-index: 12; box-shadow: 0 3px 0 #130a1a; b { font-family: var(--font-display); color: #f5dfac; font-size: 21px; font-weight: 400; letter-spacing: 2px; } >span { color: #b99a6b; font-size: 6px; letter-spacing: 1.5px; margin-top: 3px; } >i { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #efd390; box-shadow: 0 0 5px #e3b04b; top: -2px; } }  .floor { position: absolute; height: 95px; bottom: 18px; left: -10%; right: -10%; background: repeating-linear-gradient(90deg, #8d6650 0, #8d6650 47px, #74523f 48px, #ac7c58 49px); transform: perspective(200px) rotateX(24deg); border-top: 2px solid #bc9065; } .actor-position { position: absolute; width: 140px; height: 207px; bottom: 49px; transform: translateX(-50%) scale(.77); transform-origin: 50% 100%; z-index: 3; transition: left .55s, transform .55s, filter .4s; filter: brightness(.72); &.center { left: 50%; transform: translateX(-50%); z-index: 4; filter: brightness(1); } &.side-left { left: 17%; } &.side-right { left: 83%; } .actor { position: relative; height: 100%; width: 100%; z-index: 2; transform-origin: 50% 95%; will-change: transform; } .spotlight { position: absolute; left: -110px; top: -40px; width: 360px; height: 290px; background: linear-gradient(#f5dfa915, #e3b04b25); clip-path: polygon(42% 0, 58% 0, 95% 100%, 5% 100%); opacity: calc(.25 * var(--lights, 1)); transition: opacity .4s; } .light-pool { position: absolute; bottom: -1px; left: -4px; width: 148px; height: 22px; border-radius: 50%; background: #edcd9044; filter: blur(4px); } &.active { .spotlight { opacity: var(--lights, 1); } .nameplate { border-color: #d7a855; box-shadow: 0 0 15px #e3b04b33; } } .nameplate { position: absolute; top: calc(100% + 1px); width: 122px; left: 9px; min-height: 28px; z-index: 3; border: 1px solid #aa8868; background: #f5e6ca; border-radius: 7px; color: #543c3e; box-shadow: 0 3px 0 #4e3340; text-align: center; padding: 5px 7px; b { font-size: 12px; display: block; } small { font-size: 8px; color: #8c7164; display: block; margin-top: 2px; } .speaking-dots { position: absolute; right: 7px; top: 8px; display: flex; align-items: center; gap: 2px; height: 10px; i { width: 2px; height: 6px; background: var(--actor-color); animation: equalize .6s infinite alternate; &:nth-child(2) { animation-delay: .2s; } &:nth-child(3) { animation-delay: .4s; } } } } } .stage-front { position: absolute; bottom: 0; height: 23px; width: 100%; background: linear-gradient(#6b453c, #362035); border-top: 3px solid #b48c5e; border-bottom: 3px solid #e3b04b22; text-align: center; z-index: 5; span { font-size: 6px; letter-spacing: 6px; color: #cba987; } } 
  &.is-entering {
    .actor-position { transition: none; }
  }
  .actor-position {
    .nameplate { transition: opacity .3s, border-color .35s, box-shadow .35s; }
    .light-pool { opacity: var(--lights, 1); }
  }
  @keyframes equalize { to { height: 2px; } }
}
</style>
