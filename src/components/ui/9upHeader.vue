<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Menu, X } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

const isSidebarOpen = ref(false)
const sidebarRef = ref<HTMLElement | null>(null)
const route = useRoute()

const handleClickOutside = (event: MouseEvent) => {
  const sidebar = sidebarRef.value
  if (isSidebarOpen.value && sidebar && !sidebar.contains(event.target as Node)) {
    isSidebarOpen.value = false
  }
}

const handleEscKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    isSidebarOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleClickOutside)
  window.addEventListener('keydown', handleEscKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('keydown', handleEscKey)
})

// 메뉴 목록
const menuItems = [
  { name: '선수 검색', path: '/players' },
  { name: '라인업 생성', path: '/lineups' },
  { name: '사용 가이드', path: '/tips' },
]
</script>

<template>
  <div class="relative min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">
    <!-- 헤더 -->
    <header class="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-gray-800 shadow z-40 px-4 flex items-center justify-between">
      <button @click="isSidebarOpen = !isSidebarOpen" class="text-gray-700 dark:text-white">
        <component :is="isSidebarOpen ? X : Menu" class="w-6 h-6 transition-transform duration-300" />
      </button>
      <h1 class="text-lg font-bold">9up 프로야구 유틸리티</h1>
      <div class="w-6 h-6"></div>
    </header>

    <!-- 오버레이 배경 -->
    <transition name="fade">
      <div
          v-if="isSidebarOpen"
          class="fixed inset-0 bg-black/40 z-40 "
      ></div>
    </transition>

    <!-- 사이드바 -->
    <transition name="slide-smooth">
      <aside
          v-if="isSidebarOpen"
          ref="sidebarRef"
          class="fixed top-0 left-0 w-72 max-w-[90%] h-full bg-white dark:bg-gray-800 shadow-2xl z-50  p-5 flex flex-col"
      >
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <img src="/assets/9up_app_logo.webp" alt="logo" class="w-10 h-10 rounded-md" />
            <h2 class="text-lg font-bold text-gray-800 dark:text-white">9up 프로야구</h2>
          </div>
          <button @click="isSidebarOpen = false">
            <X class="w-5 h-5 text-gray-700 dark:text-white" />
          </button>
        </div>

        <nav class="flex flex-col gap-2">
          <router-link
              v-for="(item, index) in menuItems"
              :key="index"
              :to="item.path"
              class="px-4 py-2 rounded-lg transition-all duration-200 font-medium"
              :class="[
              route.path === item.path
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            ]"
          >
            {{ item.name }}
          </router-link>
        </nav>
      </aside>
    </transition>

    <!-- 본문 -->
    <main class="pt-14 px-4">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
/* 사이드바 슬라이드 애니메이션 */
.slide-smooth-enter-active,
.slide-smooth-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-smooth-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-smooth-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* 배경 페이드 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
