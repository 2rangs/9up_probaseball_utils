<script setup lang="ts">
import { defineProps, defineEmits, computed, watch } from 'vue'
import { Star } from 'lucide-vue-next'
import type { PropType } from 'vue'

const props = defineProps({
  allFields: Array as () => string[],
  selectFields: Array as () => string[],
  rarityField: String,
  filterOptions: Object as PropType<Record<string, string[]>>,
  fieldLabels:  Object as PropType<Record<string, string>>,
  filters: Object as PropType<Record<string, any>>
})

const emit = defineEmits(['update:filters'])

// 연도 범위 생성 (1982년부터 현재 연도까지)
const currentYear = new Date().getFullYear()
const yearOptions = computed(() => {
  const years = []
  for (let year = currentYear; year >= 1982; year--) {
    years.push(year.toString())
  }
  return years
})

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
  console.log( { ...props.filters, [field]: selected })
  emit('update:filters', { ...props.filters, [field]: selected })
}

const update = (field: string, value: any) => {
  emit('update:filters', { ...props.filters, [field]: value })
}

const clearAllFilters = () => {
  const clearedFilters = {}
  Object.keys(props.filters).forEach(key => {
    if (Array.isArray(props.filters[key])) {
      clearedFilters[key] = []
    } else {
      clearedFilters[key] = ''
    }
  })
  emit('update:filters', clearedFilters)
}

const actualPositions = computed(() => {
  return props.filterOptions?.position ?? []
})

const gradeLabels: Record<string, string> = {
  DGN: 'Dignity',
  TOP: 'Top Class',
  ACE: 'Ace Pitcher',
  HIT: 'Hit Batter',
  POS: 'Post season',
  GG: 'Golden Glove',
  TEA: 'Team Player',
  SEA: 'Season',
  ROY: 'Rookie Of The Year',
  MMVP: 'Monthly MVP',
  ASG: 'ALLSTAR'
}
const gradeOrder = [
  'DGN',
  'TOP',
  'ACE',
  'HIT',
  'POS',
  'GG',
  'TEA',
  'SEA',
  'ROY',
  'MMVP',
  'ASG'
]
const visibleGrades = computed(() => {
  return gradeOrder.filter(g => props.filterOptions.grade?.includes(g))
})

function getSpecialFieldLabel(field: string, code: string): string {
  const handednessMap = { L: '좌', R: '우', S: '양' }
  const pitchingMap = { O: '오버핸드', S: '사이드암', U: '언더핸드' }

  const upperCode = code.toUpperCase()

  if (['battingHand', 'throwHand'].includes(field)) {
    return handednessMap[upperCode] || code
  }

  if (field === 'pitchingType') {
    return pitchingMap[upperCode] || code
  }

  return code
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
  <div class="max-w-[1280px] m-auto">
    <div class="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
      <!-- 검색 필드 (우측 정렬되게 col-start 자동으로 맞춰짐) -->
      <div class="sm:col-start-3">
        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">      {{`${fieldLabels['name']} 또는 ${fieldLabels['synergy']}`}}</label>
        <div class="relative">
          <input
              type="text"
              :value="props.filters.search || ''"
              @input="update('search', $event.target.value)"
              placeholder="이름 또는 시너지 검색..."
              class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm hover:shadow-md transition focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <div class="p-4 bg-white/80 dark:bg-gray-800/50 space-y-4">
        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {{fieldLabels['grade']}} / {{fieldLabels['rarity']}}
        </label>

        <!-- Rarity (별점) -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div class="text-xs font-medium text-gray-600 dark:text-gray-300 sm:w-20">     {{fieldLabels['rarity']}}</div>
          <div class="flex gap-1 sm:flex-1 sm:justify-start">
            <button
                v-for="i in 6"
                :key="i"
                @click="update(rarityField, i === props.filters[rarityField] ? '' : i)"
                class="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
            >
              <Star
                  :class="i <= props.filters[rarityField] ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'"
                  class="w-5 h-5"
                  fill="currentColor"
              />
            </button>
          </div>
        </div>

        <!-- Grade (등급 버튼) -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div class="text-xs font-medium text-gray-600 dark:text-gray-300 sm:w-20">     {{fieldLabels['grade']}}</div>
          <div class="flex flex-wrap gap-1 sm:flex-1 sm:justify-start">
            <button
                v-for="grade in visibleGrades"
                :key="grade"
                @click="toggleFilter('grade', grade)"
                :class="[
          'px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
          isSelected('grade', grade)
            ? 'bg-blue-500 text-white'
            : 'bg-gray-400 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        ]"
            >
              {{ gradeLabels[grade] || grade }}
            </button>
          </div>
        </div>
      </div>


  <!-- 포지션 야구장 UI -->
  <div class="rounded-lg ">
    <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
      {{fieldLabels['position']}}
    </label>
    <div class="grid-col-3 rounded-lg p-4">
        <!-- Baseball Field Layout -->
        <div class="relative w-full h-40 mx-auto">
          <!-- Outfield -->
          <div class="absolute top-[8%] left-1/2 transform -translate-x-1/2">
            <button v-if="actualPositions.includes('CF')" @click="toggleFilter('position', 'CF')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'CF')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">CF</button>
          </div>
          <div class="absolute top-[8%] left-[15%]">
            <button v-if="actualPositions.includes('LF')" @click="toggleFilter('position', 'LF')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'LF')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">LF</button>
          </div>
          <div class="absolute top-[8%] right-[15%]">
            <button v-if="actualPositions.includes('RF')" @click="toggleFilter('position', 'RF')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'RF')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">RF</button>
          </div>

          <!-- Infield -->
          <div class="absolute top-[50%] left-[8%]">
            <button v-if="actualPositions.includes('B3')" @click="toggleFilter('position', 'B3')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'B3')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">3B</button>
          </div>
          <div class="absolute top-[50%] right-[8%]">
            <button v-if="actualPositions.includes('B1')" @click="toggleFilter('position', 'B1')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'B1')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">1B</button>
          </div>
          <div class="absolute top-[40%] left-[34%]">
            <button v-if="actualPositions.includes('SS')" @click="toggleFilter('position', 'SS')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'SS')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">SS</button>
          </div>

          <div class="absolute top-[40%] right-[34%]">
            <button v-if="actualPositions.includes('B2')" @click="toggleFilter('position', 'B2')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'B2')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">2B</button>
          </div>

          <div class="absolute top-[40%] left-[34%]">
            <button v-if="actualPositions.includes('SP')" @click="toggleFilter('position', 'SP')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'SP')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">SP</button>
          </div>

          <div class="absolute top-[40%] right-[34%]">
            <button v-if="actualPositions.includes('RP')" @click="toggleFilter('position', 'RP')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'RP')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">RP</button>
          </div>

          <!-- Catcher & DH -->
          <div class="absolute bottom-[8%] left-[45%]">
            <button v-if="actualPositions.includes('C')" @click="toggleFilter('position', 'C')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'C')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">C</button>
          </div>
          <div class="absolute bottom-[8%] right-[20%]">
            <button v-if="actualPositions.includes('DH')" @click="toggleFilter('position', 'DH')"
              :class="[
                'px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer',
                isSelected('position', 'DH')
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]">DH</button>
          </div>
        </div>
      </div>

    <div class="grid grid-flow-col  gap-4 overflow-x-auto">
      <div
          v-for="field in selectFields.filter(f => !['grade', 'position', 'skill','search', 'enhancedSkill', 'year'].includes(f))"
          :key="field"
          class="flex flex-col items-center space-y-1"
      >
        <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize text-center">
          {{ fieldLabels[field] }}
        </label>
        <div class="flex gap-1 flex-wrap justify-center">
          <button
              v-for="option in props.filterOptions[field]"
              :key="option"
              @click="() => update(field, props.filters[field] === option ? null : option)"
              :class="[
          'px-2 py-1 rounded text-xs font-medium transition border',
          props.filters[field] === option
            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
        ]"
          >
            {{ getSpecialFieldLabel(field, option) }}
          </button>
        </div>
      </div>
    </div>



  </div>


  <!-- 팀 선택 -->
  <div>
    <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
      {{fieldLabels['team']}}
    </label>
    <div class="grid grid-cols-5 gap-1">
      <button
        v-for="team in props.filterOptions.team"
        :key="team"
        @click="toggleFilter('team', team)"
        :class="[
          'relative p-1 rounded transition-colors cursor-pointer',
          isSelected('team', team)
            ? 'bg-gray-50 dark:bg-blue-900/30 ring-1 ring-blue-400'
            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
        ]"
      >
        <img
          :src="teamLogos[team]"
          :alt="team"
          class="w-8 h-8 object-contain mx-auto"
        />
      </button>
    </div>
  </div>
</div>


<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <!-- 연도 필터 -->
  <div class="bg-white dark:bg-gray-900 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700 flex flex-col">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">{{fieldLabels['year']}}</h3>
    <div class="flex-1 overflow-y-auto max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="year in yearOptions"
          :key="year"
          @click="toggleFilter('year', year)"
          :class="[
            'px-2 py-1 rounded text-xs font-medium transition border',
            isSelected('year', year)
             ? 'bg-blue-500 text-white border-blue-500 shadow'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          ]"
        >
          {{ year }}
        </button>
      </div>
    </div>
    <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
      선택된 {{fieldLabels['year']}}: {{ Array.isArray(props.filters.year) ? props.filters.year.length : 0 }}개
    </div>
  </div>

  <!-- 스킬 필터 -->
  <div class="bg-white dark:bg-gray-900 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700 flex flex-col">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ fieldLabels['skill'] }}</h3>
    <div class="flex-1 overflow-y-auto max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        <button
          v-for="skill in props.filterOptions.skill"
          :key="skill"
          @click="toggleFilter('skill', skill)"
          :class="[
            'px-2 py-1 rounded text-xs font-medium transition border',
            isSelected('skill', skill)
        ? 'bg-blue-500 text-white border-blue-500 shadow'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          ]"
        >
          {{ skill }}
        </button>
      </div>
    </div>
    <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
      선택된 {{ fieldLabels['skill'] }}: {{ Array.isArray(props.filters.skill) ? props.filters.skill.length : 0 }}개
    </div>
  </div>

  <!-- 강화 스킬 필터 -->
  <div class="bg-white dark:bg-gray-900 rounded-lg p-4 shadow border border-gray-200 dark:border-gray-700 flex flex-col">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{fieldLabels['enhancedSkill']}}</h3>
    <div class="flex-1 overflow-y-auto max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        <button
          v-for="skill in props.filterOptions.enhancedSkill"
          :key="skill"
          @click="toggleFilter('enhancedSkill', skill)"
          :class="[
            'px-2 py-1 rounded text-xs font-medium transition border',
            isSelected('enhancedSkill', skill)
           ? 'bg-blue-500 text-white border-blue-500 shadow'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          ]"
        >
          {{ skill }}
        </button>
      </div>
    </div>
    <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
      선택된 {{fieldLabels['enhancedSkill']}}: {{ Array.isArray(props.filters.enhancedSkill) ? props.filters.enhancedSkill.length : 0 }}개
    </div>
  </div>
</div>


<!-- Filter Actions -->
<div class="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700 mb-6">
  <div class="text-xs text-gray-500 dark:text-gray-400">
    필터가 적용된 항목들을 확인하세요
  </div>
  <button
    @click="clearAllFilters"
    class="px-3 py-1.5 bg-red-100 text-red-700 dark:text-gray-300 rounded-md hover:bg-red-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium flex items-center gap-1"
  >
    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
    전체 초기화
  </button>
</div>

  </div>
</template>

<style scoped>
/* Custom scrollbar for select elements and skill container */
select::-webkit-scrollbar,
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

select::-webkit-scrollbar-track,
.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

select::-webkit-scrollbar-thumb,
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

select::-webkit-scrollbar-thumb:hover,
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
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

/* Skill button animations */
button[class*="skill"] {
  transform-origin: center;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    transform: none !important;
  }
}
</style>