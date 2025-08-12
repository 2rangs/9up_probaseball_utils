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
  <!-- Backdrop -->
  <transition name="fade">
    <div
        v-if="show"
        class="backdrop fixed inset-0 z-[1000] h-screen bg-black/40 backdrop-blur-[1px]"
        @click="onBackdropClick"
    >
      <!-- Panel -->
      <transition name="slide">
        <div
            class="absolute md:top-0 md:right-0 md:left-auto md:bottom-auto
                 left-0 right-0 bottom-0 md:bottom-auto
                 h-[85vh] md:h-screen
                 w-full md:w-[750px]
                 rounded-t-2xl md:rounded-none
                 bg-white dark:bg-gray-900
                 border-t md:border-t-0 md:border-l
                 border-gray-200 dark:border-gray-700
                 shadow-2xl overflow-y-auto"
            @click.stop
        >
          <!-- Header (sticky) -->
          <div class="sticky top-0 z-10 flex items-center h-10 justify-end md:px-6 md:py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
            <!-- 모바일 그립바 -->
            <div class="absolute left-1/2 -translate-x-1/2 -top-2 md:hidden">
              <span class="block w-12 rounded-full bg-gray-300 dark:bg-gray-700"></span>
            </div>
            <button
                class="inline-flex items-center justify-center rounded-full w-9 h-9 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="close"
                aria-label="닫기"
            >✕</button>
          </div>

          <!-- Content -->
          <div class="p-4 md:p-6">
            <!-- 👉 슬롯에 player 전달 -->
            <slot :player="player" />
            <!-- iOS safe-area -->
            <div class="pb-[max(env(safe-area-inset-bottom),0px)]"></div>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
/* Backdrop fade */
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-to, .fade-leave-from { opacity: 1; }

/* Panel slide
   - 기본(모바일): 아래에서 위로
   - md 이상: 오른쪽에서 왼쪽으로
*/
.slide-enter-active, .slide-leave-active {
  transition: transform .28s cubic-bezier(.22,.61,.36,1), opacity .28s ease;
}
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
.slide-enter-to, .slide-leave-from {
  opacity: 1;
  transform: translateY(0%);
}
@media (min-width: 768px) {
  .slide-enter-from, .slide-leave-to {
    transform: translateX(100%);
  }
  .slide-enter-to, .slide-leave-from {
    transform: translateX(0%);
  }
}
</style>
