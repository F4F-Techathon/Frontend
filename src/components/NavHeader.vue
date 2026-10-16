<template>
  <header class="nav-header" :class="{ dark }"><button class="icon-btn back" aria-label="返回上一页" @click="$emit('back')"><AppIcon name="back" /></button><div class="heading"><h1>{{ title }}</h1></div><slot><span v-if="step" class="step-dots"><i v-for="n in 5" :key="n" :class="{ active: n <= step }"></i></span></slot></header>
</template>
<script setup lang="ts">import AppIcon from './AppIcon.vue'; defineProps<{ title: string; step?: number; dark?: boolean }>(); defineEmits<{ back: [] }>()</script>
<style lang="less" scoped>
.nav-header { min-height: 66px; display: flex; align-items: center; gap: 12px; padding: calc(12px + env(safe-area-inset-top)) 20px 12px; .back { background: #fffbf4; border: 1px solid var(--line); width: 40px; height: 40px; } .heading { flex: 1; min-width: 0;  h1 { margin: 0; font-size: 17px; font-weight: 750; letter-spacing: .3px; } } .step-dots { display: flex; gap: 4px; i { width: 5px; height: 5px; background: #ded4c6; border-radius: 50%; &.active { background: var(--red); } } } &.dark { color: var(--cream); .back { color: var(--cream); border-color: #604868; background: #ffffff08; } .heading .eyebrow { color: #bdabbf; } } }
</style>
