<template>
  <div class="w-full h-screen p-5 box-border bg-gray-50">
    <div class="h-full flex gap-5">
      <!-- ============== 좌측: 자체 검색폼 + 자체 테이블 ============== -->
      <section class="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col h-[calc(100vh-2.5rem)] min-w-[400px] w-[520px]">
        <header class="p-4 border-b border-gray-100 bg-white sticky top-0 z-30">
          <h1 class="text-lg font-semibold text-gray-900">선수 목록</h1>
        </header>

        <!-- 상단 요약 바 -->
        <div class="px-4 py-2 bg-white border-b border-gray-100 sticky top-[64px] z-20">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.2-4.2M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              필터
            </span>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="chip in activeChips" :key="chip.key"
                      @click="chip.clear()"
                      class="group inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200">
                <span class="font-medium text-gray-700">{{ chip.label }}</span>
                <span class="text-gray-500">·</span>
                <span class="text-gray-600">{{ chip.value }}</span>
                <svg class="w-3 h-3 text-gray-500 group-hover:text-gray-700" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 8.586l4.95-4.95 1.414 1.414L11.414 10l4.95 4.95-1.414 1.414L10 11.414l-4.95 4.95-1.414-1.414L8.586 10l-4.95-4.95L5.05 3.636 10 8.586z" clip-rule="evenodd"/></svg>
              </button>
              <span v-if="!activeChips.length" class="text-xs text-gray-400">선택된 필터 없음</span>
            </div>
            <div class="ml-auto flex items-center gap-2">
              <span class="text-xs text-gray-500">총 {{ total }}명</span>
              <button type="button" class="px-2 py-1.5 text-xs border rounded hover:bg-gray-50"
                      @click="resetFilters">전체 초기화</button>
            </div>
          </div>
        </div>

        <!-- 검색폼 -->
        <form class="p-3 border-b border-gray-100 grid grid-cols-2 gap-2 text-xs sticky top-[104px] bg-white z-10"
              @submit.prevent>
          <!-- 이름 -->
          <div class="col-span-2">
            <label class="block mb-1 font-medium text-gray-700">이름</label>
            <input v-model.trim="q.name" type="text" placeholder="예: 이정후"
                   class="w-full border rounded px-2 py-1.5"/>
          </div>

          <!-- 통합 검색 -->
          <div class="col-span-2">
            <label class="block mb-1 font-medium text-gray-700">통합 검색(이름/팀/연도/포지션/시너지/스킬)</label>
            <input v-model.trim="q.search" type="text" placeholder="쉼표/공백 구분"
                   class="w-full border rounded px-2 py-1.5"/>
          </div>

          <!-- 고급 필터 토글 -->
          <div class="col-span-2 -mt-1 mb-1">
            <button type="button"
                    @click="advancedOpen = !advancedOpen"
                    class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">
              <svg class="w-3.5 h-3.5 transition-transform" :class="advancedOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              고급 필터 {{ advancedOpen ? '숨기기' : '펼치기' }}
            </button>
          </div>

          <!-- 고급 영역 -->
          <div class="contents" v-show="advancedOpen">
            <!-- 팀 / 연도 -->
            <div>
              <label class="block mb-1 font-medium text-gray-700">팀</label>
              <select v-model="q.team" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="t in opts.team" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">연도</label>
              <select v-model="q.year" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="y in opts.year" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>

            <!-- 등급 / 레어도 -->
            <div>
              <label class="block mb-1 font-medium text-gray-700">등급</label>
              <select v-model="q.grade" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="g in opts.grade" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">레어도(정수)</label>
              <input v-model.number="q.rarity" type="number" min="0" class="w-full border rounded px-2 py-1.5"/>
            </div>

            <!-- 포지션 / 스킬 -->
            <div>
              <label class="block mb-1 font-medium text-gray-700">포지션</label>
              <select v-model="q.position" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="p in opts.position" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">스킬</label>
              <select v-model="q.skill" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="s in opts.skill" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <!-- 강화스킬 / 시너지 -->
            <div>
              <label class="block mb-1 font-medium text-gray-700">강화 스킬</label>
              <select v-model="q.enhancedSkill" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="s in opts.enhancedSkill" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">시너지</label>
              <select v-model="q.synergy" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="s in synergyOptions" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div class="col-span-2 flex gap-2 mt-1">
              <div class="text-gray-500 self-center">총 {{ total }}명 · {{ currentPage }} / {{ totalPages }}</div>
              <div class="ml-auto flex gap-1">
                <button type="button" class="px-2 py-1 border rounded" @click="goFirst" :disabled="currentPage===1" aria-label="첫 페이지">First</button>
                <button type="button" class="px-2 py-1 border rounded" @click="goPrev" :disabled="currentPage===1" aria-label="이전 페이지">Prev</button>
                <button type="button" class="px-2 py-1 border rounded" @click="goNext" :disabled="currentPage===totalPages" aria-label="다음 페이지">Next</button>
                <button type="button" class="px-2 py-1 border rounded" @click="goLast" :disabled="currentPage===totalPages" aria-label="마지막 페이지">Last</button>
              </div>
            </div>
          </div>
        </form>

        <!-- 자체 테이블 -->
        <div class="flex-1 overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 sticky top-[calc(104px+224px)] z-10 shadow-sm">
              <tr class="text-left text-xs text-gray-500">
                <th class="px-3 py-2 w-12">등급</th>

                <th class="px-3 py-2 w-24">
                  팀
                  <button class="ml-1 text-[10px] text-gray-500 border rounded px-1 py-0.5"
                          @click="toggleSort('team')">
                    {{ sortKey==='team' ? (sortDir==='asc'?'▲':'▼') : '↕' }}
                  </button>
                </th>

                <th class="px-3 py-2">
                  이름
                  <button class="ml-1 text-[10px] text-gray-500 border rounded px-1 py-0.5"
                          @click="toggleSort('name')">
                    {{ sortKey==='name' ? (sortDir==='asc'?'▲':'▼') : '↕' }}
                  </button>
                </th>

                <th class="px-3 py-2 w-36">포지션</th>

                <th class="px-3 py-2 w-[28%]">
                  시너지
                  <button class="ml-1 text-[10px] text-gray-500 border rounded px-1 py-0.5"
                          @click="toggleSort('synergy')">
                    {{ sortKey==='synergy' ? (sortDir==='asc'?'▲':'▼') : '↕' }}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              <!-- 로딩 스켈레톤 -->
              <template v-if="isLoading">
                <tr v-for="i in 8" :key="'skeleton-'+i">
                  <td class="px-3 py-3"><div class="h-8 w-8 bg-gray-100 rounded animate-pulse"></div></td>
                  <td class="px-3 py-3"><div class="h-3 w-16 bg-gray-100 rounded animate-pulse mb-1"></div><div class="h-2 w-10 bg-gray-100 rounded animate-pulse"></div></td>
                  <td class="px-3 py-3"><div class="h-3 w-24 bg-gray-100 rounded animate-pulse mb-1"></div><div class="h-2 w-20 bg-gray-100 rounded animate-pulse"></div></td>
                  <td class="px-3 py-3"><div class="h-3 w-28 bg-gray-100 rounded animate-pulse"></div></td>
                  <td class="px-3 py-3"><div class="h-3 w-40 bg-gray-100 rounded animate-pulse"></div></td>
                </tr>
              </template>

              <template v-else>
                <tr v-for="row in paginatedPlayers" :key="row._id"
                    class="border-t hover:bg-white hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer
                           focus:ring-2 focus:ring-blue-300 focus:outline-none rounded"
                    @click="autoAssign(row)" @keydown.enter.prevent="autoAssign(row)" tabindex="0">
                  <!-- 등급 -->
                  <td class="px-3 py-2 align-top">
                    <img :src="gradeIcon(row.grade)" :alt="row.grade" class="w-8 h-8 object-contain select-none" />
                  </td>
                  <!-- 팀/연도 -->
                  <td class="px-3 py-2 align-top">
                    <span class="inline-flex items-center text-[11px] font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                      {{ row.team }}
                    </span>
                    <div class="text-[10px] text-gray-400 mt-0.5">{{ row.year }}</div>
                  </td>
                  <!-- 이름 -->
                  <td class="px-3 py-2 align-top">
                    <div class="font-semibold text-gray-900">{{ row.name }}</div>
                    <div class="text-[11px] text-gray-500">{{ row.battingHand || '-' }} / {{ row.throwHand || '-' }}</div>
                  </td>
                  <!-- 포지션 -->
                  <td class="px-3 py-2 align-top">
                    <div class="flex flex-wrap gap-1">
                      <span v-for="pos in toArray(row.position)" :key="pos"
                            class="px-1.5 py-0.5 rounded-full border text-[10px] text-gray-700 bg-white">
                        {{ pos }}
                      </span>
                    </div>
                  </td>
                  <!-- 시너지 -->
                  <td class="px-3 py-2 align-top">
                    <div class="line-clamp-2 text-[11px] text-gray-700">
                      <span v-for="tag in toArray(row.synergy)" :key="`${row._id}-${tag}`"
                            class="mr-1 inline-block px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                        {{ tag }}
                      </span>
                    </div>
                  </td>
                </tr>

                <!-- empty state -->
                <tr v-if="!paginatedPlayers.length">
                  <td colspan="5" class="px-3 py-12">
                    <div class="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <div class="text-sm font-medium text-gray-700 mb-1">조건에 맞는 선수가 없습니다</div>
                      <div class="text-xs text-gray-500">필터를 줄이거나 초기화해 보세요.</div>
                      <div class="mt-3">
                        <button class="px-2.5 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-50"
                                @click="resetFilters">
                          필터 초기화
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>

          <!-- 테이블 하단 바 -->
          <div class="sticky bottom-0 z-10 bg-white border-t border-gray-100 px-3 py-2 flex items-center gap-2">
            <span class="text-xs text-gray-500">페이지 {{ currentPage }} / {{ totalPages }}</span>
            <div class="ml-auto flex gap-1">
              <button type="button" class="px-2 py-1 border rounded" @click="goFirst" :disabled="currentPage===1" aria-label="첫 페이지">First</button>
              <button type="button" class="px-2 py-1 border rounded" @click="goPrev" :disabled="currentPage===1" aria-label="이전 페이지">Prev</button>
              <button type="button" class="px-2 py-1 border rounded" @click="goNext" :disabled="currentPage===totalPages" aria-label="다음 페이지">Next</button>
              <button type="button" class="px-2 py-1 border rounded" @click="goLast" :disabled="currentPage===totalPages" aria-label="마지막 페이지">Last</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ================= 중앙: 간결 슬롯 ================= -->
      <section class="rounded-2xl border border-gray-200 bg-white relative overflow-hidden flex-1 min-w-[760px] max-w-[980px] shadow-sm">
        <div class="p-4 border-b border-gray-100 bg-white/90 backdrop-blur sticky top-0 z-10 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700">라인업 배치</h3>
          <div class="text-xs text-gray-500">슬롯 카드를 클릭해 제거</div>
        </div>

        <div class="p-4 space-y-5">
          <!-- 타자 -->
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">외야</h4>
              <div class="grid grid-cols-3 gap-2">
                <SlotChip label="LF" :player="lineup.LF" @clear="clearSlot('LF')" />
                <SlotChip label="CF" :player="lineup.CF" @clear="clearSlot('CF')" />
                <SlotChip label="RF" :player="lineup.RF" @clear="clearSlot('RF')" />
              </div>
            </div>
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">내야</h4>
              <div class="grid grid-cols-5 gap-2">
                <SlotChip label="C"  :player="lineup.C"  @clear="clearSlot('C')"  />
                <SlotChip label="1B" :player="lineup['1B']" @clear="clearSlot('1B')" />
                <SlotChip label="2B" :player="lineup['2B']" @clear="clearSlot('2B')" />
                <SlotChip label="3B" :player="lineup['3B']" @clear="clearSlot('3B')" />
                <SlotChip label="SS" :player="lineup.SS" @clear="clearSlot('SS')" />
              </div>
            </div>
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">지타</h4>
              <div class="grid grid-cols-1 gap-2">
                <SlotChip label="DH" :player="lineup.DH" @clear="clearSlot('DH')" />
              </div>
            </div>
          </div>

          <div class="h-px bg-gray-100"></div>

          <!-- 투수 -->
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">선발</h4>
              <div class="grid grid-cols-5 gap-2">
                <TinySlot v-for="i in 5" :key="'SP'+i" :label="'SP'+i" :player="lineup['SP'+i]" @clear="clearSlot(('SP'+i) as any)" />
              </div>
            </div>
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">중간계투</h4>
              <div class="grid grid-cols-6 gap-2">
                <TinySlot v-for="i in 6" :key="'RP'+i" :label="'RP'+i" :player="lineup['RP'+i]" @clear="clearSlot(('RP'+i) as any)" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ================= 우측: 시너지(활성/비활성) ================= -->
      <section class="rounded-xl border border-gray-200 bg-white p-5 h-[calc(100vh-2.5rem)] overflow-y-auto min-w-[360px]">
        <div class="sticky top-0 pb-3 bg-white z-10">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">시너지 현황</h2>
            <div class="flex items-center gap-2 text-xs">
              <span class="px-2 py-1 rounded border border-emerald-200 text-emerald-700 bg-emerald-50">활성 {{ activeList.length }}</span>
              <span class="px-2 py-1 rounded border border-gray-200 text-gray-600 bg-gray-50">비활성 {{ inactiveList.length }}</span>
              <button class="px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-600" @click="reloadSynergy">재로드</button>
            </div>
          </div>
        </div>

        <!-- 활성 -->
        <h3 class="mt-2 mb-2 text-sm font-semibold text-emerald-700">활성 시너지</h3>
        <div v-if="!activeList.length" class="text-sm text-gray-500 mb-4">발동된 시너지가 없습니다.</div>
        <ul v-else class="space-y-3 mb-6">
          <li v-for="s in activeList" :key="s.name" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-600 text-white rounded">{{ s.name }}</span>
                <span class="text-xs text-emerald-800/80">({{ s.count }}명)</span>
              </div>
              <div class="text-xs text-emerald-800/70">{{ s.condText }}</div>
            </div>
            <div class="mt-2 text-xs">
              <span class="inline-block px-2 py-1 border bg-white text-emerald-700 border-emerald-300 rounded text-xs font-medium">
                {{ STAT_LABEL[s.chosen.stat] || s.chosen.stat }} +{{ s.chosen.bonus.value }}{{ s.chosen.bonus.unit==='percent'?'%':'' }}
              </span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1">
              <span v-for="n in s.appliesTo" :key="n" class="text-[11px] text-emerald-700 bg-white border border-emerald-200 rounded px-1.5 py-0.5">{{ n }}</span>
            </div>
          </li>
        </ul>

        <!-- 비활성 -->
        <h3 class="mb-2 text-sm font-semibold text-gray-700">비활성 / 인원 부족</h3>
        <div v-if="!inactiveList.length" class="text-sm text-gray-500">비활성 항목이 없습니다.</div>
        <ul v-else class="space-y-3">
          <li v-for="s in inactiveList" :key="s.name" class="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="inline-block px-2 py-0.5 text-xs font-semibold bg-gray-700 text-white rounded">{{ s.name }}</span>
                <span class="text-xs text-gray-600">({{ s.count }}명)</span>
              </div>
              <div class="text-xs text-gray-600">{{ s.nextText }}</div>
            </div>

            <div class="mt-2 h-2 rounded bg-white border border-gray-200 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-blue-400 to-indigo-500" :style="{ width: s.progress + '%' }"></div>
            </div>
            <div class="mt-1 text-[11px] text-gray-500">다음 단계까지 {{ s.needLeft }}명 부족 (목표 {{ s.nextNeed }}명)</div>

            <div class="mt-2 text-[12px] text-gray-700 italic">
              활성화 시: <span class="font-medium not-italic">{{ s.nextEffectTitle }}</span>
              <span v-if="s.nextEffectDesc" class="text-gray-500"> — {{ s.nextEffectDesc }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h, nextTick, watch, reactive } from 'vue'
import Papa from 'papaparse'

/* ===== 타입 ===== */
type Raw = Record<string, any>
type CountOp = '==' | '>=' | '<=' | '>' | '<' | 'between'
interface JsonBonus { unit: 'percent' | 'fixed'; value: number }
interface JsonCond  {
  count: (
    | { op: Exclude<CountOp,'between'>, value: number }
    | { op: 'between', min: number, max: number }
  ),
  stat: string,
  bonus: JsonBonus
}
interface JsonSynergy {
  id: number | string
  synergy: string
  synergy_effect?: string
  description?: string
  stackable?: boolean
  conditions: JsonCond[]
}
interface PlayerRow { _id: string }

/* ===== 상수/라벨 ===== */
const STAT_LABEL: Record<string, string> = {
  power: '파워', contact: '컨택', defense: '수비', running: '주루',
  control: '제구', movement: '무브먼트', stuff: '구위',
  longHitSuppression: '장타 억제', homeRunSuppression: '홈런 억제', runnerControl: '주자 억제'
}
const CSV_SPLIT = /[,\u3001;、]+/

/* ===== 유틸 ===== */
const lc = (s: unknown) => String(s ?? '').toLowerCase().trim()
const normText = (s: unknown) =>
  String(s ?? '')
    .normalize('NFKC')
    .replace(/\u200B|\u200C|\u200D|\u2060/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const toArray = (v: any, { allowComma = true }: { allowComma?: boolean } = {}) => {
  if (Array.isArray(v)) return v.map((x:any)=>String(x).trim()).filter(Boolean)
  const s = String(v ?? '').trim()
  if (!s) return []
  if (s.startsWith('[') && s.endsWith(']')) {
    try { const a = JSON.parse(s); return Array.isArray(a) ? a.map((x:any)=>String(x).trim()).filter(Boolean) : [] } catch {}
  }
  const splitter = allowComma ? CSV_SPLIT : /[\u3001;、;]+/
  return s.split(splitter).map(x=>x.replace(/^["']|["']$/g,'').trim()).filter(Boolean)
}
const gradeIcon = (g?: string) => g ? `/assets/grades/${String(g).toUpperCase()}.png` : '/assets/grades/UNKNOWN.png'

/* ===== 로딩 ===== */
const isLoading = ref(true)

/* ===== 데이터 로드 ===== */
const players = ref<Raw[]>([])
onMounted(loadCsv)
async function loadCsv() {
  try{
    const res = await fetch('/DB/sample_sorted.csv', { cache: 'no-store' })
    const text = await res.text()
    const out: Raw[] = []
    Papa.parse(text, { header:true, skipEmptyLines:true, complete: ({ data }) => { (data as Raw[]).forEach(r=>out.push(r)) } })
    players.value = out
    await nextTick()
    await loadSynergyOptions()
  } finally {
    isLoading.value = false
  }
}

/* ===== 검색 상태 ===== */
const q = reactive<{
  name: string
  search: string
  team: string[]
  year: string[]
  grade: string[]
  position: string[]
  skill: string[]
  enhancedSkill: string[]
  synergy: string[]
  rarity: number | null
}>({
  name: '',
  search: '',
  team: [],
  year: [],
  grade: [],
  position: [],
  skill: [],
  enhancedSkill: [],
  synergy: [],
  rarity: null
})

/* ===== 활성 필터 요약칩 ===== */
const activeChips = computed(() => {
  const chips: Array<{key:string,label:string,value:string,clear:()=>void}> = []
  const push = (key:string,label:string,val:any,clear:()=>void) => {
    if (val == null) return
    if (Array.isArray(val) && val.length===0) return
    const value = Array.isArray(val) ? val.join(', ') : String(val)
    if (!value) return
    chips.push({ key, label, value, clear })
  }
  push('name','이름', q.name, () => q.name = '')
  push('search','검색', q.search, () => q.search = '')
  push('team','팀', q.team, () => q.team = [])
  push('year','연도', q.year, () => q.year = [])
  push('grade','등급', q.grade, () => q.grade = [])
  push('position','포지션', q.position, () => q.position = [])
  push('skill','스킬', q.skill, () => q.skill = [])
  push('enhancedSkill','강화', q.enhancedSkill, () => q.enhancedSkill = [])
  push('synergy','시너지', q.synergy, () => q.synergy = [])
  if (q.rarity !== null) push('rarity','레어도', q.rarity, () => q.rarity = null)
  return chips
})

/* ===== 고급토글 ===== */
const advancedOpen = ref(false)

/* ===== 옵션 ===== */
const opts = computed(() => {
  const o: Record<string, Set<string>> = {
    team: new Set(), year: new Set(), grade: new Set(), position: new Set(), skill: new Set(), enhancedSkill: new Set(),
  }
  for (const p of players.value) {
    toArray(p.team).forEach(v => o.team.add(v))
    toArray(p.year).forEach(v => o.year.add(String(v)))
    toArray(p.grade).forEach(v => o.grade.add(v))
    toArray(p.position).forEach(v => o.position.add(v))
    toArray(p.skill).forEach(v => o.skill.add(v))
    toArray(p.enhancedSkill, { allowComma:false }).forEach(v => o.enhancedSkill.add(v))
  }
  return {
    team: [...o.team].sort(),
    year: [...o.year].sort((a,b)=>Number(a)-Number(b)),
    grade: [...o.grade].sort(),
    position: [...o.position].sort(),
    skill: [...o.skill].sort(),
    enhancedSkill: [...o.enhancedSkill].sort(),
  }
})

/* ===== 시너지 옵션 ===== */
const synergyOptions = ref<string[]>([])
async function loadSynergyOptions() {
  try {
    const res = await fetch('/DB/synergys.json', { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      const arr: string[] = Array.isArray(json)
        ? json.map((x: any) => (typeof x === 'string' ? x : x?.synergy)).filter(Boolean)
        : []
      synergyOptions.value = Array.from(new Set(arr.map(s => String(s).trim()))).sort((a,b)=>a.localeCompare(b))
      return
    }
  } catch {}
  const tokens: string[] = []
  for (const p of players.value) toArray(p.synergy).forEach(t => tokens.push(String(t)))
  synergyOptions.value = Array.from(new Set(tokens.map(s => s.trim()))).sort((a,b)=>a.localeCompare(b))
}

/* ===== 전처리 ===== */
type Prepared = {
  raw: Raw
  nameNorm: string
  teamLc: string[]
  skillLc: string[]
  enhancedSkillLc: string[]
  positionLc: string[]
  yearsNum: number[]
  synergyNormSet: Set<string>
}
const preparedPlayers = computed<Prepared[]>(() =>
  players.value.map(p => ({
    raw: p,
    nameNorm: normText(p.name),
    teamLc: toArray(p.team).map(lc),
    skillLc: toArray(p.skill).map(lc),
    enhancedSkillLc: toArray(p.enhancedSkill, { allowComma:false }).map(lc),
    positionLc: toArray(p.position).map(lc),
    yearsNum: toArray(p.year).map((n:any)=>Number(n)).filter((n:any)=>!Number.isNaN(n)),
    synergyNormSet: new Set(toArray(p.synergy).map(normText))
  }))
)

/* ===== 필터링 ===== */
const filteredPlayers = computed(() => {
  const tokens = q.search
    ? q.search.split(/[,\s]+/).map(t=>t.trim()).filter(Boolean).map(normText)
    : []

  return preparedPlayers.value
    .filter(({ raw: p, nameNorm, teamLc, positionLc, skillLc, enhancedSkillLc, yearsNum, synergyNormSet }) => {
      if (q.name && !nameNorm.includes(normText(q.name))) return false
      if (q.team.length && !q.team.some(t => teamLc.includes(lc(t)))) return false
      if (q.year.length && !q.year.every(y => yearsNum.includes(Number(y)))) return false
      if (q.grade.length && !q.grade.map(String).includes(String(p.grade))) return false
      if (q.rarity != null && Number(p.rarity) !== Number(q.rarity)) return false
      if (q.position.length && !q.position.every(v => positionLc.includes(lc(v)))) return false
      if (q.skill.length && !q.skill.every(v => skillLc.includes(lc(v)))) return false
      if (q.enhancedSkill.length && !q.enhancedSkill.every(v => enhancedSkillLc.includes(lc(v)))) return false
      if (q.synergy.length && !q.synergy.map(normText).every(t => synergyNormSet.has(t))) return false

      if (tokens.length) {
        const hay = new Set<string>([
          nameNorm, ...teamLc, ...positionLc, ...skillLc, ...Array.from(synergyNormSet), ...yearsNum.map(String)
        ])
        const ok = tokens.some(t => hay.has(t) || nameNorm.includes(t))
        if (!ok) return false
      }
      return true
    })
    .map(pp => ({ _id: String(pp.raw.id ?? `${pp.raw.name}-${pp.raw.team}-${pp.raw.year}`), ...pp.raw })) as (Raw & PlayerRow)[]
})

/* ===== 정렬 ===== */
const sortKey = ref<'name'|'team'|'synergy'|null>(null)
const sortDir = ref<'asc'|'desc'>('asc')
function toggleSort(k:any){
  if (sortKey.value!==k){ sortKey.value = k; sortDir.value = 'asc'; return }
  sortDir.value = (sortDir.value==='asc'?'desc':'asc')
}
const sortedPlayers = computed(() => {
  if (!sortKey.value) return filteredPlayers.value
  const dir = sortDir.value==='asc' ? 1 : -1
  return [...filteredPlayers.value].sort((a:any,b:any)=>{
    const getVal = (row:any) => {
      if (sortKey.value==='synergy') return toArray(row.synergy).join(', ')
      return (row[sortKey.value!] ?? '').toString()
    }
    const va = getVal(a), vb = getVal(b)
    return va.localeCompare(vb, undefined, { numeric:true, sensitivity:'base' }) * dir
  })
})

/* ===== 페이지네이션 ===== */
const pageSize = 20
const currentPage = ref(1)
watch(q, () => { currentPage.value = 1 }, { deep: true })
watch([sortKey, sortDir], () => { currentPage.value = 1 })

const total = computed(() => sortedPlayers.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const paginatedPlayers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return sortedPlayers.value.slice(start, start + pageSize)
})

function goFirst(){ currentPage.value = 1 }
function goPrev(){ if (currentPage.value>1) currentPage.value-- }
function goNext(){ if (currentPage.value<totalPages.value) currentPage.value++ }
function goLast(){ currentPage.value = totalPages.value }
function resetFilters(){
  q.name=''; q.search='';
  q.team=[]; q.year=[]; q.grade=[]; q.position=[]; q.skill=[]; q.enhancedSkill=[]; q.synergy=[];
  q.rarity=null;
  sortKey.value = null; sortDir.value = 'asc'
}

/* ===== 라인업/슬롯 ===== */
const lineup = ref({
  C:null,'1B':null,'2B':null,'3B':null,SS:null, LF:null,CF:null,RF:null,DH:null,
  SP1:null,SP2:null,SP3:null,SP4:null,SP5:null, RP1:null,RP2:null,RP3:null,RP4:null,RP5:null,RP6:null
} as Record<string, Raw|null>)
const SLOT_LABEL: Record<string,string> = { C:'포수','1B':'1루','2B':'2루','3B':'3루',SS:'유격',LF:'좌익',CF:'중견',RF:'우익',DH:'지타',SP:'선발',RP:'불펜' }
const isPitcher = (p: Raw) => /(^|\W)P(\W|$)|SP|RP/i.test(String(p.position ?? ''))
const clearSlot = (slot: keyof typeof lineup.value) => { lineup.value[slot] = null }
const assignToSlot = (slot: string|undefined, p: Raw) => {
  if (!slot) return
  if (slot === 'DH') {
    if (isPitcher(p)) { alert('DH에는 타자만 가능합니다.'); return }
  } else if (slot.startsWith('SP')) {
    if (!toArray(p.position).map(x=>x.toUpperCase()).includes('SP')) { alert('선발만 배치 가능'); return }
  } else if (slot.startsWith('RP')) {
    if (!toArray(p.position).map(x=>x.toUpperCase()).includes('RP')) { alert('불펜만 배치 가능'); return }
  } else {
    const ok = toArray(p.position).map(x=>x.toUpperCase()).includes(slot.toUpperCase())
    if (!ok) { alert(`${SLOT_LABEL[slot]} 슬롯에 배치 불가`); return }
  }
  Object.keys(lineup.value).forEach(k => { if (lineup.value[k]?.id === p.id) lineup.value[k] = null })
  lineup.value[slot] = p
}
const autoAssign = (p: Raw) => {
  if (!p) return
  Object.keys(lineup.value).forEach(k => { if (lineup.value[k]?.id === p.id) lineup.value[k] = null })
  const isPit = isPitcher(p)
  if (!isPit) {
    const order = ['C','1B','2B','3B','SS','LF','CF','RF','DH'] as const
    for (const k of order) {
      if (k === 'DH') { if (!isPit && !lineup.value[k]) { lineup.value[k] = p; return } }
      else if (toArray(p.position).map(x=>x.toUpperCase()).includes(k)) { if (!lineup.value[k]) { lineup.value[k] = p; return } }
    }
    alert('배치 가능한 타자 슬롯이 없습니다.')
  } else {
    const spOrder = ['SP1','SP2','SP3','SP4','SP5'] as const
    const rpOrder = ['RP1','RP2','RP3','RP4','RP5','RP6'] as const
    if (toArray(p.position).map(x=>x.toUpperCase()).includes('SP')) for (const k of spOrder) if (!lineup.value[k]) { lineup.value[k] = p; return }
    if (toArray(p.position).map(x=>x.toUpperCase()).includes('RP')) for (const k of rpOrder) if (!lineup.value[k]) { lineup.value[k] = p; return }
    alert('배치 가능한 투수 슬롯이 없습니다.')
  }
}

/* 슬롯 컴포넌트 (디자인 업그레이드 적용) */
const SlotChip = defineComponent({
  name: 'SlotChip',
  props: { label: { type:String, required:true }, player: { type: Object as ()=>Raw|null, default:null } },
  emits: ['clear'],
  setup: (props, { emit }) => () =>
    h('div', { class:'rounded-xl border border-gray-200 bg-white/80 backdrop-blur px-3 py-2 min-h-[64px] shadow-sm hover:shadow transition-shadow' }, [
      h('div', { class:'flex items-center justify-between gap-2' }, [
        h('span', { class:'text-xs font-semibold text-gray-700' }, props.label),
        props.player ? h('button', { class:'text-[10px] px-1.5 py-0.5 border border-gray-300/80 rounded hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors', onClick:()=>emit('clear') }, '제거') : null
      ]),
      props.player
        ? h('div', { class:'mt-1' }, [
            h('div', { class:'text-sm font-medium text-gray-800 truncate' }, String(props.player.name || '')),
            h('div', { class:'text-[11px] text-gray-500 truncate' }, `${props.player.team ?? ''} · ${props.player.position ?? ''}`),
          ])
        : h('div', { class:'text-[11px] text-gray-400 mt-1' }, '비어있음')
    ])
})
const TinySlot = defineComponent({
  name: 'TinySlot',
  props: { label: { type:String, required:true }, player:{ type:Object as ()=>Raw|null, default:null } },
  emits: ['clear'],
  setup: (props,{emit}) => () =>
    h('div', { class:'rounded-lg bg-white/80 border border-gray-200 px-2 py-1.5 min-h-[50px] shadow-sm hover:shadow transition-shadow' }, [
      h('div', { class:'text-[11px] font-semibold text-gray-700 mb-1' }, props.label),
      props.player
        ? h('div', { class:'text-[11px] flex items-center justify-between gap-2' }, [
            h('span', { class:'truncate font-medium text-gray-700' }, String(props.player.name||'')),
            h('button', { class:'text-[10px] px-1.5 py-0.5 border border-gray-300/80 rounded hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors', onClick:()=>emit('clear') }, '×')
          ])
        : h('div', { class:'text-[11px] text-gray-400' }, '비어있음')
    ])
})

/* ===== 시너지 계산 ===== */
const synergys = ref<JsonSynergy[]>([])
const reloadSynergy = async () => { try { await loadSynergy() } catch(e){ console.error(e); alert('시너지 파일 로드 실패') } }
async function loadSynergy() {
  const res = await fetch('/DB/synergys.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`synergy load: ${res.status}`)
  const json = await res.json()
  if (!Array.isArray(json)) throw new Error('synergys.json must be an array')
  synergys.value = json
}
onMounted(async () => { try { await loadSynergy() } catch(e){ console.error(e) } })

const lineupTags = computed(() => {
  const tags: string[] = []
  Object.keys(lineup.value).forEach(k => {
    const p = lineup.value[k]; if (!p) return
    toArray(p.synergy).forEach(t => tags.push(t.trim()))
  })
  return tags
})
function cmp(op: CountOp, lhs: number, rhsOrMin?: number, max?: number) {
  if (op==='==') return lhs === (rhsOrMin ?? 0)
  if (op=== '>=') return lhs >= (rhsOrMin ?? 0)
  if (op=== '<=') return lhs <= (rhsOrMin ?? 0)
  if (op===  '>') return lhs >  (rhsOrMin ?? 0)
  if (op===  '<') return lhs <  (rhsOrMin ?? 0)
  if (op==='between') return lhs >= (rhsOrMin ?? 0) && lhs <= (max ?? Number.POSITIVE_INFINITY)
  return false
}
const synergyIndex = computed(() => {
  const index = new Map<string, {
    count: number, chosen: JsonCond|null, condText: string|null,
    appliesTo: string[], next: { cond: JsonCond, need: number, text: string } | null, synergy: JsonSynergy
  }>()
  const tags = lineupTags.value.map(t => t.trim())
  for (const s of synergys.value) {
    const name = String(s.synergy).trim()
    const count = tags.filter(t => t === name).length
    const all = s.conditions.map(c => {
      const isBetween = 'op' in c.count && c.count.op==='between'
      const upper = isBetween ? (c.count as any).max : (c.count as any).value
      const lower = isBetween ? (c.count as any).min : (c.count as any).value
      const text  = isBetween ? `between ${lower}~${upper}명` : `${(c.count as any).op} ${upper}명`
      return { raw:c, upper:Number(upper ?? 0), text }
    }).sort((a,b)=>a.upper-b.upper)
    const matched = all.filter(({raw}) => {
      const c:any = raw.count
      return c.op==='between' ? cmp('between', count, c.min, c.max) : cmp(c.op, count, c.value)
    })
    let chosen: JsonCond|null = null, condText: string|null = null
    if (matched.length) { matched.sort((a,b)=>(b.upper-a.upper) || ((b.raw.bonus.value??0)-(a.raw.bonus.value??0))); chosen = matched[0].raw; condText = matched[0].text }
    const bigger = all.find(c => count < c.upper) || null
    const next = bigger ? { cond:bigger.raw, need:bigger.upper, text:bigger.text } : null
    const appliesTo = chosen
      ? (Object.values(lineup.value).filter(Boolean) as Raw[])
          .filter(p => toArray(p.synergy).map(t=>t.trim()).includes(name))
          .map(p => String(p.name||''))
      : []
    index.set(name, { count, chosen, condText, appliesTo, next, synergy: s })
  }
  return index
})
const activeList = computed(() => {
  const out: Array<{ name:string, count:number, chosen:JsonCond, appliesTo:string[], condText:string }> = []
  for (const [name, rec] of synergyIndex.value.entries()) if (rec.chosen)
    out.push({ name, count:rec.count, chosen:rec.chosen, appliesTo:rec.appliesTo, condText:rec.condText! })
  return out.sort((a,b)=> (b.chosen.bonus.value??0) - (a.chosen.bonus.value??0))
})
const inactiveList = computed(() => {
  const out: Array<{name:string,count:number,nextNeed:number,needLeft:number,progress:number,nextText:string,nextEffectTitle:string,nextEffectDesc?:string}> = []
  for (const [name, rec] of synergyIndex.value.entries()) {
    if (rec.chosen || !rec.next) continue
    const nextNeed = rec.next.need
    const needLeft = Math.max(0, nextNeed - rec.count)
    const maxNeed = rec.synergy.conditions.reduce((m,c)=>{
      const isBetween = 'op' in c.count && c.count.op==='between'
      const u = isBetween ? (c.count as any).max : (c.count as any).value
      return Math.max(m, Number(u ?? 0))
    }, nextNeed)
    const progress = Math.max(0, Math.min(100, Math.round((rec.count / maxNeed) * 100)))
    const stat = rec.next.cond.stat, bonus = rec.next.cond.bonus
    const title = `${STAT_LABEL[stat] || stat} +${bonus.value}${bonus.unit==='percent'?'%':''}`
    const desc  = rec.synergy.synergy_effect || rec.synergy.description || ''
    out.push({ name, count:rec.count, nextNeed, needLeft, progress, nextText:`다음 단계: ${nextNeed}명 필요`, nextEffectTitle:title, nextEffectDesc: desc || undefined })
  }
  return out.sort((a,b)=>a.needLeft-b.needLeft)
})
</script>

<style scoped>
button:disabled { opacity:.5; cursor:not-allowed; }
</style>
