<script setup lang="ts">
import { defineProps, defineEmits, computed, watch } from 'vue'
import { Star } from 'lucide-vue-next'
import type { PropType } from 'vue'

const props = defineProps({
  allFields: Array as () => string[],
  selectFields: Array as () => string[],
  rarityField: String,
  filterOptions: Object as PropType<Record<string, string[]>>,
  filters: Object as PropType<Record<string, any>>
})

const emit = defineEmits(['update:filters'])

// 기본값을 filterOptions 전체 선택으로 설정
watch(
    () => props.filterOptions,
    (options) => {
      ['team', 'grade'].forEach((key) => {
        if (Array.isArray(options[key]) && (!Array.isArray(props.filters[key]) || props.filters[key].length === 0)) {
          emit('update:filters', {
            ...props.filters,
            [key]: [...options[key]]
          })
        }
      })
    },
    { immediate: true, deep: true }
)

const isSelected = (field: string, value: string) => {
  return Array.isArray(props.filters[field]) && props.filters[field].includes(value)
}

const toggleFilter = (field: string, value: string) => {
  const selected = Array.isArray(props.filters[field])
      ? [...props.filters[field]]
      : []

  const index = selected.indexOf(value)
  if (index !== -1) {
    selected.splice(index, 1)
  } else {
    selected.push(value)
  }
  emit('update:filters', { ...props.filters, [field]: selected })
}



const update = (field: string, value: any) => {
  emit('update:filters', { ...props.filters, [field]: value })
}

const actualPositions = computed(() => {
  return props.filterOptions?.position ?? []
})

const gradeLabels: Record<string, string> = {
  DGN: '디그니티',
  TOP: '탑클래스',
  ACE: '에이스 피쳐',
  HIT: '히트 배터',
  POS: '포스트시즌',
  GG: '골든글러브',
  TEA: '팀',
  SEA: '시즌',
  ROY: '루키 오브더 예어',
  MMVP: '이달의 MVP',
  ASG: '올스타'
}

const teamLogos: Record<string, string> = {
  kia: '/assets/logos/symbol/emblem_s_01_kia.png',
  haitai: '/assets/logos/symbol/emblem_s_01_haitai.png',
  samsung: '/assets/logos/symbol/emblem_s_02_samsung.png',
  lotte: '/assets/logos/symbol/emblem_s_03_lotte.png',
  kiwoom: '/assets/logos/symbol/emblem_s_04_kiwoom.png',
  nexen: '/assets/logos/symbol/emblem_s_04_nexen.png',
  binggrae: '/assets/logos/symbol/emblem_s_05_bingrae.png',
  hanwha: '/assets/logos/symbol/emblem_s_05_hanwha.png',
  lg: '/assets/logos/symbol/emblem_s_06_lg.png',
  mbc: '/assets/logos/symbol/emblem_s_06_mbc.png',
  doosan: '/assets/logos/symbol/emblem_s_07_doosan.png',
  ob: '/assets/logos/symbol/emblem_s_07_ob.png',
  sk: '/assets/logos/symbol/emblem_s_08_sk.png',
  ssg: '/assets/logos/symbol/emblem_s_08_ssg.png',
  nc: '/assets/logos/symbol/emblem_s_09_nc.png',
  kt: '/assets/logos/symbol/emblem_s_10_kt.png',
  sbw: '/assets/logos/symbol/emblem_s_11_sbw.png',
  hyundai: '/assets/logos/symbol/emblem_s_12_hyundai.png',
  pacific: '/assets/logos/symbol/emblem_s_13_pacific.png',
  sammi: '/assets/logos/symbol/emblem_s_14_sammi.png',
  chungbo: '/assets/logos/symbol/emblem_s_15_chungbo.png',
  dream: '/assets/logos/symbol/emblem_s_99_dream.png',
  nanum: '/assets/logos/symbol/emblem_s_99_nanum.png'
}
</script>

<template>
  <div class="bg-white/80 dark:bg-gray-900/80 rounded-lg p-3 shadow-md border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-2">
      <div class="w-4 h-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
        <svg class="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
        </svg>
      </div>
      <h2 class="text-sm font-bold text-gray-900 dark:text-white">필터</h2>
    </div>

    <!-- First Row: Special Filters -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <!-- Rarity -->
      <div class="space-y-1">
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {{ rarityField }}
        </label>
        <div class="bg-white dark:bg-gray-800 rounded-md p-1.5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="flex gap-0.5 items-center justify-center">
            <button
                v-for="i in 6"
                :key="i"
                @click="update(rarityField, i === props.filters[rarityField] ? '' : i)"
                class="p-0.5 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors cursor-pointer"
            >
              <Star
                  :class="i <= props.filters[rarityField] ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'"
                  class="w-3 h-3 transition-colors"
                  fill="currentColor"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Grade -->
      <div class="space-y-1">
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          grade
        </label>
        <div class="bg-white dark:bg-gray-800 rounded-md p-1.5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="flex flex-wrap gap-0.5">
            <button
                v-for="grade in props.filterOptions.grade"
                :key="grade"
                @click="toggleFilter('grade', grade)"
                :class="[
                  'px-1.5 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer',
                  isSelected('grade', grade)
                    ? 'bg-yellow-400 text-black shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                ]"
            >
              {{ gradeLabels[grade] || grade }}
            </button>
          </div>
        </div>
      </div>

      <!-- Team -->
      <div class="space-y-1">
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          team
        </label>
        <div class="bg-white dark:bg-gray-800 rounded-md p-1.5 shadow-sm border border-gray-100 dark:border-gray-700">
          <div class="grid grid-cols-6 gap-0.5">
            <button
                v-for="team in props.filterOptions.team"
                :key="team"
                @click="toggleFilter('team', team)"
                :class="[
                  'relative p-1 rounded transition-colors cursor-pointer',
                  isSelected('team', team)
                    ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400'
                    : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                ]"
            >
              <img
                  :src="teamLogos[team]"
                  :alt="team"
                  class="w-4 h-4 object-contain mx-auto"
              />
              <div
                  v-if="isSelected('team', team)"
                  class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full"
              >
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Second Row: Baseball Field Position Layout -->
    <div class="mb-4">
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        position
      </label>
      <div class="bg-gradient-to-b from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 shadow-sm border border-green-200 dark:border-green-700">
        <!-- Baseball Field Layout -->
        <div class="relative w-full h-32">
          <!-- Outfield -->
          <div class="absolute top-2 left-1/2 transform -translate-x-1/2">
            <button
                v-if="actualPositions.includes('CF')"
                @click="toggleFilter('position', 'CF')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', 'CF')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              CF
            </button>
          </div>
          <div class="absolute top-4 left-8">
            <button
                v-if="actualPositions.includes('LF')"
                @click="toggleFilter('position', 'LF')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', 'LF')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              LF
            </button>
          </div>
          <div class="absolute top-4 right-8">
            <button
                v-if="actualPositions.includes('RF')"
                @click="toggleFilter('position', 'RF')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', 'RF')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              RF
            </button>
          </div>

          <!-- Infield -->
          <div class="absolute top-12 left-4">
            <button
                v-if="actualPositions.includes('3B')"
                @click="toggleFilter('position', '3B')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', '3B')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              3B
            </button>
          </div>
          <div class="absolute top-14 left-1/3 transform -translate-x-1/2">
            <button
                v-if="actualPositions.includes('SS')"
                @click="toggleFilter('position', 'SS')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', 'SS')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              SS
            </button>
          </div>
          <div class="absolute top-14 right-1/3 transform translate-x-1/2">
            <button
                v-if="actualPositions.includes('2B')"
                @click="toggleFilter('position', '2B')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', '2B')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              2B
            </button>
          </div>
          <div class="absolute top-12 right-4">
            <button
                v-if="actualPositions.includes('1B')"
                @click="toggleFilter('position', '1B')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', '1B')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              1B
            </button>
          </div>

          <!-- Battery -->
          <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2">
            <button
                v-if="actualPositions.includes('P')"
                @click="toggleFilter('position', 'P')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', 'P')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              P
            </button>
          </div>
          <div class="absolute bottom-2 left-1/2 transform -translate-x-1/2">
            <button
                v-if="actualPositions.includes('C')"
                @click="toggleFilter('position', 'C')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', 'C')
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              C
            </button>
          </div>

          <!-- DH (Designated Hitter) - 별도 위치 -->
          <div class="absolute top-16 right-2">
            <button
                v-if="actualPositions.includes('DH')"
                @click="toggleFilter('position', 'DH')"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', 'DH')
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-purple-100 shadow-md'
                ]"
            >
              DH
            </button>
          </div>

          <!-- Additional positions if any -->
          <div class="absolute bottom-2 left-4 flex gap-1">
            <button
                v-for="pos in actualPositions.filter(p => !['C', 'P', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].includes(p))"
                :key="pos"
                @click="toggleFilter('position', pos)"
                :class="[
                  'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                  isSelected('position', pos)
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/80 text-gray-700 hover:bg-emerald-100 shadow-md'
                ]"
            >
              {{ pos }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Third Row: Combined Input and Select Fields -->
    <div class="mb-4">
      <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
        </svg>
        상세 필터
      </h3>

      <!-- Input Fields -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <template v-for="field in ['name', 'year', 'skill', 'synergy']" :key="field">
          <div class="space-y-1">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">
              {{ field }}
            </label>
            <div class="relative">
              <input
                  type="text"
                  :value="props.filters[field]"
                  @input="update(field, $event.target.value)"
                  :placeholder="`${field} 검색...`"
                  class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 pr-8 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm hover:shadow-md transition-all duration-200 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Select Fields -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <template v-for="field in selectFields.filter(f => f !== 'grade')" :key="field">
          <div class="space-y-1">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">
              {{ field }}
            </label>
            <div class="relative">
              <select
                  :value="props.filters[field]"
                  @change="update(field, $event.target.value)"
                  class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 pr-8 text-sm text-gray-900 dark:text-gray-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="">전체</option>
                <option
                    v-for="option in props.filterOptions[field]"
                    :key="option"
                    :value="option"
                >
                  {{ option }}
                </option>
              </select>
              <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Filter Actions -->
    <div class="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700">
      <div class="text-xs text-gray-500 dark:text-gray-400">
        필터가 적용된 항목들을 확인하세요
      </div>
      <button
          @click="clearAllFilters"
          class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium cursor-pointer flex items-center gap-1"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
        전체 초기화
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for select elements */
select::-webkit-scrollbar {
  width: 6px;
}

select::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

select::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

select::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Ensure all interactive elements have cursor pointer */
button, select {
  cursor: pointer;
}

input[type="text"] {
  cursor: text;
}

input[type="text"]:focus {
  cursor: text;
}

/* Custom focus styles */
input:focus, select:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Enhanced hover effects */
input:hover {
  border-color: #9ca3af;
}

select:hover {
  border-color: #9ca3af;
}

/* Section dividers */
.space-y-1 > label {
  transition: color 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>