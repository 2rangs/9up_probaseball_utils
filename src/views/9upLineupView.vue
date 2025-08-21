<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h, nextTick, watch, reactive } from 'vue'
import Papa from 'papaparse'
import { Star, Search, Filter, ChevronLeft, ChevronRight, Users, ChevronRight as ChevronRightIcon } from 'lucide-vue-next'

/* =========================
   타입 정의
========================= */
type Raw = Record<string, any>
type CountOp = '==' | '>=' | '<=' | '>' | '<' | 'between'

interface JsonBonus { unit: 'percent' | 'fixed'; value: number }
interface JsonCond  {
  count: (
      | { op: Exclude<CountOp,'between'>, value: number }
      | { op: 'between', min: number, max: number }
      ),
  stat: string
  bonus: JsonBonus
}
interface JsonSynergy {
  id: number | string
  synergy: string
  synergy_effect?: string
  description?: string
  stackable?: boolean
  conditions: JsonCond[]
  group?: {
    family?: string
    tier?: number
    inherit_lower_tiers?: boolean
    stack_mode?: 'cumulative' | 'max' | 'cumulative_dedup'
  }
}
interface PlayerRow { _id: string }
interface TeamHistory { key: string; name: string; logo: string }
interface TeamSetting { id: number|string; key: string; name: string; history: TeamHistory[] }

/* =========================
   상수
========================= */
const STAT_LABELS: Record<string, string> = {
  power: '파워', contact: '컨택', defense: '수비', running: '주루',
  control: '제구', movement: '무브먼트', stuff: '구위',
  longHitSuppression: '장타 억제', homeRunSuppression: '홈런 억제', runnerControl: '주자 억제'
}
const POSITION_ALIASES: Record<string, string> = {
  'b1': '1B', '1b': '1B', '1': '1B', '1루': '1B',
  'b2': '2B', '2b': '2B', '2': '2B', '2루': '2B',
  'b3': '3B', '3b': '3B', '3': '3B', '3루': '3B',
  'c': 'C', '포': 'C',
  'ss': 'SS', '유격': 'SS',
  'lf': 'LF', '좌익': 'LF',
  'cf': 'CF', '중견': 'CF',
  'rf': 'RF', '우익': 'RF',
  'sp': 'SP', '선발': 'SP',
  'rp': 'RP', '불펜': 'RP',
  'dh': 'DH', '지타': 'DH',
}
const CSV_SPLIT = /[,\u3001;、]+/

/* =========================
   유틸
========================= */
const normalizeText = (text: unknown): string =>
    String(text ?? '')
        .normalize('NFKC')
        .replace(/\u200B|\u200C|\u200D|\u2060/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()

const toLowerCase = (s: unknown): string => String(s ?? '').toLowerCase().trim()

const toArray = (value: any, { allowComma = true }: { allowComma?: boolean } = {}): string[] => {
  if (Array.isArray(value)) return value.map(x => String(x).trim()).filter(Boolean)
  const str = String(value ?? '').trim()
  if (!str) return []
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str)
      return Array.isArray(parsed) ? parsed.map(x => String(x).trim()).filter(Boolean) : []
    } catch {}
  }
  const splitter = allowComma ? CSV_SPLIT : /[\u3001;、;]+/
  return str.split(splitter).map(x => x.replace(/^["']|["']$/g,'').trim()).filter(Boolean)
}

const normalizePosition = (position: any): string => {
  const str = String(position ?? '').trim()
  if (!str) return ''
  const lower = str.toLowerCase()
  return POSITION_ALIASES[lower] ?? str.toUpperCase()
}

/* =========================
   반응형 상태
========================= */
const isLoading = ref(true)
const players = ref<Raw[]>([])
const synergys = ref<JsonSynergy[]>([])
const teamData = ref<TeamSetting[]>([])
const synergyOptions = ref<string[]>([])

const searchQuery = reactive({
  search: '',
  position: [] as string[],
  team: [] as string[],
  synergy: [] as string[],
  rarity: null as number | null
})

const advancedFilterOpen = ref(false)
const currentPage = ref(1)
const pageSize = 50

const lineup = ref({
  C: null, '1B': null, '2B': null, '3B': null, SS: null,
  LF: null, CF: null, RF: null, DH: null,
  SP1: null, SP2: null, SP3: null, SP4: null, SP5: null,
  RP1: null, RP2: null, RP3: null, RP4: null, RP5: null, RP6: null,
  BENCH1: null, BENCH2: null, BENCH3: null, BENCH4: null,
  BENCH5: null, BENCH6: null, BENCH7: null, BENCH8: null
} as Record<string, Raw | null>)

/* =========================
   로딩
========================= */
const loadPlayerData = async () => {
  const response = await fetch('/DB/sample_sorted.csv', { cache: 'no-store' })
  const csvText = await response.text()
  const result: Raw[] = []
  Papa.parse(csvText, {
    header: true, skipEmptyLines: true,
    complete: ({ data }) => (data as Raw[]).forEach(row => result.push(row))
  })
  players.value = result
  await nextTick()
  await loadSynergyOptions()
}

const loadSynergyData = async () => {
  const response = await fetch('/DB/test.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(`Synergy load failed: ${response.status}`)
  const json = await response.json()
  synergys.value = (Array.isArray(json) ? json : [])
      .filter((it: any) => Array.isArray(it?.conditions) && it.conditions.length > 0)
      .map((it: any) => ({
        ...it,
        conditions: it.conditions.filter((c: any) => c && c.count && c.bonus)
      }))
}

const loadTeamData = async () => {
  const response = await fetch('/DB/setting.json', { cache: 'no-store' })
  if (!response.ok) throw new Error(`setting.json ${response.status}`)
  const json = await response.json()
  teamData.value = Array.isArray(json) ? (json as TeamSetting[]) : []
}

const loadSynergyOptions = async () => {
  try {
    const response = await fetch('/DB/synergys.json', { cache: 'no-store' })
    if (response.ok) {
      const json = await response.json()
      const options: string[] = Array.isArray(json)
          ? json.map((item: any) => (typeof item === 'string' ? item : item?.synergy)).filter(Boolean)
          : []
      synergyOptions.value = Array.from(new Set(options.map(s => String(s).trim()))).sort((a,b)=>a.localeCompare(b))
      return
    }
  } catch {}
  const tokens: string[] = []
  for (const p of players.value) toArray(p.synergy).forEach(t => tokens.push(String(t)))
  synergyOptions.value = Array.from(new Set(tokens.map(s => s.trim()))).sort((a,b)=>a.localeCompare(b))
}

/* =========================
   팀 유틸
========================= */
const findTeamLogo = (teamKey: string): string | null => {
  for (const team of teamData.value) {
    for (const history of team.history) {
      if (history.key === teamKey) return history.logo
    }
  }
  return null
}
const findTeamName = (teamKeyOrName: string): string => {
  const key = String(teamKeyOrName ?? '')
  for (const team of teamData.value) {
    if (team.key === key) return team.name
    for (const h of team.history) {
      if (h.key === key || h.name === key) return h.name
    }
  }
  return key
}
const getTeamLogoUrl = (teamKey: string): string => findTeamLogo(teamKey) ?? '/assets/logos/teams/unknown.png'

/* =========================
   전처리/검색
========================= */
interface PreparedPlayer {
  raw: Raw
  nameNormalized: string
  teamLowerCase: string[]
  positionLowerCase: string[]
  yearsNumeric: number[]
  synergyNormalizedSet: Set<string>
}
const preparedPlayers = computed<PreparedPlayer[]>(() =>
    players.value.map(player => ({
      raw: player,
      nameNormalized: normalizeText(player.name),
      teamLowerCase: toArray(player.team).map(toLowerCase),
      positionLowerCase: toArray(player.position).map(toLowerCase),
      yearsNumeric: toArray(player.year).map((y:any)=>Number(y)).filter((y:any)=>!Number.isNaN(y)),
      synergyNormalizedSet: new Set(toArray(player.synergy).map(normalizeText))
    }))
)

const searchOptions = computed(() => {
  const o: Record<string, Set<string>> = { team: new Set(), position: new Set() }
  for (const p of players.value) {
    toArray(p.team).forEach(v => o.team.add(v))
    toArray(p.position).forEach(v => o.position.add(v))
  }
  return { team: [...o.team].sort(), position: [...o.position].sort() }
})

const filteredPlayers = computed(() => {
  const tokens = searchQuery.search
      ? searchQuery.search.split(/[,\s]+/).map(t=>t.trim()).filter(Boolean).map(normalizeText)
      : []
  return preparedPlayers.value
      .filter(({ raw: p, nameNormalized, teamLowerCase, positionLowerCase, yearsNumeric, synergyNormalizedSet }) => {
        if (searchQuery.team.length && !searchQuery.team.some(t => teamLowerCase.includes(toLowerCase(t)))) return false
        if (searchQuery.rarity != null && Number(p.rarity) !== Number(searchQuery.rarity)) return false
        if (searchQuery.position.length && !searchQuery.position.every(v => positionLowerCase.includes(toLowerCase(v)))) return false
        if (searchQuery.synergy.length && !searchQuery.synergy.map(normalizeText).every(t => synergyNormalizedSet.has(t))) return false
        if (tokens.length) {
          const hay = new Set<string>([
            nameNormalized, ...teamLowerCase, ...positionLowerCase,
            ...Array.from(synergyNormalizedSet), ...yearsNumeric.map(String)
          ])
          const ok = tokens.some(t => hay.has(t) || nameNormalized.includes(t))
          if (!ok) return false
        }
        return true
      })
      .map(pp => ({ _id: String(pp.raw.id ?? `${pp.raw.name}-${pp.raw.team}-${pp.raw.year}`), ...pp.raw })) as (Raw & PlayerRow)[]
})

watch(searchQuery, () => { currentPage.value = 1 }, { deep: true })
const totalPlayers = computed(() => filteredPlayers.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalPlayers.value / pageSize)))
const paginatedPlayers = computed(() => filteredPlayers.value.slice((currentPage.value-1)*pageSize, (currentPage.value)*pageSize))
const goToPage = (page:number) => { if (page>=1 && page<=totalPages.value) currentPage.value = page }
const resetFilters = () => { searchQuery.search=''; searchQuery.team=[]; searchQuery.position=[]; searchQuery.synergy=[]; searchQuery.rarity=null }

/* =========================
   라인업 관리
========================= */
const isPitcher = (p: Raw) => {
  const positions = toArray(p.position).map(normalizePosition)
  return positions.includes('SP') || positions.includes('RP')
}
const clearLineupSlot = (slot: string) => { lineup.value[slot] = null }

const assignPlayerToSlot = (slot: string, p: Raw) => {
  if (!slot || !p) return
  let posList: string[] = []
  try {
    const parsed = typeof p.position === 'string' ? JSON.parse(p.position) : p.position
    posList = (Array.isArray(parsed) ? parsed : toArray(p.position)).map(normalizePosition).filter(Boolean)
  } catch {
    posList = toArray(p.position).map(normalizePosition).filter(Boolean)
  }
  const s = normalizePosition(slot)

  // 중복 제거
  Object.keys(lineup.value).forEach(k => { if (lineup.value[k]?.id === p.id) lineup.value[k] = null })

  if (s === 'DH') {
    if (isPitcher(p)) return alert('DH에는 타자만 배치할 수 있습니다.')
    lineup.value['DH'] = p
  } else if (s === 'SP') {
    if (!posList.includes('SP')) return alert('선발 투수만 배치할 수 있습니다.')
    const spSlots = ['SP1','SP2','SP3','SP4','SP5'] as const
    const empty = spSlots.find(slot => !lineup.value[slot]); if (empty) lineup.value[empty] = p; else alert('모든 선발 슬롯이 가득 찼습니다.')
  } else if (s === 'RP') {
    if (!posList.includes('RP')) return alert('중계/마무리 투수만 배치할 수 있습니다.')
    const rpSlots = ['RP1','RP2','RP3','RP4','RP5','RP6'] as const
    const empty = rpSlots.find(slot => !lineup.value[slot]); if (empty) lineup.value[empty] = p; else alert('모든 중계 슬롯이 가득 찼습니다.')
  } else if (s.startsWith('SP')) {
    if (!posList.includes('SP')) return alert('선발 투수만 배치할 수 있습니다.')
    lineup.value[s] = p
  } else if (s.startsWith('RP')) {
    if (!posList.includes('RP')) return alert('중계/마무리 투수만 배치할 수 있습니다.')
    lineup.value[s] = p
  } else if (s.startsWith('BENCH')) {
    lineup.value[s] = p
  } else {
    if (!posList.includes(s)) return alert(`${s} 슬롯에 배치할 수 없습니다. (선수 포지션: ${posList.join(', ')})`)
    lineup.value[s] = p
  }
}

const autoAssignPlayer = (p: Raw) => {
  if (!p) return
  Object.keys(lineup.value).forEach(k => { if (lineup.value[k]?.id === p.id) lineup.value[k] = null })
  const posList = (() => {
    try {
      const parsed = typeof p.position === 'string' ? JSON.parse(p.position) : p.position
      return (Array.isArray(parsed) ? parsed : toArray(p.position)).map(normalizePosition).filter(Boolean)
    } catch { return toArray(p.position).map(normalizePosition).filter(Boolean) }
  })()
  const isPit = posList.includes('SP') || posList.includes('RP')
  if (!isPit) {
    const order = ['C','1B','2B','3B','SS','LF','CF','RF','DH'] as const
    for (const k of order) {
      if (k==='DH') { if (!lineup.value[k]) { lineup.value[k]=p; return } }
      else if (posList.includes(k)) { if (!lineup.value[k]) { lineup.value[k]=p; return } }
    }
    assignToBench(p)
  } else {
    const spOrder = ['SP1','SP2','SP3','SP4','SP5'] as const
    const rpOrder = ['RP1','RP2','RP3','RP4','RP5','RP6'] as const
    if (posList.includes('SP')) for (const k of spOrder) { if (!lineup.value[k]) { lineup.value[k]=p; return } }
    if (posList.includes('RP')) for (const k of rpOrder) { if (!lineup.value[k]) { lineup.value[k]=p; return } }
    assignToBench(p)
  }
}
const assignToBench = (p: Raw) => {
  if (!p) return
  Object.keys(lineup.value).forEach(k => { if (lineup.value[k]?.id === p.id) lineup.value[k] = null })
  const bench = ['BENCH1','BENCH2','BENCH3','BENCH4','BENCH5','BENCH6','BENCH7','BENCH8'] as const
  for (const k of bench) { if (!lineup.value[k]) { lineup.value[k]=p; return } }
  alert('모든 벤치 슬롯이 가득 찼습니다.')
}

/* =========================
   시너지 계산
========================= */
const compareCondition = (op: CountOp, lhs: number, rhs?: number, max?: number): boolean => {
  if (op==='==') return lhs === (rhs ?? 0)
  if (op=== '>=') return lhs >= (rhs ?? 0)
  if (op=== '<=') return lhs <= (rhs ?? 0)
  if (op===  '>') return lhs >  (rhs ?? 0)
  if (op===  '<') return lhs <  (rhs ?? 0)
  if (op==='between') return lhs >= (rhs ?? 0) && lhs <= (max ?? Number.POSITIVE_INFINITY)
  return false
}

const synergyMetadata = computed(() => {
  const m = new Map<string, { family?: string; tier?: number }>()
  for (const s of synergys.value) {
    const g = (s as any)?.group ?? {}
    const tier = Number.isFinite(Number(g.tier)) ? Number(g.tier) : undefined
    m.set(String(s.synergy).trim(), { family: g.family, tier })
  }
  return m
})

const checkSynergyInclusion = (target: string, playerSynergies: string[]) => {
  const meta = synergyMetadata.value
  const key = String(target ?? '').trim()
  const t = meta.get(key)
  // group 기준
  if (t?.family && typeof t.tier === 'number') {
    for (const ps of playerSynergies) {
      const pm = meta.get(String(ps).trim())
      if (pm?.family === t.family && typeof pm.tier === 'number' && pm.tier >= t.tier) return true
    }
  }
  // 텍스트 휴리스틱
  const clean = (x:string)=>String(x??'').normalize('NFKC').replace(/\u200B|\u200C|\u200D|\u2060/g,'').replace(/[,\s]/g,'').trim()
  if (playerSynergies.some(s => clean(s)===clean(key))) return true
  const tm = clean(key).match(/(\D*)(\d+)(\D*)/); if (!tm) return false
  const [,tp,tn,ts] = tm
  if (tn.length===4 || tp.includes('동명이인') || ts.includes('동명이인')) return false
  const tnum = parseInt(tn,10)
  return playerSynergies.some(s => {
    const sm = clean(s).match(/(\D*)(\d+)(\D*)/); if (!sm) return false
    const [,pp,pn,ps] = sm
    if (pn.length===4 || pp.includes('동명이인') || ps.includes('동명이인')) return false
    return pp===tp && ps===ts && parseInt(pn,10)>=tnum
  })
}

const synergyIndex = computed(() => {
  const index = new Map<string, {
    count: number
    activated: JsonCond[]
    conditionTexts: string[]
    topCondition?: JsonCond | null
    qualifiedPlayers: string[]
    nextCondition: { condition: JsonCond, required: number, text: string } | null
    synergy: JsonSynergy
  }>()
  const lineupPlayers = Object.values(lineup.value).filter(Boolean) as Raw[]

  for (const s of synergys.value) {
    const name = String(s.synergy).trim()
    const qualified = lineupPlayers.filter(p => checkSynergyInclusion(name, toArray(p.synergy).map(t=>t.trim())))
    const count = qualified.length

    const all = (s.conditions||[])
        .map(c=>{
          const isBetween = c.count.op==='between'
          const upper = isBetween ? (c.count as any).max : (c.count as any).value
          const lower = isBetween ? (c.count as any).min : (c.count as any).value
          const text  = isBetween ? `${lower}~${upper}명` : `${upper}명 이상`
          return { raw:c, upper:Number(upper??0), text }
        })
        .sort((a,b)=>a.upper-b.upper)

    const matched = all.filter(({raw})=>{
      const c:any = raw.count
      return c?.op==='between'
          ? compareCondition('between', count, c.min, c.max)
          : compareCondition(c?.op as CountOp, count, c?.value)
    })

    const activated = matched.map(m=>m.raw)
    const conditionTexts = matched.map(m=>m.text)
    const top = matched.length
        ? matched.slice().sort((a,b)=>(b.upper-a.upper)||((b.raw.bonus.value??0)-(a.raw.bonus.value??0)))[0].raw
        : null

    const bigger = all.find(c => count < c.upper) || null
    const nextCondition = bigger ? { condition: bigger.raw, required: bigger.upper, text: `${bigger.upper}명 필요` } : null

    index.set(name, {
      count,
      activated,
      conditionTexts,
      topCondition: top,
      qualifiedPlayers: qualified.map(p=>String(p.name||'')),
      nextCondition,
      synergy: s
    })
  }
  return index
})

const activeSynergyList = computed(() => {
  type Rec = {
    name: string
    count: number
    activeCondition: JsonCond | null
    conditionText?: string
    appliedPlayers: string[]
    synergy: JsonSynergy
    isInherited?: boolean
    impliedChildren?: Array<{name:string; count:number}>
  }

  const self: Rec[] = []
  for (const [name, rec] of synergyIndex.value.entries()) {
    if (!rec.activated.length) continue
    rec.activated.forEach((cond, i) => {
      self.push({
        name, count: rec.count, activeCondition: cond, conditionText: rec.conditionTexts[i],
        appliedPlayers: rec.qualifiedPlayers.slice(), synergy: rec.synergy, isInherited: false
      })
    })
  }

  // family grouping
  const families = new Map<string, JsonSynergy[]>()
  for (const s of synergys.value) {
    const fam = (s as any)?.group?.family
    if (!fam) continue
    if (!families.has(fam)) families.set(fam, [])
    families.get(fam)!.push(s)
  }
  for (const [, list] of families) list.sort((a,b)=>Number((b as any)?.group?.tier??0)-Number((a as any)?.group?.tier??0))

  const byFamily = new Map<string, Rec[]>()
  const noFamily: Rec[] = []
  for (const r of self) {
    const fam = (r.synergy as any)?.group?.family
    if (!fam) noFamily.push(r)
    else {
      if (!byFamily.has(fam)) byFamily.set(fam, [])
      byFamily.get(fam)!.push(r)
    }
  }

  const out: Rec[] = [...noFamily]
  for (const [fam, list] of byFamily.entries()) {
    const members = families.get(fam) || []
    const mode: 'cumulative'|'max'|'cumulative_dedup' = ((members[0] as any)?.group?.stack_mode) ?? 'cumulative'
    const inherit = !!(members[0] as any)?.group?.inherit_lower_tiers
    const sorted = list.slice().sort((a,b)=>Number((b.synergy as any)?.group?.tier??0)-Number((a.synergy as any)?.group?.tier??0))
    const awarded = new Set<string>()

    const pushByMode = (r: Rec) => {
      if (mode==='max') {
        if (!out.some(x => (x.synergy as any)?.group?.family===fam)) out.push({...r, appliedPlayers: r.appliedPlayers.slice()})
        return
      }
      if (mode==='cumulative') { out.push({...r, appliedPlayers: r.appliedPlayers.slice()}); return }
      // cumulative_dedup
      const uniq = r.appliedPlayers.filter(n=>!awarded.has(n))
      out.push({...r, appliedPlayers: uniq})
      uniq.forEach(n=>awarded.add(n))
    }

    sorted.forEach(pushByMode)

    if (inherit && sorted.length>0) {
      const activeNames = new Set(sorted.map(r=>r.name))
      const implied: Array<{name:string;count:number}> = []
      for (const m of members) {
        const nm = String(m.synergy).trim()
        if (activeNames.has(nm)) continue
        const rec = synergyIndex.value.get(nm)
        if (!rec) continue
        implied.push({ name: nm, count: rec.count })
      }
      // 마지막(최상위) 항목에 붙여서 표시
      if (out.length && implied.length) {
        const lastIdx = out.length-1
        out[lastIdx] = { ...out[lastIdx], impliedChildren: implied }
      }
    }
  }

  out.sort((a,b)=>{
    const av = a.activeCondition?.bonus.value ?? 0
    const bv = b.activeCondition?.bonus.value ?? 0
    if (!!a.isInherited !== !!b.isInherited) return a.isInherited ? 1 : -1
    return bv-av
  })
  return out
})

const inactiveSynergyList = computed(() => {
  const out: Array<{
    name: string
    count: number
    requiredCount: number
    remainingCount: number
    progress: number
    nextText: string
    nextEffectDescription: string
  }> = []
  for (const [name, rec] of synergyIndex.value.entries()) {
    if (rec.activated.length || !rec.nextCondition?.condition) continue
    const need = rec.nextCondition.required
    const left = Math.max(0, need - rec.count)
    const maxNeed = (rec.synergy.conditions||[]).reduce((m,c)=>{
      const b = c.count.op==='between'
      const u = b ? (c.count as any).max : (c.count as any).value
      return Math.max(m, Number(u ?? 0))
    }, need)
    const progress = Math.max(0, Math.min(100, Math.round((rec.count/Math.max(1,maxNeed))*100)))
    const stat = rec.nextCondition.condition.stat
    const bonus = rec.nextCondition.condition.bonus
    const title = `${STAT_LABELS[stat] || stat} +${bonus.value}${bonus.unit==='percent'?'%':''}`
    out.push({
      name, count: rec.count, requiredCount: need, remainingCount: left,
      progress, nextText: rec.nextCondition.text, nextEffectDescription: title
    })
  }
  return out.sort((a,b)=>a.remainingCount-b.remainingCount)
})

const getPlayerSynergyInfo = (player: Raw) => {
  if (!player?.synergy) return []
  const playerSynergies = toArray(player.synergy).map(s => s.trim())
  const info: Array<{name:string; isActive:boolean; effectText:string; count:number; description:string}> = []
  for (const nm of playerSynergies) {
    const rec = synergyIndex.value.get(nm)
    if (!rec) continue
    const isActive = rec.activated.length > 0
    const effectText = isActive && rec.topCondition
        ? `${STAT_LABELS[rec.topCondition.stat] || rec.topCondition.stat} +${rec.topCondition.bonus.value}${rec.topCondition.bonus.unit==='percent' ? '%' : ''}`
        : rec.nextCondition ? rec.nextCondition.text : '조건 없음'
    info.push({ name: nm, isActive, effectText, count: rec.count, description: rec.synergy.description || '' })
  }
  return info
}

/* =========================
   라이프사이클
========================= */
onMounted(async () => {
  isLoading.value = true
  try {
    await Promise.all([loadPlayerData(), loadSynergyData(), loadTeamData()])
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
})

/* =========================
   로컬 컴포넌트: LineupSlot
   (템플릿에서 <LineupSlot .../> 로 사용)
========================= */
const LineupSlot = defineComponent({
  name: 'LineupSlot',
  props: {
    pos: { type: String, required: true },
    p: { type: Object as () => Raw | null, default: null },
    getInfo: { type: Function as () => (p: Raw) => any[], required: true }
  },
  emits: ['clear'],
  setup(props, { emit }) {
    return () => {
      const rootCls = 'rounded-xl border border-neutral-200 p-3'
      if (!props.p) {
        return h('div', { class: rootCls }, [
          h('div', { class: 'mb-2 text-xs font-medium text-neutral-700' }, props.pos),
          h('div', { class: 'text-sm italic text-neutral-400' }, '비어있음')
        ])
      }
      const p = props.p as Raw
      const infos = (props.getInfo(p) || []).filter((s:any)=>s.isActive).slice(0,1)
      return h('div', { class: rootCls }, [
        h('div', { class: 'mb-2 text-xs font-medium text-neutral-700' }, props.pos),
        h('div', { class: 'text-sm font-semibold text-neutral-900 truncate' }, p.name),
        h('div', { class: 'mb-2 text-xs text-neutral-500' }, `${p.team}${p.year ? ` (${p.year})` : ''}`),
        ...infos.map((s:any)=> h('div', {
          key: s.name,
          class: 'mb-2 inline-block rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-800'
        }, s.effectText)),
        h('button', {
          class: 'text-[11px] text-red-600 underline underline-offset-2',
          onClick: () => emit('clear')
        }, '제거')
      ])
    }
  }
})
</script>

<template>
  <div class=" bg-neutral-50">
    <div class="mx-auto max-w-[1400px] px-6 py-8">
      <!-- 로딩 -->
      <div v-if="isLoading" class="flex h-[60vh] items-center justify-center">
        <div class="text-center">
          <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900"></div>
          <p class="text-sm text-neutral-500">데이터를 불러오는 중…</p>
        </div>
      </div>

      <!-- 메인 -->
      <div v-else class="grid grid-cols-12 gap-6">
        <!-- 좌측: 검색 -->
        <section class="col-span-4 flex max-h-full flex-col rounded-2xl bg-white ring-1 ring-neutral-200/70">
          <header class="px-5 py-4 border-b border-neutral-100">
            <div class="flex items-center justify-between">
              <h1 class="text-base font-semibold tracking-tight text-neutral-900">선수 검색</h1>
              <span class="text-xs text-neutral-500">{{ totalPlayers.toLocaleString() }}명</span>
            </div>
          </header>

          <div class="border-b border-neutral-100 p-4">
            <div class="relative">
              <input
                  v-model.trim="searchQuery.search"
                  type="text"
                  placeholder="이름, 팀, 포지션, 시너지…"
                  class="w-full rounded-xl border border-neutral-200 bg-neutral-50/60 px-4 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 outline-none focus:border-neutral-300 focus:ring-0"
              />
              <Search class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            </div>

            <button
                @click="advancedFilterOpen = !advancedFilterOpen"
                class="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <span class="inline-flex items-center gap-2">
                <Filter class="h-4 w-4" />
                상세 필터
              </span>
              <span class="inline-flex items-center gap-2">
                <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">
                  {{ [searchQuery.position.length, searchQuery.team.length, searchQuery.synergy.length, searchQuery.rarity ? 1 : 0].reduce((a,b)=>a+b,0) }}
                </span>
                <ChevronRightIcon :class="advancedFilterOpen ? 'rotate-90' : ''" class="h-4 w-4 transition-transform" />
              </span>
            </button>

            <div v-if="advancedFilterOpen" class="mt-3 grid grid-cols-2 gap-3">
              <div class="col-span-1">
                <label class="mb-1 block text-xs font-medium text-neutral-500">포지션</label>
                <select v-model="searchQuery.position" multiple class="h-24 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm focus:border-neutral-300 focus:ring-0">
                  <option v-for="p in searchOptions.position" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="col-span-1">
                <label class="mb-1 block text-xs font-medium text-neutral-500">팀</label>
                <select v-model="searchQuery.team" multiple class="h-24 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm focus:border-neutral-300 focus:ring-0">
                  <option v-for="t in searchOptions.team" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div class="col-span-2">
                <label class="mb-1 block text-xs font-medium text-neutral-500">시너지</label>
                <select v-model="searchQuery.synergy" multiple class="h-24 w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm focus:border-neutral-300 focus:ring-0">
                  <option v-for="s in synergyOptions" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <div class="col-span-2 grid grid-cols-4 items-end gap-3">
                <div class="col-span-2">
                  <label class="mb-1 block text-xs font-medium text-neutral-500">레어도</label>
                  <input v-model.number="searchQuery.rarity" type="number" min="0" max="6" class="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-300 focus:ring-0">
                </div>
                <div class="col-span-2 text-right">
                  <button @click="resetFilters" class="inline-flex items-center justify-center rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                    필터 초기화
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between border-b border-neutral-100 px-4 py-3 text-xs text-neutral-500">
            <span>{{ currentPage }} / {{ totalPages }} 페이지</span>
            <div class="inline-flex gap-1">
              <button @click="goToPage(currentPage-1)" :disabled="currentPage<=1" class="rounded-lg border border-neutral-200 px-2 py-1 disabled:opacity-40">이전</button>
              <button @click="goToPage(currentPage+1)" :disabled="currentPage>=totalPages" class="rounded-lg border border-neutral-200 px-2 py-1 disabled:opacity-40">다음</button>
            </div>
          </div>

          <div class="flex-1 overflow-auto">
            <div
                v-for="(player, i) in paginatedPlayers"
                :key="i"
                @click="autoAssignPlayer(player)"
                class="group cursor-pointer border-b border-neutral-100 px-4 py-3 transition-colors hover:bg-neutral-50"
            >
              <div class="flex items-start gap-3">
                <img :src="`/assets/logos/grade/${player.grade}.png`" :alt="player.grade" class="h-8 w-8 rounded-md object-contain ring-1 ring-neutral-200" />
                <div class="min-w-0 flex-1">
                  <div class="mb-0.5 flex items-center gap-2">
                    <h3 class="truncate text-sm font-semibold text-neutral-900">{{ player.name }}</h3>
                    <div class="flex">
                      <Star v-for="k in Number(player.rarity)" :key="k" class="h-3.5 w-3.5 text-amber-400" fill="currentColor" />
                    </div>
                  </div>
                  <div class="mb-2 flex items-center gap-2 text-xs text-neutral-500">
                    <img :src="getTeamLogoUrl(player.team)" :alt="player.team" class="h-4 w-4" />
                    <span>{{ findTeamName(player.team) }}</span>
                    <span>·</span>
                    <span>{{ player.year }}</span>
                  </div>
                  <div class="mb-2 flex flex-wrap gap-1">
                    <span
                        v-for="pos in Array.from(new Set(toArray(player.position).map(normalizePosition))).filter(Boolean)"
                        :key="pos"
                        class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700"
                    >{{ pos }}</span>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <button
                        v-for="pos in Array.from(new Set(toArray(player.position).map(normalizePosition))).filter(Boolean)"
                        :key="pos"
                        @click.stop="assignPlayerToSlot(pos, player)"
                        class="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50"
                    >{{ pos }}</button>
                    <button
                        v-if="!isPitcher(player)"
                        @click.stop="assignPlayerToSlot('DH', player)"
                        class="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50"
                    >DH</button>
                    <button
                        @click.stop="assignToBench(player)"
                        class="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50"
                    >벤치</button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="!paginatedPlayers.length" class="flex h-40 items-center justify-center text-sm text-neutral-500">
              검색 결과가 없습니다
              <button @click="resetFilters" class="ml-2 underline underline-offset-2">필터 초기화</button>
            </div>
          </div>
        </section>

        <!-- 중앙: 라인업 -->
        <section class="col-span-5 flex max-h/full flex-col rounded-2xl bg-white ring-1 ring-neutral-200/70">
          <header class="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 class="text-base font-semibold tracking-tight text-neutral-900">라인업</h2>
            <span class="text-xs text-neutral-500">{{ Object.values(lineup).filter(Boolean).length }}/28</span>
          </header>

          <div class="grid flex-1 grid-rows-[auto_auto_1fr] gap-6 overflow-auto p-5">
            <section>
              <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">타자진</h3>
              <div class="mb-4">
                <div class="mb-2 text-xs text-neutral-500">외야</div>
                <div class="grid grid-cols-3 gap-3">
                  <LineupSlot v-for="pos in ['LF','CF','RF']" :key="pos" :pos="pos" :p="lineup[pos]" @clear="clearLineupSlot(pos)" :get-info="getPlayerSynergyInfo" />
                </div>
              </div>
              <div class="mb-4">
                <div class="mb-2 text-xs text-neutral-500">내야</div>
                <div class="grid grid-cols-5 gap-3">
                  <LineupSlot v-for="pos in ['C','1B','2B','3B','SS']" :key="pos" :pos="pos" :p="lineup[pos]" @clear="clearLineupSlot(pos)" :get-info="getPlayerSynergyInfo" />
                </div>
              </div>
              <div class="max-w-xs">
                <div class="mb-2 text-xs text-neutral-500">지명타자</div>
                <LineupSlot pos="DH" :p="lineup.DH" @clear="clearLineupSlot('DH')" :get-info="getPlayerSynergyInfo" />
              </div>
            </section>

            <section>
              <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">투수진</h3>
              <div class="mb-4">
                <div class="mb-2 text-xs text-neutral-500">선발</div>
                <div class="grid grid-cols-5 gap-3">
                  <LineupSlot v-for="i in 5" :key="'SP'+i" :pos="'SP'+i" :p="lineup['SP'+i]" @clear="clearLineupSlot('SP'+i)" :get-info="getPlayerSynergyInfo" />
                </div>
              </div>
              <div>
                <div class="mb-2 text-xs text-neutral-500">중계 & 마무리</div>
                <div class="grid grid-cols-6 gap-3">
                  <LineupSlot v-for="i in 6" :key="'RP'+i" :pos="'RP'+i" :p="lineup['RP'+i]" @clear="clearLineupSlot('RP'+i)" :get-info="getPlayerSynergyInfo" />
                </div>
              </div>
            </section>

            <section>
              <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">벤치 (8)</h3>
              <div class="grid grid-cols-4 gap-3">
                <LineupSlot v-for="i in 8" :key="'BENCH'+i" :pos="'BENCH'+i" :p="lineup['BENCH'+i]" @clear="clearLineupSlot('BENCH'+i)" :get-info="getPlayerSynergyInfo" />
              </div>
            </section>
          </div>
        </section>

        <!-- 우측: 시너지 -->
        <section class="col-span-3 flex max-h-full flex-col rounded-2xl bg-white ring-1 ring-neutral-200/70">
          <header class="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 class="text-base font-semibold tracking-tight text-neutral-900">시너지</h2>
            <div class="text-xs text-neutral-500">
              활성 {{ activeSynergyList.filter(s=>s.activeCondition).length }} · 대기 {{ inactiveSynergyList.length }}
            </div>
          </header>

          <div class="flex-1 overflow-auto p-5">
            <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">활성</h3>
            <div v-if="!activeSynergyList.filter(s=>s.activeCondition).length" class="mb-6 rounded-xl bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              발동된 시너지가 없습니다
            </div>

            <div class="space-y-3">
              <div
                  v-for="sy in activeSynergyList.filter(s=>s.activeCondition)"
                  :key="sy.name + '-active'"
                  class="rounded-xl border border-neutral-200 p-4"
              >
                <div class="mb-2 flex items-start justify-between">
                  <div class="min-w-0">
                    <div class="truncate text-[15px] font-semibold text-neutral-900">{{ sy.name }}</div>
                    <div class="truncate text-xs text-neutral-500">{{ sy.synergy.description }}</div>
                  </div>
                  <div class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{{ sy.count }}명</div>
                </div>

                <div class="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-[13px] font-semibold text-neutral-900">
                  {{ STAT_LABELS[sy.activeCondition!.stat] || sy.activeCondition!.stat }}
                  +{{ sy.activeCondition!.bonus.value }}{{ sy.activeCondition!.bonus.unit==='percent' ? '%' : '' }}
                </div>

                <div class="flex flex-wrap gap-1.5">
                  <span v-for="nm in sy.appliedPlayers" :key="nm" class="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">{{ nm }}</span>
                </div>

                <div v-if="sy.impliedChildren?.length" class="mt-3 border-t border-neutral-100 pt-3">
                  <div class="mb-1 text-[11px] font-medium text-neutral-500">하위 시너지 (표시)</div>
                  <div class="flex flex-wrap gap-1.5">
                    <span v-for="child in sy.impliedChildren" :key="child.name" class="rounded-full bg-white px-2 py-0.5 text-[11px] text-neutral-600 ring-1 ring-neutral-200">
                      {{ child.name }} · {{ child.count }}명
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <h3 class="mt-8 mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">조건 부족</h3>
            <div v-if="!inactiveSynergyList.length" class="rounded-xl bg-neutral-50 p-6 text-center text-sm text-neutral-500">
              조건 부족 시너지가 없습니다
            </div>

            <div class="space-y-3">
              <div v-for="sy in inactiveSynergyList" :key="sy.name + '-inactive'" class="rounded-xl border border-neutral-200 p-4">
                <div class="mb-2 flex items-center justify-between">
                  <div class="truncate text-[15px] font-semibold text-neutral-900">{{ sy.name }}</div>
                  <div class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{{ sy.count }}명</div>
                </div>
                <div class="mb-1 text-[13px] text-neutral-800">{{ sy.nextEffectDescription }}</div>
                <div class="mb-3 text-xs font-medium text-red-600">{{ sy.remainingCount }}명 더 필요</div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div class="h-2 rounded-full bg-neutral-900 transition-[width] duration-500" :style="{ width: sy.progress + '%' }"></div>
                </div>
                <div class="mt-1 text-center text-[11px] text-neutral-500">{{ sy.progress }}% 진행</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
button:disabled { opacity: 0.5; cursor: not-allowed; }
* { scroll-behavior: smooth; }
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #2563eb 0%, #7c3aed 100%); }
</style>
