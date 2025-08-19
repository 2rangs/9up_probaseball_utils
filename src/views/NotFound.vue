<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const copied = ref(false)
const canGoBack = computed(() => typeof window !== 'undefined' && window.history.length > 1)

const goHome = () => router.push('/')
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === '/' && document.activeElement !== searchInput.value) {
    e.preventDefault()
    searchInput.value?.focus()
  } else if (e.key === 'Escape' && document.activeElement === searchInput.value) {
    (document.activeElement as HTMLElement)?.blur()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
      class="relative flex min-h-dvh items-center justify-center bg-gray-50 text-center px-4 overflow-hidden
           dark:bg-gray-950"
      aria-labelledby="page-title"
  >
    <!-- 배경 데코 -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -top-24 left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] rounded-full blur-3xl opacity-20
                  bg-gradient-to-br from-blue-300 via-indigo-300 to-purple-300
                  dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-purple-900/40"></div>
      <div
          class="absolute inset-0 opacity-[0.06] dark:opacity-[0.09] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"
      />
    </div>

    <div class="relative z-10 w-full max-w-[720px]">
      <!-- 상단 이미지 -->
      <img
          src="/assets/404.webp"
          alt="404 illustration"
          loading="lazy"
          class="mx-auto mb-6 max-h-48 w-auto select-none"
      />

      <h1 id="page-title" class="text-7xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
        404
      </h1>
      <p class="mt-3 text-4xl font-semibold text-gray-700 dark:text-gray-300">
       마! 주소 좀 신경써서 작성 안하나!!
      </p>

    </div>
  </div>
</template>

<style scoped>
/* 아이콘 유틸 클래스(i-lucide-*)는 @iconify/tailwind 또는 unocss 아이콘 프리셋을 쓰면 그대로 동작합니다.
   별도 아이콘 라이브러리를 쓰지 않는 경우, span들을 제거하시거나 lucide-vue-next로 교체하세요. */
.i-lucide-home::before      { content: ""; }
.i-lucide-arrow-left::before{ content: ""; }
.i-lucide-link::before      { content: ""; }
.i-lucide-check::before     { content: ""; }
.i-lucide-bug::before       { content: ""; }
.i-lucide-search::before    { content: ""; }
</style>
