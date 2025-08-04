<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Star, ExternalLink, ChevronDown, ChevronUp} from 'lucide-vue-next'
import SideModal from './SideModal.vue' // 실제 위치에 맞게 수정

const props = defineProps({
  items: {
    type: Array as () => Record<string, string>[],
    required: true
  },
  columns: {
    type: Array as () => string[],
    required: true
  }
})

interface TeamHistory {
  key: string
  name: string
  logo: string
}
interface TeamSetting {
  id: number
  history: TeamHistory[]
}

const head = {
  grade : '등급',
  rarity : '희귀도',
  name : '이름',
  team : '구단',
  year : '연도',
  position : '포지션',
  handType : '투타',
  pitchingType : '피칭타입',
  skill : '스킬',
  synergy : '시너지',
  open : '상세정보',
}

const teamData = ref<TeamSetting[]>([])

onMounted(async () => {
  const res = await fetch('/DB/setting.json')
  teamData.value = await res.json()
})

function findTeamLogoByKey(teamKey: string): string | null {
  for (const team of teamData.value) {
    for (const history of team.history) {
      if (history.key === teamKey) return history.logo
    }
  }
  return null
}

function findTeamLogoByName(teamKey: string): string | null {
  for (const team of teamData.value) {
    for (const history of team.history) {
      if (history.key === teamKey) return history.name
    }
  }
  return null
}

function parsePosition(value: string): string {
  try {
    const arr = JSON.parse(value)
    return Array.isArray(arr) ? arr.join(', ') : value
  } catch {
    return value
  }
}

function translateDirection(input: string): string {
  if (input === 'L') return '좌'
  if (input === 'R') return '우'
  if (input === 'S') return '양'
  return input
}

function translatePitchingType(input: string): string {
  if (input === 'O') return '오버 핸드'
  if (input === 'U') return '언더 핸드'
  if (input === 'S') return '사이드 암'
  return input
}

const showModal = ref(false)
const selectedItem = ref<Record<string, any> | null>(null)

function openModal(item: Record<string, any>) {
  selectedItem.value = item
  showModal.value = true
}

const expandedRowIndex = ref<number | null>(null)

function toggleExpanded(index: number) {
  expandedRowIndex.value = expandedRowIndex.value === index ? null : index
}

</script>

<template>
  <div class="overflow-x-auto max-w-[1280px] m-auto">
    <table class="min-w-full text-sm table-auto">
      <thead class="bg-gray-100 text-gray-700 font-semibold text-xs uppercase tracking-wide">
      <tr>
        <th
            v-for="col in columns"
            :key="col"
            class="px-4 py-3 border-b border-gray-300 whitespace-nowrap text-center"
        >
          {{ head[col] }}
        </th>
      </tr>
      </thead>
      <tbody>
      <tr
          v-for="(item, index) in items"
          :key="index"
          :class="index % 2 === 0 ? 'bg-white' : 'bg-gray-50'"
          class="hover:bg-gray-100 transition"
      >
        <td
            v-for="col in columns"
            :key="col"
            :class="[
              'px-4 py-2 border-b border-gray-200 whitespace-nowrap align-middle text-sm text-gray-800',
              col === 'synergy' ? 'text-left' : 'text-center'
            ]"
        >
          <template v-if="col === 'rarity'">
            <div class="flex justify-center gap-0.5">
              <Star
                  v-for="i in Number(item[col])"
                  :key="'filled-' + i"
                  class="w-4 h-4 text-yellow-400"
                  fill="currentColor"
              />
            </div>
          </template>

          <template v-else-if="col === 'team'">
            <div class="grid grid-cols-[50px_1fr] items-center w-[120px]">
              <div class="w-[50px] h-[50px] flex items-center justify-center">
                <img
                    :src="findTeamLogoByKey(item[col])"
                    :alt="item[col]"
                    class="w-[32px] h-[32px] object-contain"
                />
              </div>
              <span class="text-sm leading-tight text-center">
                  {{ findTeamLogoByName(item[col]) }}
                </span>
            </div>
          </template>

          <template v-else-if="col === 'year'">
            <span v-if="!item[col]">해당 없음</span>
            <span v-else>{{ item[col] }}</span>
          </template>

          <template v-else-if="col === 'position'">
            <span>{{ parsePosition(item[col]) }}</span>
          </template>

          <template v-else-if="col === 'handType'">
              <span>
                {{ translateDirection(item.throwHand) + '투' + translateDirection(item.battingHand) + '타' }}
              </span>
          </template>

          <template v-else-if="col === 'pitchingType'">
            <span>{{ translatePitchingType(item[col]) }}</span>
          </template>

          <template v-else-if="col === 'synergy'">
            <div
                class="w-[300px] text-left flex items-start justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 border border-gray-200 hover:bg-gray-100 transition-all duration-300"
            >
              <p
                  class="flex-1 text-sm text-gray-800 select-text whitespace-pre-line break-words leading-snug transition-all duration-300"
                  :style="expandedRowIndex === index
        ? {}
        : { display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }"
              >
                {{ item[col] }}
              </p>

              <button
                  v-if="item[col].length > 25"
                  @click="toggleExpanded(index)"
                  :aria-expanded="expandedRowIndex === index"
                  class="text-gray-500 hover:text-blue-600 transition-colors duration-150 mt-0.5 shrink-0 cursor-pointer focus:outline-none"
                  :title="expandedRowIndex === index ? '시너지 접기' : '시너지 전체 보기'"
              >
                <component
                    :is="expandedRowIndex === index ? ChevronUp : ChevronDown"
                    class="w-4 h-4"
                />
              </button>
            </div>
          </template>







          <template v-else-if="col === 'open'">
            <button @click="openModal(item)" class="text-blue-600 underline text-sm">
              <ExternalLink />
            </button>
          </template>

          <template v-else class="cursor-pointer">
            {{ item[col] }}
          </template>
        </td>
      </tr>
      </tbody>
    </table>
  </div>

  <SideModal v-model:show="showModal">
    <h2 class="text-lg font-bold mb-4">선수 상세정보</h2>
    <div v-if="selectedItem">
      {{selectedItem}}
      <p class="mb-2"><strong>이름:</strong> {{ selectedItem.name }}</p>
      <p class="mb-2"><strong>팀:</strong> {{ findTeamLogoByName(selectedItem.team) }}</p>
      <p class="mb-2"><strong>포지션:</strong> {{ parsePosition(selectedItem.position) }}</p>
      <p class="mb-2"><strong>시너지:</strong> {{ selectedItem.synergy }}</p>
    </div>
  </SideModal>
</template>
