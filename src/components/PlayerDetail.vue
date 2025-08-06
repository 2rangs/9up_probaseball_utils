<script setup lang="ts">
import { Radar } from 'vue-chartjs'
import { computed, onMounted, ref } from 'vue'
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


onMounted(async () => {
  const res = await fetch('/DB/setting.json')
  const normalSkillRes = await fetch('/DB/normal_skill.json')
  const enhancedSkillRes = await fetch('/DB/enhanced_skill.json')

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
      suggestedMax: 1000,
      ticks: { stepSize: 200, color: 'none', backdropColor: 'transparent' },
      pointLabels: {
        color: '#444',
        font: { size: 13 },
        callback: (_: any, i: number) => `${abilities.value[i]?.label ?? ''}\n${abilities.value[i]?.value ?? ''}`
      },
      grid: { color: '#ddd' }
    }
  },
  plugins: {
    legend: { display: false }
  }
}

const matchSkillInfo = (skill: string, type: string, year?: string) => {
  if (type === 'normal') {
    return normalSkillData.value.find(s => s.skill === skill)?.image || ''
  } else if (type === 'enhanced') {
    return enhancedSkillData.value.find(s => s.enhanced_skill === skill)?.image || ''
  } else if (type === 'enhanced:GG') {
    return enhancedSkillData.value.find(s => s.enhanced_skill === skill)?.image || ''
    }else if (type === 'description:normal') {
    return normalSkillData.value.find(s => s.skill === skill)?.effects || ''
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
  <div
      v-if="player"
      class="bg-white dark:bg-gray-900 rounded-xl shadow-md max-w-5xl mx-auto overflow-hidden p-4 space-y-6"
  >
    <!-- 상단: 이미지 + 기본정보 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- 왼쪽: 이미지 + 강화 스킬 -->
      <div class="space-y-4">
        <!-- 이미지 -->
        <div class="relative bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
          <img src="https://placehold.co/300x450?text=Player+Image" class="w-full h-auto object-cover" />
          <div class="absolute inset-x-0 bottom-3 text-center text-white text-xl font-bold drop-shadow-sm">
            {{ player.name }}
          </div>
        </div>

<div v-if="player.enhancedSkill" class="space-y-4">
  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">강화 스킬</p>

  <div class="flex gap-4 items-start rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 shadow-sm dark:shadow-md">
    <!-- 이미지 -->

        <img
        v-if="  player.grade === 'GG'"
      :src="`/assets/logos/skills/${ matchSkillInfo(
        player.enhancedSkill,
        'enhanced:GG',
        player.grade === 'GG' && typeof player.year === 'string'
          ? JSON.parse(player.year)?.[0]
          : undefined
      ) }${JSON.parse(player.year)[0]}.png`"
      alt="강화 스킬 이미지"
      class="w-16 h-16 rounded-lg object-contain shadow-md"
    />
        <img
        v-else
      :src="`/assets/logos/skills/${matchSkillInfo(player.enhancedSkill, 'enhanced')}.png`"
      alt="강화 스킬 이미지"
      class="w-16 h-16 rounded-lg object-contain shadow-md"
    />

    <!-- 텍스트 정보 -->
    <div class="flex-1 space-y-3 text-sm text-gray-800 dark:text-gray-100">
      <!-- 이름 -->
      <h4  v-if="  player.grade === 'GG'" class="text-base font-bold text-yellow-600 dark:text-yellow-300 leading-tight">
        {{player.enhancedSkill}}  {{JSON.parse(player.year)?.[0] }}
      </h4>
      <h4 v-else class="text-base font-bold text-yellow-600 dark:text-yellow-300 leading-tight">
        {{ matchSkillInfo(player.enhancedSkill, 'enhanced')}}
      </h4>

      <!-- 설명 -->
        <p class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
        {{ matchSkillInfo(player.enhancedSkill, 'description:enhanced') }}
      </p>

      <!-- 레벨 버튼 -->
      <div class="flex flex-wrap gap-2 mt-1">
      <button
         v-if="  player.grade === 'GG'"
          v-for="(effect, i) in  matchSkillInfo(player.enhancedSkill, 'effects_by_year', JSON.parse(player.year)) || []"
          :key="'btn-' + i"
          @click="selectedEffectIndex = i"
          :class="[
            'px-2 py-1 text-xs rounded border font-semibold transition',
            selectedEffectIndex === i
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
          ]"
        >
         <p v-if="i == 0">기본</p>
         <p v-else> Lv.{{ i  }}</p>
      </button>

        
        <button
          v-else
          v-for="(effect, j) in matchSkillInfo(player.enhancedSkill, 'effects_by_level') || []"
          :key="'btn-' + j"
          @click="selectedEffectIndex = j"
          :class="[
            'px-2 py-1 text-xs rounded border font-semibold transition',
            selectedEffectIndex === j
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
          ]"
        >
        <p v-if="j == 0">기본</p>
         <p v-else> Lv.{{ j  }}</p>
        </button>
      </div>

      <!-- 선택된 효과 -->
      <div
        v-if="  player.grade === 'GG'"
          class="mt-3 text-xs text-blue-800 dark:text-blue-300 whitespace-pre-line leading-snug border-t pt-2 border-gray-200 dark:border-gray-600"
      >
        {{
          matchSkillInfo(player.enhancedSkill, 'effects_by_year',JSON.parse(player.year))[selectedEffectIndex]
        }}
      </div>
       <!-- 선택된 효과 -->
      <div
        v-else
          class="mt-3 text-xs text-blue-800 dark:text-blue-300 whitespace-pre-line leading-snug border-t pt-2 border-gray-200 dark:border-gray-600"
      >
        {{
          matchSkillInfo(player.enhancedSkill, 'effects_by_level')[selectedEffectIndex]
        }}
      </div>
    </div>
  </div>
</div>

      </div>

      <!-- 오른쪽: 정보 + 능력치 + 레이더 -->
      <div class="space-y-6">
        <!-- 이름, 등급, 레어도 -->
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ player.name }}</h2>
          <span class="text-sm px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-800/30 dark:text-blue-300">
            등급: {{ player.grade }}
          </span>
          <span class="text-sm px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-800/30 dark:text-purple-300">
            레어도: {{ player.rarity }}
          </span>
        </div>

        <!-- 기본 정보 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">소속 팀</p>
            <div class="flex items-center gap-2 mt-1">
              <img :src="findTeamLogo(player.team)" alt="logo" class="w-6 h-6 object-contain" />
              <span class="capitalize font-semibold text-gray-800 dark:text-white">
                {{ findTeamName(player.team) }}
              </span>
            </div>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">포지션</p>
            <p class="mt-1 font-medium text-gray-900 dark:text-gray-100">{{ parsePosition(player.position) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">투타 유형</p>
            <p class="mt-1 font-medium text-gray-900 dark:text-gray-100">
              {{ translateDirection(player.throwHand) }}투{{ translateDirection(player.battingHand) }}타
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">투구 형태</p>
            <p class="mt-1 font-medium text-gray-900 dark:text-gray-100">
              {{ translatePitchingType(player.pitchingType) }}
            </p>
          </div>
        </div>

        <!-- 능력치 -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold text-gray-800 dark:text-white">능력치</h3>
            <span class="text-sm font-medium text-blue-600 dark:text-blue-400">
              총합: {{ totalPower }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-700 dark:text-gray-200">
            <div
                v-for="(a, i) in abilities"
                :key="i"
                class="flex justify-between"
            >
              <span>{{ a.label }}</span>
              <span class="font-semibold">{{ a.value }}</span>
            </div>
          </div>

          <!-- 레이더 -->
          <div class="text-center">
            <Radar :data="radarData" :options="radarOptions" class="inline-block max-w-[380px] mt-4" />
          </div>

          <!-- 제외 능력치 -->
          <div>
            <div class="grid grid-cols-3 gap-2 text-sm text-gray-800 dark:text-gray-200">
              <div
                  v-for="(a, i) in excludedAbilities"
                  :key="'excluded-ability-' + i"
                  class="flex flex-col items-center text-center px-3 py-3"
              >
                <span class="font-medium text-gray-600 dark:text-gray-300">{{ a.label }}</span>
                <span class="mt-1 text-base font-bold text-gray-900 dark:text-white">{{ a.value ?? '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 스킬 + 시너지 나란히 -->
 <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
  <!-- 🟦 스킬 -->
  <div v-if="player.skill" class="pb-16">
    <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">스킬</p>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 relative overflow-visible">
      <div
        v-for="(skill, i) in player.skill.split(',').map(s => s.trim()).filter(Boolean)"
        :key="'skill-' + i"
        class="group relative aspect-square w-full border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center text-center text-sm font-medium text-gray-700 dark:text-gray-200 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer overflow-visible"
      >
        <!-- 툴팁 -->
        <div
          :class="[
            'absolute z-[60] top-full mt-3 w-64 text-xs bg-gray-900 dark:bg-gray-700 text-white px-4 py-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out pointer-events-none',
            i % 3 === 0 ? 'left-2' : i % 3 === 2 ? 'right-2' : 'left-1/2 transform -translate-x-1/2'
          ]"
        >
          <div class="relative">
            <p class="font-semibold text-yellow-300 mb-1">{{ skill }}</p>
            <p class="text-gray-200 leading-relaxed text-left whitespace-pre-line">
              {{ matchSkillInfo(skill, 'description:normal') }}
            </p>
          </div>
        </div>

        <!-- 이미지 -->
        <img
          :src="`/assets/logos/skills/${matchSkillInfo(skill, 'normal')}.png`"
          alt="스킬"
          class="w-10 h-10 object-contain mb-1 transition-transform group-hover:scale-105"
          loading="lazy"
        />

        <!-- 텍스트 -->
        <span class="text-xs leading-tight">{{ skill }}</span>
      </div>
    </div>
  </div>

  <!-- 🟪 시너지 -->
  <div v-if="player.synergy">
    <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">시너지</p>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <div
        v-for="(synergy, i) in player.synergy.split(',').map(s => s.trim()).filter(Boolean)"
        :key="'synergy-' + i"
        class="aspect-square w-full flex items-center justify-center text-center text-sm font-medium border rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-100 border-blue-200 dark:border-blue-600 overflow-hidden px-2"
      >
        {{ synergy }}
      </div>
    </div>
  </div>
</div>


  </div>
</template>

