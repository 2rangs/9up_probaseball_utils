<script setup lang="ts">
const props = defineProps<{
  show: boolean
  player: Record<string, any> | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const close = () => emit('update:show', false)

function onBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('backdrop')) {
    close()
  }
}
</script>

<template>
  <!-- Backdrop (페이드 인/아웃만) -->
  <transition name="fade">
    <div
        v-if="show"
        class="backdrop fixed inset-0 z-50 h-screen bg-black/30"
        @click="onBackdropClick"
    >
      <!-- Modal (슬라이드 인/아웃만) -->
      <transition name="slide">
        <div
            class="absolute top-0 right-0 w-[750px] h-screen bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl overflow-y-auto"
            @click.stop
        >
          <div class="p-6 relative h-full">
            <button
                class="absolute top-4 right-4 text-gray-500 hover:text-black dark:hover:text-white"
                @click="close"
            >✕</button>

            <!-- 👉 슬롯에 player 전달 -->
            <slot :player="player" />
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-to, .fade-leave-from {
  opacity: 1;
}

.slide-enter-from {
  transform: translateX(100%);
}
.slide-leave-to {
  transform: translateX(100%);
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter-to,
.slide-leave-from {
  transform: translateX(0%);
}
</style>
