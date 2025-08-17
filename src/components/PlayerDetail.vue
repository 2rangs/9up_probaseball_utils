<script setup lang="ts">
import { Radar } from 'vue-chartjs'
import { computed, onMounted, ref } from 'vue'
import { ChevronDown, ChevronUp, Star} from 'lucide-vue-next'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler)

const props = defineProps<{ player: Record<string, any> | null }>()


const teamData = ref<any[]>([])
const normalSkillData = ref<any[]>([])
const enhancedSkillData = ref<any[]>([])
const selectedEffectIndex = ref(0)
const synergyData = ref<any[]>([])
const expandedSynergies = ref<any[]>([])

function toggleSynergy(s: string) {
  const idx = expandedSynergies.value.indexOf(s)
  if (idx === -1) {
    expandedSynergies.value.push(s)
  } else {
    expandedSynergies.value.splice(idx, 1)
  }
}

function isExpanded(s: string) {
  return expandedSynergies.value.includes(s)
}
onMounted(async () => {
  const res = await fetch('/DB/setting.json')
  const normalSkillRes = await fetch('/DB/normal_skill.json')
  const enhancedSkillRes = await fetch('/DB/enhanced_skill.json')
  const synergyRes = await fetch('/DB/synergys.json')

  synergyData.value = await synergyRes.json()
  normalSkillData.value = await normalSkillRes.json()
  enhancedSkillData.value = await enhancedSkillRes.json()
  teamData.value = await res.json()
})

const findTeamName = (teamKey: string): string => {
  for (const team of teamData.value) {
    for (const history of team.history) {
      if (history.key === teamKey) return history.name
    }
  }
  return ''
}

const findTeamLogo = (teamKey: string): string => {
  const logos: Record<string, string> = {
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
  return logos[teamKey] ?? ''
}

const parsePosition = (raw: string) => {
  try {
    return JSON.parse(raw).join(', ')
  } catch {
    return raw
  }
}

const translateDirection = (input: string): string => {
  return input === 'L' ? '좌' : input === 'R' ? '우' : input === 'S' ? '양' : input
}

const translatePitchingType = (input: string): string => {
  return input === 'O' ? '오버 핸드' : input === 'U' ? '언더 핸드' : input === 'S' ? '사이드 암' : input
}

const abilities = computed(() => {
  if (!props.player) return []

  const rawPosition = props.player.position
  const isPitcher = (() => {
    try {
      const parsed = JSON.parse(rawPosition)
      return Array.isArray(parsed) ? parsed.includes('SP') || parsed.includes('RP') : parsed === 'SP' || parsed === 'RP'
    } catch {
      return rawPosition === 'P'
    }
  })()

  if (isPitcher) {
    // 투수: 제외 → pitchLimit, runnerControl, defense
    return [
      { label: '무브먼트', value: props.player.movement },
      { label: '장타 억제', value: props.player.longHitSuppression },
      { label: '홈런 억제', value: props.player.homeRunSuppression },
      { label: '제구력', value: props.player.control },
      { label: '구질', value: props.player.stuff }
    ]
  } else {
    // 타자: 제외 → stealing, baseRunning, defense
    return [
      { label: '컨택', value: props.player.contact },
      { label: '갭파워', value: props.player.gapPower },
      { label: '홈런파워', value: props.player.homeRunPower },
      { label: '선구안', value: props.player.plateDiscipline },
      { label: '삼진회피', value: props.player.strikeoutAvoidance }
    ]
  }
})
const excludedAbilities = computed(() => {
  if (!props.player) return []

  const rawPosition = props.player.position
  const isPitcher = (() => {
    try {
      const parsed = JSON.parse(rawPosition)
      return Array.isArray(parsed)
          ? parsed.includes('SP') || parsed.includes('RP')
          : parsed === 'SP' || parsed === 'RP'
    } catch {
      return rawPosition === 'P'
    }
  })()

  if (isPitcher) {
    return [
      { label: '투구 수', value: props.player.pitchLimit },
      { label: '주자 견제', value: props.player.runnerControl },
      { label: '수비력', value: props.player.defense }
    ]
  } else {
    return [
      { label: '주루', value: props.player.baseRunning },
      { label: '도루', value: props.player.stealing },
      { label: '수비력', value: props.player.defense }
    ]
  }
})

const totalPower = computed(() => {
  const included = abilities.value.reduce((sum, stat) => sum + Number(stat.value || 0), 0)
  const excluded = excludedAbilities.value.reduce((sum, stat) => sum + Number(stat.value || 0), 0)
  return included + excluded
})
const isDark = computed(() => document.documentElement.classList.contains('dark'))

const radarData = computed(() => ({
  labels: abilities.value.map(a => a.label),
  datasets: [{
    label: '능력치',
    data: abilities.value.map(a => a.value),
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: 'rgba(59, 130, 246, 1)',
    pointBackgroundColor: 'rgba(59, 130, 246, 1)'
  }]
}))

const radarOptions = {
  responsive: true,
  scales: {
    r: {
      suggestedMin: 0,
      suggestedMax: 999,
      angleLines: {
        color: isDark.value ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
      },
      grid: {
        color: isDark.value ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)'
      },
      pointLabels: {
        color: isDark.value ? '#f3f4f6' : '#374151',
        font: { size: 12 },
        callback: function (label, index) {
          // abilities.value[index].value 사용해서 값 표시
          const value = abilities.value?.[index]?.value ?? ''
          return `${label}\n${value}` // 줄바꿈으로 아래 표시
        }
      },

      ticks : {display : false}
    }
  },
  plugins: {
    legend: { display: false },
  }
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


const findSynergy = (synergy: string) => {
  return synergyData.value.find(item => item.synergy === synergy)
}

const matchAllstarTeam = (team: string) => {
  const asgdTeams = [
    'DOOSAN','KT','LOTTE','OB','SAMSUNG','SBW','SK','SSG'
  ]
  const asgnTeams = [
    'BINGGRAE','CHUNGBO','HAITAI','HANWHA','HYUNDAI','KIA','KIWOOM','NEXEN',
    'LG','MBC','NC','OB','PACIFIC','SAMMI'
  ]

  if (asgdTeams.includes(team)) {
    return 'ASGD'
  }else if (asgnTeams.includes(team)) {
    return 'ASGN'
  }
}


</script>

<template>
  <div
      v-if="player"
      class="min-h-screen dark:bg-gray-900"
  >
    <div class="max-w-5xl mx-auto space-y-4">
      <!-- 상단: 이미지 + 기본정보 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- 왼쪽: 이미지 + 강화 스킬 -->
        <div class="space-y-4">
          <!-- 메인 이미지 카드 -->
          <div class="relative rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div class="aspect-[3/4] w-full bg-gray-100 dark:bg-gray-700">
             <!-- 아래는 임시 이미지 -->
              <img v-if="player.grade === 'ASG'"
                  :src="`/assets/playercards/commonCard_${matchAllstarTeam(player.team.toUpperCase())}_${player.team.toUpperCase()}.png`"
                  class="w-full h-full object-cover"
                  alt="player image"
                  loading="lazy"
              />
              <img v-else-if="player.grade === 'DGN'"
                   :src="`/assets/playercards/DGN/${player.team.toUpperCase()}/${player.id}.png`"
                   class="w-full h-full object-cover"
                   alt="player image"
                   loading="lazy"
              />
              <img v-else
                  :src="`/assets/playercards/commonCard_${player.grade}_${player.team.toUpperCase() === 'NEXEN' ? 'KIWOOM' : player.team.toUpperCase()}.png`"
                  class="w-full h-full object-cover"
                  alt="player image"
                  loading="lazy"
              />
            </div>

            <!-- 하단 오버레이: 이름/등급 -->
            <div class="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div class="flex items-end justify-between">
                <div>
                  <h1 class="text-xl sm:text-2xl font-bold text-white mb-1">
                    {{ player.name }}
                  </h1>
                  <div class="flex items-center gap-1">
                    <Star
                        v-for="n in Number(player.rarity)"
                        :key="n"
                        class="w-4 h-4 text-yellow-400"
                        fill="currentColor"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 등급 배지 -->
            <div v-if="player.grade === 'MMVP'" class="absolute top-3 right-3 p-1 bg-black/90 backdrop-blur rounded-lg">
              <span class="text-xs font-semibold text-white">{{JSON.parse(player.year)[0]}}년 {{player.month}}월</span>
            </div>
          </div>

          <!-- 강화 스킬 -->
          <div v-if="player.enhancedSkill"
               class="rounded-2xl bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700">

            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
              강화 스킬
            </h3>

            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <!-- 스킬 이미지 -->
                <div
                    v-if="player.grade === 'GG'"
                    :class="`bg-${matchSkillInfo(player.enhancedSkill, 'enhanced:GG', JSON.parse(player.year)?.[0])}${JSON.parse(player.year)[0]} rounded-lg object-contain bg-gray-50 dark:bg-gray-700 p-1`"
                />
                <div
                    v-else
                    :class="`bg-${matchSkillInfo(player.enhancedSkill, 'enhanced')} w-12 h-12 rounded-lg object-contain bg-gray-50 dark:bg-gray-700 p-1`"
                />

                <!-- 스킬 텍스트 -->
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {{ player.enhancedSkill }}<template v-if="player.grade === 'GG'"> {{ JSON.parse(player.year)?.[0] }}</template>
                  </h4>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {{ matchSkillInfo(player.enhancedSkill, 'description:enhanced') }}
                  </p>
                </div>
              </div>

              <!-- 레벨 선택 -->
              <div class="grid grid-cols-6 gap-2">
                <template v-if="player.grade === 'GG'">
                  <button
                      v-for="(effect, i) in matchSkillInfo(player.enhancedSkill, 'effects_by_year', JSON.parse(player.year)) || []"
                      :key="'btn-' + i"
                      @click="selectedEffectIndex = i"
                      class="px-1 py-1 text-xs font-medium rounded-md transition-colors text-center"
                      :class="selectedEffectIndex === i
        ? 'bg-blue-500 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
                  >
                    {{ i === 0 ? '기본' : `Lv.${i}` }}
                  </button>
                </template>

                <template v-else>
                  <button
                      v-for="(effect, j) in matchSkillInfo(player.enhancedSkill, 'effects_by_level') || []"
                      :key="'btn-' + j"
                      @click="selectedEffectIndex = j"
                      class=" py-1 text-xs font-medium rounded-md transition-colors text-center"
                      :class="selectedEffectIndex === j
        ? 'bg-blue-500 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
                  >
                    {{ j === 0 ? '기본' : `Lv.${j}` }}
                  </button>
                </template>
              </div>


              <!-- 선택된 효과 -->
              <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <div class="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-line leading-relaxed">
                  {{
                    player.grade === 'GG'
                        ? matchSkillInfo(player.enhancedSkill, 'effects_by_year', JSON.parse(player.year))[selectedEffectIndex]
                        : matchSkillInfo(player.enhancedSkill, 'effects_by_level')[selectedEffectIndex]
                  }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 오른쪽: 정보 + 능력치 -->
        <div class="space-y-4">
          <!-- 기본 정보 카드 -->
          <div class="rounded-2xl bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700">

            <!-- 헤더 -->
            <div class="flex items-center gap-3 mb-2">
              <img
                  :src="`/assets/logos/grade/${player.grade}.png`"
                  :alt="player.grade"
                  class="w-18 h-auto object-contain"
              />
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                  {{ player.name }}
                </h2>
                <span v-if="player.grade === 'MMVP'" class="inline-block px-2 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded uppercase">{{JSON.parse(player.year)[0]}}년 {{player.month}}월 {{ player.grade }}</span>
                <span v-else-if="player.year" class="inline-block px-2 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded uppercase">
                  {{JSON.parse(player?.year)}}
                </span>
              </div>
            </div>

            <!-- 정보 그리드 -->
            <div class="grid grid-cols-2 gap-3">
              <!-- 소속 팀 -->
              <div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <img :src="findTeamLogo(player.team)" alt="logo" class="w-6 h-6 object-contain" />
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">소속팀</p>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {{ findTeamName(player.team) }}
                  </p>
                </div>
              </div>

              <!-- 포지션 -->
              <div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div class="w-6 h-6 bg-green-100 dark:bg-green-900 rounded flex items-center justify-center">
                  <span class="text-green-700 dark:text-green-300 text-xs font-bold">P</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">포지션</p>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ parsePosition(player.position) }}
                  </p>
                </div>
              </div>

              <!-- 투타 -->
              <div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div class="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded flex items-center justify-center">
                  <span class="text-purple-700 dark:text-purple-300 text-xs font-bold">투</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">투타</p>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ translateDirection(player.throwHand) }}투{{ translateDirection(player.battingHand) }}타
                  </p>
                </div>
              </div>

              <!-- 투구형태 -->
              <div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div class="w-6 h-6 bg-orange-100 dark:bg-orange-900 rounded flex items-center justify-center">
                  <span class="text-orange-700 dark:text-orange-300 text-xs font-bold">형</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-gray-500 dark:text-gray-400">투구형태</p>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">
                    {{ translatePitchingType(player.pitchingType) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 능력치 카드 -->
          <div class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">

            <div class="flex items-center justify-between px-4 mt-4">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">종합 능력</h3>
              <span class="text-lg font-bold text-blue-600 dark:text-blue-400">{{ totalPower }}</span>
            </div>

            <!-- 레이더 차트 -->
            <div class="w-full w-min-[280px] m-auto">
              <Radar :data="radarData" :options="radarOptions" class="w-full h-full w-min-[280px] m-auto" />
            </div>

            <!-- 주요 능력치 -->
            <div class="grid grid-cols-2 gap-2 mb-3 px-4">
              <div v-for="(a, i) in abilities" :key="i"
                   class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ a.label }}</span>
                <span class="text-sm font-bold text-gray-900 dark:text-white">{{ a.value }}</span>
              </div>
            </div>

            <!-- 기타 능력치 -->
            <div class="dark:border-gray-700 px-3 mb-4">
              <div class="grid grid-cols-3 gap-2">
                <div
                    v-for="(a, i) in excludedAbilities"
                    :key="'ex-' + i"
                    class="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ a.label }}</div>
                  <div class="text-sm font-bold text-gray-900 dark:text-white">{{ a.value ?? '-' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 하단: 스킬 + 시너지 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- 보유 스킬 -->
        <div class="md:col-span-1">
          <div class="rounded-2xl bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700">

            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <div class="w-2 h-2 bg-green-500 rounded-full"></div>
              보유 스킬
            </h3>

            <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <div
                  v-for="(skill, i) in player.skill.split(',').map(s => s.trim()).filter(Boolean)"
                  :key="'skill-' + i"
                  class="group relative flex flex-col items-center text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                <!-- 툴팁 -->
                <!-- 툴팁 - 좌우 끝에서는 방향 조정 -->
                <div class="absolute z-50 w-72 text-xs bg-gray-900/95 backdrop-blur text-white p-3 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none left-full ml-2 top-0">

                <div class="font-semibold text-yellow-300 mb-1">{{ skill }}</div>
                  <div class="text-gray-200 mb-2 whitespace-pre-line">
                    {{ matchSkillInfo(skill, 'effects:normal') }}
                  </div>
                  <div class="text-gray-400 text-xs whitespace-pre-line">
                    {{ matchSkillInfo(skill, 'description:normal') }}
                  </div>
                </div>

                <div :class="`bg-${matchSkillInfo(skill, 'normal')} w-12 h-12 bg-white dark:bg-gray-800 rounded-lg`">
                </div>
                <span class="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">{{ skill }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 시너지 -->
        <div v-if="player.synergy" class="xl:col-span-1">
          <div class="rounded-2xl bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700">

            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <div class="w-2 h-2 bg-purple-500 rounded-full"></div>
              시너지 효과
            </h3>

            <div class="space-y-2">
              <div
                  v-for="(synergy, i) in player.synergy.split(',').map(s => s.trim()).filter(Boolean)"
                  :key="'synergy-' + i"
                  class="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden"
              >
                <button
                    class="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    @click="toggleSynergy(synergy)"
                >
                  <span class="text-gray-900 dark:text-white truncate">{{ findSynergy(synergy)?.synergy }}</span>
                  <component :is="isExpanded(synergy) ? ChevronUp : ChevronDown" class="w-4 h-4 text-gray-500" />
                </button>
                <div v-if="isExpanded(synergy)" class="px-3 pb-3 border-t border-gray-200 dark:border-gray-600">
                  <div class="bg-purple-50 dark:bg-purple-900/20 rounded p-2 mt-2 mb-2">
                    <pre class="text-xs text-purple-800 dark:text-purple-200 whitespace-pre-wrap leading-relaxed">{{ findSynergy(synergy)?.synergy_effect }}</pre>
                  </div>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    {{ findSynergy(synergy)?.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* tailwind 컴파일 대상에 포함되도록 classes 기반 */
.tooltip-content {
  top: 90%;
  margin-top: 0.2rem; /* translate-y-2 */
}

/* tooltip-up 클래스가 붙은 경우: 위로 */
.tooltip-up .tooltip-content {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 0.5rem; /* -translate-y-2 */
}


</style>