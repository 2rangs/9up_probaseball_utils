<script setup lang="ts">
import {defineProps, defineEmits, computed, watch, onMounted, ref} from 'vue'
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
  emit('update:filters', { ...props.filters, [field]: selected })
}

const update = (field: string, value: any) => {
  emit('update:filters', { ...props.filters, [field]: value })
}

const clearAllFilters = () => {
  const clearedFilters: Record<string, any> = {}
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
const normalSkillData = ref<any[]>([])
const enhancedSkillData = ref<any[]>([])
onMounted(async () => {
  const normalSkillRes = await fetch('/DB/normal_skill.json')
  const enhancedSkillRes = await fetch('/DB/enhanced_skill.json')
  normalSkillData.value = await normalSkillRes.json()
  enhancedSkillData.value = await enhancedSkillRes.json()
})
// 다크 토글할 때(예: 버튼 클릭 핸들러)
// html(or body)에 120ms 정도 'theme-switching' 붙였다가 제거
function toggleDark() {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.classList.toggle('dark'); // 기존 다크 토글 로직 그대로
  setTimeout(() => root.classList.remove('theme-switching'), 120);
}

const matchSkillInfo = (skill: string, type: string, year?: string) => {
  if (type === 'normal') {
    return normalSkillData.value.find(s => s.skill === skill)?.image || ''
  } else if (type === 'enhanced') {
    return enhancedSkillData.value.find(s => s.enhanced_skill === skill)?.image || ''
  } else if (type === 'enhanced:GG') {
    return enhancedSkillData.value.find(s => s.enhanced_skill === skill)?.image || ''
  }else if (type === 'effects:normal') {
    return normalSkillData.value.find(s => s.skill === skill)?.effects || ''
  }else if (type === 'description:normal') {
    return normalSkillData.value.find(s => s.skill === skill)?.description || ''
  } else if (type === 'description:enhanced') {
    return enhancedSkillData.value.find(s => s.enhanced_skill === skill)?.description || []
  } else if (type === 'effects_by_level') {
    return enhancedSkillData.value.find(s => s.enhanced_skill === skill)?.effects_by_level || []
  }
  else if (type === 'effects_by_year') {
    return enhancedSkillData.value.find(s => s.enhanced_skill === skill)?.effects_by_year[year] || []
  }
  return ''
}


</script>

<template>
  <div class="max-w-[1280px] m-auto p-2">
    <!-- 검색 -->
    <div class="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="sm:col-start-3">
        <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300/90 mb-1">
          {{`${fieldLabels['name']} 또는 ${fieldLabels['synergy']}`}}
        </label>
        <div class="relative">
          <input
              type="text"
              :value="props.filters.search || ''"
              @input="update('search', $event.target.value)"
              placeholder="이름 또는 시너지 검색..."
              class="w-full bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-colors duration-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
              aria-label="검색어"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 상단 필터 블럭들 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <!-- 등급 / 레어도 / 팀 -->
      <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
          {{ fieldLabels['grade'] }} / {{ fieldLabels['rarity'] }} / {{ fieldLabels['team'] }}
        </h3>

        <!-- 레어도 -->
        <div class="mt-3 flex gap-1.5">
          <button
              v-for="i in 6"
              :key="i"
              @click="update(rarityField, i === props.filters[rarityField] ? '' : i)"
              class="p-1.5 rounded-md transition-colors duration-100 hover:bg-yellow-100/60 dark:hover:bg-yellow-900/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60"
              :aria-pressed="i <= props.filters[rarityField]"
              :title="`${i} Star`"
          >
            <Star
                :class="i <= props.filters[rarityField] ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'"
                class="w-5 h-5"
                fill="currentColor"
            />
          </button>
        </div>

        <!-- 등급 아이콘 -->
        <div class="mt-4 grid grid-cols-5 gap-3">
          <div
              v-for="grade in visibleGrades"
              :key="grade"
              @click="toggleFilter('grade', grade)"
              class="relative rounded-md cursor-pointer flex items-center justify-center border transition-[filter,box-shadow] duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              :class="isSelected('grade', grade)
              ? 'border-blue-500 ring-1 ring-blue-300 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 grayscale hover:grayscale-0 hover:brightness-95'"
              :aria-pressed="isSelected('grade', grade)"
              :title="grade"
          >
            <img :src="`/assets/logos/grade/${grade}.png`" :alt="grade" class="h-auto w-24 object-contain" />
          </div>
        </div>

        <!-- 팀 선택 -->
        <div class="mt-4 grid grid-cols-7 gap-2.5">
          <button
              v-for="team in props.filterOptions.team"
              :key="team"
              @click="toggleFilter('team', team)"
              :title="team.toUpperCase()"
              class="relative p-1 rounded-md flex items-center justify-center border bg-white/95 dark:bg-gray-900/90 transition-[filter,border-color,box-shadow] duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              :class="[
              isSelected('team', team)
                ? 'border-blue-500 ring-1 ring-blue-300 shadow-sm'
                : 'border-gray-200 dark:border-gray-700 grayscale hover:grayscale-0 hover:brightness-95'
            ]"
          >
            <img :src="teamLogos[team]" :alt="team" class="w-8 h-8 object-contain drop-shadow-sm" />
          </button>
        </div>
      </div>

      <!-- 포지션 야구장 UI -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 p-4 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
          {{ fieldLabels['position'] }}
        </h3>

        <div class="grid-col-3 rounded-lg">
          <!-- Baseball Field Layout -->
          <div class="relative w-full h-64 mx-auto">
            <!-- Outfield -->
            <div class="absolute top-[8%] left-1/2 -translate-x-1/2">
              <button v-if="actualPositions.includes('CF')" @click="toggleFilter('position', 'CF')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'CF')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">CF</button>
            </div>
            <div class="absolute top-[8%] left-[10%]">
              <button v-if="actualPositions.includes('LF')" @click="toggleFilter('position', 'LF')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'LF')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">LF</button>
            </div>
            <div class="absolute top-[8%] right-[10%]">
              <button v-if="actualPositions.includes('RF')" @click="toggleFilter('position', 'RF')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'RF')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">RF</button>
            </div>

            <!-- Infield -->
            <div class="absolute top-[63%] left-[8%]">
              <button v-if="actualPositions.includes('B3')" @click="toggleFilter('position', 'B3')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'B3')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">3B</button>
            </div>
            <div class="absolute top-[63%] right-[8%]">
              <button v-if="actualPositions.includes('B1')" @click="toggleFilter('position', 'B1')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'B1')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">1B</button>
            </div>
            <div class="absolute top-[40%] left-[25%]">
              <button v-if="actualPositions.includes('SS')" @click="toggleFilter('position', 'SS')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'SS')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">SS</button>
            </div>
            <div class="absolute top-[40%] right-[25%]">
              <button v-if="actualPositions.includes('B2')" @click="toggleFilter('position', 'B2')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'B2')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">2B</button>
            </div>
            <div class="absolute top-[40%] left-[25%]">
              <button v-if="actualPositions.includes('SP')" @click="toggleFilter('position', 'SP')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'SP')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">SP</button>
            </div>
            <div class="absolute top-[40%] right-[25%]">
              <button v-if="actualPositions.includes('RP')" @click="toggleFilter('position', 'RP')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'RP')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">RP</button>
            </div>

            <!-- Catcher & DH -->
            <div class="absolute bottom-[1%] left-[39%]">
              <button v-if="actualPositions.includes('C')" @click="toggleFilter('position', 'C')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'C')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">C</button>
            </div>
            <div class="absolute bottom-[1%] right-[10%]">
              <button v-if="actualPositions.includes('DH')" @click="toggleFilter('position', 'DH')"
                      :class="[
                  'p-2 w-20 rounded-md text-sm font-bold border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('position', 'DH')
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]">DH</button>
            </div>
          </div>
        </div>

        <!-- 추가 선택(핸드/피칭 등) -->
        <div class="grid grid-flow-col gap-4 overflow-x-auto pt-6">
          <div
              v-for="field in selectFields.filter(f => !['grade', 'position', 'skill','search', 'enhancedSkill', 'year'].includes(f))"
              :key="field"
              class="flex flex-col items-center space-y-1"
          >
            <label class="block text-sm font-semibold text-gray-600 dark:text-gray-300 capitalize text-center">
              {{ fieldLabels[field] }}
            </label>
            <div class="flex gap-1.5 flex-wrap justify-center">
              <button
                  v-for="option in props.filterOptions[field]"
                  :key="option"
                  @click="() => update(field, props.filters[field] === option ? null : option)"
                  :class="[
                  'px-2 py-1.5 rounded-md text-xs font-medium border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  props.filters[field] === option
                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]"
              >
                {{ getSpecialFieldLabel(field, option) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 연도 -->
      <div class="rounded-lg p-4 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 flex flex-col">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
          {{ fieldLabels['year'] }}
        </h3>
        <div class="flex-1 overflow-y-auto max-h-82 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80">
          <div class="grid grid-cols-4 gap-3">
            <button
                v-for="year in yearOptions"
                :key="year"
                @click="toggleFilter('year', year)"
                :class="[
                'px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                isSelected('year', year)
                  ? 'bg-blue-500 text-white border-blue-500 shadow'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
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
    </div>

    <!-- 스킬 / 강화 스킬 (2:1 비율 유지) -->
    <div class="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
      <!-- 스킬 -->
      <div class="bg-white/95 dark:bg-gray-900/95 rounded-lg p-4 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 flex flex-col">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ fieldLabels['skill'] }}</h3>
        <div class="flex-1 overflow-scroll max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80">
          <div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-1">
            <button
                v-for="skill in props.filterOptions.skill"
                :key="skill"
                :title="skill"
                @click="toggleFilter('skill', skill)"
                @keydown.enter.prevent="toggleFilter('skill', skill)"
                @keydown.space.prevent="toggleFilter('skill', skill)"
                class="group relative w-[80px] sm:w-[70px] inline-flex flex-col items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-[border-color,filter] duration-100"
                :class="isSelected('skill', skill)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
                role="button"
                :aria-pressed="isSelected('skill', skill)"
            >
              <div
                  class="w-10 h-10 sm:w-11 sm:h-11 rounded-lg"
                  :class="isSelected('skill', skill) ? 'bg-white/20' : 'bg-gray-50 dark:bg-gray-700'"
              >
                <img
                    :src="`/assets/logos/skills/${matchSkillInfo(skill, 'normal')}.png`"
                    :alt="skill"
                    class="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                />
              </div>
              <span class="block w-full text-center font-semibold">
                {{ skill }}
              </span>
            </button>
          </div>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          선택된 {{ fieldLabels['skill'] }}: {{ Array.isArray(props.filters.skill) ? props.filters.skill.length : 0 }}개
        </div>
      </div>

      <!-- 강화 스킬 -->
      <div class="bg-white/95 dark:bg-gray-900/95 rounded-lg p-4 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 flex flex-col">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ fieldLabels['enhancedSkill'] }}</h3>
        <div class="flex-1 overflow-y-auto max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80">
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            <button
                v-for="skill in props.filterOptions.enhancedSkill"
                :key="skill"
                @click="toggleFilter('enhancedSkill', skill)"
                :class="[
                'px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                isSelected('enhancedSkill', skill)
                  ? 'bg-blue-500 text-white border-blue-500 shadow'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              ]"
                :aria-pressed="isSelected('enhancedSkill', skill)"
            >
              {{ skill }}
            </button>
          </div>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          선택된 {{ fieldLabels['enhancedSkill'] }}: {{ Array.isArray(props.filters.enhancedSkill) ? props.filters.enhancedSkill.length : 0 }}개
        </div>
      </div>
    </div>

    <!-- 액션 -->
    <div class="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700 mb-6">
      <!-- 액션 영역 비워둠 -->
    </div>
  </div>
</template>

<style scoped>
/* ===== 작은 디테일들: 대비/그림자/애니 ===== */
.drop-glow {
  filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.45));
}
/* 전환 순간만 전체 트랜지션 비활성화 */
.theme-switching *, .theme-switching *::before, .theme-switching *::after {
  transition: none !important;
  animation: none !important;
}

/* 스크롤바 통일 */
select::-webkit-scrollbar,
.overflow-y-auto::-webkit-scrollbar { width: 8px; height: 8px; }
select::-webkit-scrollbar-track,
.overflow-y-auto::-webkit-scrollbar-track { background: rgba(148,163,184,0.15); border-radius: 4px; }
select::-webkit-scrollbar-thumb,
.overflow-y-auto::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.35); border-radius: 4px; }
select::-webkit-scrollbar-thumb:hover,
.overflow-y-auto::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.55); }

/* 커서 */
button, select { cursor: pointer; }
input[type="text"] { cursor: text; }

/* 포커스 visible만 강조 (접근성) */
:focus { outline: none; }

/* 호버 보더 컬러 미세 업 */
input:hover, select:hover { border-color: #9ca3af; }

/* 라벨 컬러 부드럽게 */
.space-y-1 > label { transition: color .2s ease; }

/* 모션 감약 사용자의 경우 전환 제거 */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; transform: none !important; }
}
</style>
