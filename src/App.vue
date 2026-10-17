<template>
  <main class="app-shell">
    <div v-if="offline" class="network-notice"><AppIcon name="wifi" :size="15" />网络已断开，已保存的选餐仍可继续</div>
    <RouterView v-slot="{ Component }">
      <Transition name="page" :css="!entrance.active">
        <component :is="Component" :key="route.path" :inert="entrance.active || undefined" />
      </Transition>
    </RouterView>
    <OpeningSequence v-if="entrance.active" @covered="enterTheater" />
    <Transition name="toast"><div v-if="store.toast" class="toast-message" role="status">{{ store.toast }}</div></Transition>
  </main>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDiningStore } from '@/stores/dining'
import { useEntranceStore } from '@/stores/entrance'
import AppIcon from '@/components/AppIcon.vue'
import OpeningSequence from '@/components/OpeningSequence.vue'
const store = useDiningStore(), offline = ref(!navigator.onLine)
const entrance = useEntranceStore(), router = useRouter(), route = useRoute()

// The page changes only under an opaque cover; the mounted stage then owns the reveal.
async function enterTheater() {
  const scene = entrance.scene
  store.startDebate()
  try {
    await router.push('/debate')
    await nextTick()
    if (entrance.scene !== scene) return
    if (route.path === '/debate') entrance.reveal()
    else entrance.finish()
  } catch {
    entrance.finish()
    store.notify('开场没有加载成功，点一下可以重试')
  }
}

// Browser back or an unrelated route cancels the visual sequence immediately.
watch(() => route.path, (path) => {
  if (entrance.active && path !== '/map' && !(path === '/debate' && entrance.phase !== 'map')) entrance.finish()
})
function updateNetwork() { offline.value = !navigator.onLine }
window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork)
onBeforeUnmount(() => { window.removeEventListener('online', updateNetwork); window.removeEventListener('offline', updateNetwork) })
</script>
<style lang="less" scoped>
.app-shell { position: relative; margin: 0 auto; width: 100%; max-width: var(--app-max-width); min-width: 0; min-height: 100dvh; background: var(--cream); box-shadow: 0 0 100px #3a283a15; .network-notice { position: sticky; top: 0; z-index: 99; display: flex; justify-content: center; gap: 6px; background: #f2ddbb; padding: 9px 10px; font-size: 11px; } .toast-message { position: fixed; bottom: calc(105px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); width: max-content; max-width: min(calc(100vw - 40px), 560px); background: #2b1b30ed; color: var(--paper); font-size: 12px; line-height: 1.6; padding: 12px 18px; border-radius: 14px; box-shadow: 0 5px 25px #120a1730; z-index: 200; text-align: center; } .toast-enter-active, .toast-leave-active { transition: opacity .2s; } .toast-enter-from, .toast-leave-to { opacity: 0; } }
</style>
