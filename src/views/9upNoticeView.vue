<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { marked } from 'marked'

/** =========================
 *  Types
 *  ======================= */
interface GithubAsset {
  id: number
  name: string
  browser_download_url: string
  size: number
  download_count: number
}
interface GithubRelease {
  id: number
  tag_name: string
  name: string | null
  body: string | null
  draft: boolean
  prerelease: boolean
  created_at: string
  published_at: string | null
  html_url: string
  assets: GithubAsset[]
}

interface GithubCommit {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
    committer: {
      name: string
      email: string
      date: string
    }
  }
  author: {
    login: string
    avatar_url: string
    html_url: string
  } | null
  committer: {
    login: string
    avatar_url: string
    html_url: string
  } | null
  html_url: string
}

/** =========================
 *  Constants
 *  ======================= */
const owner = '2rangs'
const repo = '9up_probaseball_utils'
const perPage = 10

/** =========================
 *  State
 *  ======================= */
const releases = ref<GithubRelease[]>([])
const commits = ref<GithubCommit[]>([])
const loading = ref(false)
const loadingCommits = ref(false)
const error = ref<string | null>(null)
const nextUrl = ref<string | null>(null)
const nextCommitUrl = ref<string | null>(null)
const aborter = ref<AbortController | null>(null)
const q = ref('')
const includePrereleases = ref(false)
const includeDrafts = ref(false)
const showCommits = ref(true)
const commitSidebarCollapsed = ref(false)

/** 아코디언: 하나만 펼침 */
const expandedId = ref<number | null>(null)

/** =========================
 *  Utils
 *  ======================= */
function parseLinkHeader(link: string | null): Record<string, string> {
  const map: Record<string, string> = {}
  if (!link) return map
  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
    if (match) map[match[2]] = match[1]
  }
  return map
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(d)
}

function formatRelativeTime(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diff = now.getTime() - date.getTime()
  
  const minute = 60 * 1000
  const hour = minute * 60
  const day = hour * 24
  const week = day * 7
  const month = day * 30
  
  if (diff < minute) return '방금 전'
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`
  if (diff < week) return `${Math.floor(diff / day)}일 전`
  if (diff < month) return `${Math.floor(diff / week)}주 전`
  return `${Math.floor(diff / month)}개월 전`
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  const precision = n < 10 && i > 0 ? 1 : 0
  return `${n.toFixed(precision)} ${units[i]}`
}

function truncateCommitMessage(message: string, maxLength = 50): string {
  const firstLine = message.split('\n')[0]
  return firstLine.length > maxLength ? firstLine.slice(0, maxLength) + '...' : firstLine
}

function getCommitHash(sha: string): string {
  return sha.slice(0, 7)
}

function getSubwayLineColor(index: number): string {
  const colors = [
    'from-blue-500 to-blue-600',      // Line 1
    'from-green-500 to-green-600',    // Line 2
    'from-orange-500 to-orange-600',  // Line 3
    'from-purple-500 to-purple-600',  // Line 4
    'from-red-500 to-red-600',        // Line 5
    'from-indigo-500 to-indigo-600',  // Line 6
    'from-pink-500 to-pink-600',      // Line 7
    'from-teal-500 to-teal-600'       // Line 8
  ]
  return colors[index % colors.length]
}

function getSubwayStationColor(index: number): string {
  const colors = [
    'bg-blue-500 border-blue-600',
    'bg-green-500 border-green-600',
    'bg-orange-500 border-orange-600',
    'bg-purple-500 border-purple-600',
    'bg-red-500 border-red-600',
    'bg-indigo-500 border-indigo-600',
    'bg-pink-500 border-pink-600',
    'bg-teal-500 border-teal-600'
  ]
  return colors[index % colors.length]
}

// marked 기본 옵션 (헤더 id/mangle 비활성, 줄바꿈)
marked.setOptions({ headerIds: false, mangle: false, breaks: true })

function renderMarkdown(md: string | null): string {
  // NOTE: 필요 시 DOMPurify 연동 권장
  return String(marked.parse(md ?? ''))
}

/** =========================
 *  Fetch
 *  ======================= */
async function fetchPage(url: string, replace = false) {
  loading.value = true
  error.value = null

  // 이전 요청 취소
  try { aborter.value?.abort() } catch {}
  const controller = new AbortController()
  aborter.value = controller

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal
    })

    if (!res.ok) {
      if (res.status === 404) throw new Error('레포지터리를 찾을 수 없습니다.')
      if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
        throw new Error('GitHub API 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.')
      }
      throw new Error(`요청 실패 (${res.status})`)
    }

    const data: GithubRelease[] = await res.json()
    const linkMap = parseLinkHeader(res.headers.get('Link'))
    nextUrl.value = linkMap.next ?? null

    releases.value = replace ? data : [...releases.value, ...data]

    // 첫 로드 시 최신(첫 번째) 자동 펼침
    if (expandedId.value === null && releases.value.length) {
      expandedId.value = releases.value[0].id
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    error.value = e?.message ?? '요청 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
}

async function fetchCommits(url: string, replace = false) {
  if (!showCommits.value) return
  
  loadingCommits.value = true

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: aborter.value?.signal
    })

    if (!res.ok) throw new Error(`커밋 요청 실패 (${res.status})`)

    const data: GithubCommit[] = await res.json()
    const linkMap = parseLinkHeader(res.headers.get('Link'))
    nextCommitUrl.value = linkMap.next ?? null

    commits.value = replace ? data : [...commits.value, ...data]
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    // 커밋은 조용히 실패 (필수가 아니므로)
    console.warn('커밋 로드 실패:', e?.message)
  } finally {
    loadingCommits.value = false
  }
}

function refresh() {
  releases.value = []
  commits.value = []
  nextUrl.value = null
  nextCommitUrl.value = null
  expandedId.value = null
  
  // 릴리즈와 커밋 동시 로드
  fetchPage(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=${perPage}`, true)
  if (showCommits.value) {
    fetchCommits(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=25`, true)
  }
}

async function loadMore() {
  if (!nextUrl.value || loading.value) return
  await fetchPage(nextUrl.value)
}

async function loadMoreCommits() {
  if (!nextCommitUrl.value || loadingCommits.value) return
  await fetchCommits(nextCommitUrl.value)
}

/** =========================
 *  Lifecycle
 *  ======================= */
onMounted(() => refresh())
onBeforeUnmount(() => aborter.value?.abort())

/** =========================
 *  Derived
 *  ======================= */
const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  let arr = releases.value.filter(r =>
    (includeDrafts.value || !r.draft) &&
    (includePrereleases.value || !r.prerelease)
  )
  if (term) {
    arr = arr.filter(r =>
      r.tag_name.toLowerCase().includes(term) ||
      (r.name ?? '').toLowerCase().includes(term) ||
      (r.body ?? '').toLowerCase().includes(term)
    )
  }
  return arr
})

const filteredCommits = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return commits.value
  return commits.value.filter(c =>
    c.commit.message.toLowerCase().includes(term) ||
    c.commit.author.name.toLowerCase().includes(term) ||
    c.sha.toLowerCase().includes(term)
  )
})

const lastUpdated = computed(() => filtered.value[0]?.published_at || filtered.value[0]?.created_at)

/** =========================
 *  UI helpers
 *  ======================= */
function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}
function onAccordionKeydown(e: KeyboardEvent, id: number) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleExpand(id)
  }
}
</script>

<template>
  <div class="w-full max-w-[1400px] mx-auto p-2 sm:p-4">
    <!-- Desktop/Tablet Layout (lg+) -->
    <div class="hidden lg:flex gap-4">
      <!-- Main Content - Releases -->
      <section class="flex-1 min-w-0 space-y-4">
        <!-- Header -->
        <header
          class="rounded-2xl border border-gray-200 bg-white/90 dark:bg-gray-900/90 dark:border-gray-700 shadow-sm p-4
                 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sticky top-0 z-10 backdrop-blur
                 supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-gray-900/70">
          <div class="min-w-0">
            <h2 class="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 truncate">GitHub Releases</h2>
            <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <a
                :href="`https://github.com/${owner}/${repo}/releases`"
                target="_blank" rel="noopener"
                class="underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400">{{ owner }}/{{ repo }}</a>
              <span v-if="lastUpdated" class="ml-2 hidden sm:inline">· 최신 업데이트: {{ formatDate(lastUpdated) }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="refresh"
              class="px-3 py-1.5 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm
                     hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50">
              새로고침
            </button>
          </div>
        </header>

        <!-- Controls -->
        <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="relative flex-1">
            <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              v-model="q"
              type="search"
              placeholder="태그/제목/본문 검색"
              class="w-full pl-9 pr-3 py-2 rounded-xl border bg-white/95 dark:bg-gray-900/80 text-sm text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-400/40" />
          </div>
          <div class="flex items-center gap-2">
            <label class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs sm:text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
              <input type="checkbox" v-model="showCommits" @change="refresh" class="rounded border-gray-300 dark:border-gray-600" />
              🚇 커밋
            </label>
            <label class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs sm:text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
              <input type="checkbox" v-model="includePrereleases" class="rounded border-gray-300 dark:border-gray-600" />
              프리릴리즈
            </label>
            <label class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs sm:text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
              <input type="checkbox" v-model="includeDrafts" class="rounded border-gray-300 dark:border-gray-600" />
              드래프트
            </label>
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="rounded-2xl border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800/40 p-3 sm:p-4 flex items-start justify-between gap-3">
          <span class="text-sm">{{ error }}</span>
          <button @click="refresh" class="px-2 py-1 text-xs sm:text-sm rounded-lg border bg-white/90 dark:bg-transparent border-red-200 dark:border-red-700">재시도</button>
        </div>

        <!-- Initial Loading -->
        <div v-if="loading && releases.length === 0" class="space-y-3">
          <div v-for="n in 3" :key="n" class="p-4 rounded-2xl border bg-white/80 dark:bg-gray-900/70 border-gray-200 dark:border-gray-700 animate-pulse">
            <div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
            <div class="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div class="h-3 w-5/6 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="filtered.length === 0" class="p-8 rounded-2xl border bg-white/90 dark:bg-gray-900/90 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-center">
          <svg class="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          조건에 맞는 릴리즈가 없습니다.
        </div>

        <!-- Releases List -->
        <ul v-else class="space-y-3 sm:space-y-4">
          <li
            v-for="rel in filtered"
            :key="rel.id"
            class="rounded-2xl border bg-white/90 dark:bg-gray-900/90 border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

            <!-- Accordion header -->
            <button
              type="button"
              class="w-full text-left px-4 sm:px-5 py-3 sm:py-4 flex flex-wrap gap-3 items-start justify-between hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
              :aria-expanded="expandedId === rel.id"
              :aria-controls="`release-${rel.id}`"
              @click="toggleExpand(rel.id)"
              @keydown="onAccordionKeydown($event, rel.id)">
              <div class="min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                  <a
                    :href="rel.html_url"
                    target="_blank" rel="noopener"
                    class="font-semibold text-gray-800 dark:text-gray-100 hover:underline truncate"
                    @click.stop>
                    {{ rel.tag_name }}
                  </a>
                  <span v-if="rel.name" class="text-gray-500 dark:text-gray-400 truncate">· {{ rel.name }}</span>
                </div>
                <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">발행: {{ formatDate(rel.published_at || rel.created_at) }}</div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span v-if="rel.prerelease" class="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300/50">pre-release</span>
                <span v-if="rel.draft" class="text-[11px] px-2 py-1 rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border border-gray-400/40">draft</span>
                <svg class="w-4 h-4 ml-1 transition-transform" :class="expandedId === rel.id ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </button>

            <!-- Body -->
            <div
              v-show="expandedId === rel.id"
              :id="`release-${rel.id}`"
              class="px-4 sm:px-5 pb-3 sm:pb-4 prose dark:prose-invert max-w-none prose-sm">
              <div v-html="renderMarkdown(rel.body)"></div>
            </div>

            <!-- Assets -->
            <div
              v-if="rel.assets?.length && expandedId === rel.id"
              class="px-4 sm:px-5 pt-3 sm:pt-4 pb-4 border-t border-gray-100 dark:border-gray-800">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Assets</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  v-for="a in rel.assets"
                  :key="a.id"
                  :href="a.browser_download_url"
                  target="_blank" rel="noopener"
                  class="group flex items-center justify-between gap-3 px-3 py-2 rounded-xl border bg-gray-50/80 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/60">
                  <div class="min-w-0">
                    <div class="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">{{ a.name }}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatBytes(a.size) }} · 다운로드 {{ a.download_count.toLocaleString() }}
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" class="w-5 h-5 opacity-70 group-hover:opacity-100" aria-hidden="true">
                    <path fill="currentColor" d="M13 5v6h3l-4 4l-4-4h3V5zm-6 12h10v2H7z"/>
                  </svg>
                </a>
              </div>
            </div>
          </li>
        </ul>

        <!-- Load more -->
        <div v-if="nextUrl && filtered.length" class="pt-2 flex justify-center">
          <button
            @click="loadMore"
            :disabled="loading"
            class="px-4 py-2 rounded-xl border bg-white/90 dark:bg-gray-900/80 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/80 disabled:opacity-60">
            더 불러오기
          </button>
        </div>
      </section>

      <!-- Subway Style Commits Sidebar (Desktop) -->
      <aside v-if="showCommits" class="w-80 xl:w-96 flex-shrink-0 transition-all duration-300" :class="{ 'w-12': commitSidebarCollapsed }">
        <div class="sticky top-4">
          <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 shadow-sm overflow-hidden">
            <!-- Subway Line Header -->
            <div class="p-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
              <div v-if="!commitSidebarCollapsed" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                    <span class="text-white text-xs font-bold">🚇</span>
                  </div>
                  <h3 class="font-semibold text-gray-900 dark:text-gray-100">커밋 노선</h3>
                  <span class="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    {{ filteredCommits.length }}
                  </span>
                </div>
                <button 
                  @click="commitSidebarCollapsed = true"
                  class="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
              </div>
              <div v-else class="flex justify-center">
                <button 
                  @click="commitSidebarCollapsed = false"
                  class="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Subway Line -->
            <div v-if="!commitSidebarCollapsed" class="max-h-[600px] overflow-y-auto relative bg-gradient-to-b from-gray-50/50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/20">
              <!-- Loading State -->
              <div v-if="loadingCommits && commits.length === 0" class="p-4 space-y-4">
                <div v-for="n in 5" :key="n" class="flex items-center gap-4 animate-pulse">
                  <div class="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div class="h-2 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="filteredCommits.length === 0" class="p-8 text-center">
                <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span class="text-2xl">🚇</span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400">운행 중인 열차가 없습니다</p>
              </div>

              <!-- Subway Stations -->
              <div v-else class="relative">
                <!-- Main subway line -->
                <div class="absolute left-6 top-6 bottom-6 w-1 bg-gradient-to-b from-blue-400 via-purple-400 to-indigo-400 rounded-full shadow-sm"></div>

                <div class="space-y-0">
                  <div 
                    v-for="(commit, index) in filteredCommits" 
                    :key="commit.sha"
                    class="relative pl-12 pr-4 py-3 hover:bg-white/60 dark:hover:bg-gray-800/40 transition-all duration-200">
                    
                    <!-- Station -->
                    <div 
                      class="absolute left-4 top-4 w-4 h-4 rounded-full border-3 shadow-lg transition-transform hover:scale-110"
                      :class="getSubwayStationColor(index)"
                    ></div>

                    <!-- Station Info Card -->
                    <div class="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-3 border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200">
                      <div class="flex items-start gap-3">
                        <!-- Conductor (Author) -->
                        <div v-if="commit.author" class="flex-shrink-0">
                          <img 
                            :src="commit.author.avatar_url" 
                            :alt="commit.author.login"
                            class="w-8 h-8 rounded-full border-2 border-white dark:border-gray-700 shadow-sm"
                          />
                        </div>
                        <div v-else class="flex-shrink-0">
                          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-sm">
                            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                          </div>
                        </div>

                        <!-- Station Details -->
                        <div class="min-w-0 flex-1">
                          <div class="flex items-start justify-between gap-2">
                            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">
                              {{ truncateCommitMessage(commit.commit.message) }}
                            </h4>
                            <a 
                              :href="commit.html_url" 
                              target="_blank" rel="noopener"
                              class="flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors">
                              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15,3 21,3 21,9"/>
                                <line x1="10" x2="21" y1="14" y2="3"/>
                              </svg>
                            </a>
                          </div>
                          
                          <!-- Station ID & Time -->
                          <div class="flex items-center gap-2 mt-1">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              <span class="w-2 h-2 rounded-full bg-current opacity-50"></span>
                              {{ getCommitHash(commit.sha) }}
                            </span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">
                              {{ formatRelativeTime(commit.commit.author.date) }}
                            </span>
                          </div>
                          
                          <!-- Conductor Name -->
                          <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            🚇 {{ commit.commit.author.name }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- End Station -->
                <div class="relative pl-12 pr-4 py-4">
                  <div class="absolute left-4 top-4 w-4 h-4 rounded-full bg-gray-400 dark:bg-gray-600 border-3 border-gray-500 dark:border-gray-500"></div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
                    🏁 종점
                  </div>
                </div>
              </div>

              <!-- Load More Station -->
              <div v-if="nextCommitUrl" class="p-3 border-t border-gray-100 dark:border-gray-800 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
                <button 
                  @click="loadMoreCommits" 
                  :disabled="loadingCommits"
                  class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-sm">
                  <span class="text-base">🚇</span>
                  <span :class="{ 'animate-pulse': loadingCommits }">다음 역</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Mobile Layout (< lg) -->
    <div class="lg:hidden space-y-4">
      <!-- Mobile Header -->
      <header class="rounded-2xl border border-gray-200 bg-white/90 dark:bg-gray-900/90 dark:border-gray-700 shadow-sm p-4 sticky top-0 z-10 backdrop-blur">
        <div class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">GitHub Releases</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            <a :href="`https://github.com/${owner}/${repo}/releases`" target="_blank" class="underline">{{ owner }}/{{ repo }}</a>
          </p>
          <button @click="refresh" class="self-start px-3 py-1.5 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm">
            새로고침
          </button>
        </div>
      </header>

      <!-- Mobile Controls -->
      <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 shadow-sm p-3 space-y-3">
        <div class="relative">
          <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input v-model="q" type="search" placeholder="검색..." class="w-full pl-9 pr-3 py-2 rounded-xl border bg-white/95 dark:bg-gray-900/80 text-sm text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-400/40" />
        </div>
        <div class="flex flex-wrap gap-2">
          <label class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer">
            <input type="checkbox" v-model="showCommits" @change="refresh" class="rounded border-gray-300 dark:border-gray-600" />
            🚇 커밋
          </label>
          <label class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer">
            <input type="checkbox" v-model="includePrereleases" class="rounded border-gray-300 dark:border-gray-600" />
            프리릴리즈
          </label>
          <label class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer">
            <input type="checkbox" v-model="includeDrafts" class="rounded border-gray-300 dark:border-gray-600" />
            드래프트
          </label>
        </div>
      </div>

      <!-- Mobile Releases -->
      <div v-if="loading && releases.length === 0" class="space-y-3">
        <div v-for="n in 3" :key="n" class="p-4 rounded-2xl border bg-white/80 dark:bg-gray-900/70 border-gray-200 dark:border-gray-700 animate-pulse">
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
          <div class="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div class="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>

      <div v-else-if="filtered.length === 0" class="p-8 rounded-2xl border bg-white/90 dark:bg-gray-900/90 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-center">
        <div class="text-4xl mb-2">📦</div>
        <p class="text-sm">릴리즈가 없습니다.</p>
      </div>

      <div v-else class="space-y-3">
        <div v-for="rel in filtered" :key="rel.id" class="rounded-2xl border bg-white/90 dark:bg-gray-900/90 border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <button
            type="button"
            class="w-full text-left p-4 flex justify-between items-start gap-3 hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
            @click="toggleExpand(rel.id)">
            <div class="min-w-0 flex-1">
              <h3 class="font-semibold text-gray-800 dark:text-gray-100 truncate">{{ rel.tag_name }}</h3>
              <p v-if="rel.name" class="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">{{ rel.name }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ formatDate(rel.published_at || rel.created_at) }}</p>
            </div>
            <svg class="w-5 h-5 text-gray-400 transition-transform" :class="expandedId === rel.id ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          
          <div v-show="expandedId === rel.id" class="px-4 pb-4 prose dark:prose-invert max-w-none prose-sm">
            <div v-html="renderMarkdown(rel.body)"></div>
          </div>
        </div>
      </div>

      <!-- Mobile Subway Line -->
      <div v-if="showCommits && filteredCommits.length > 0" class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
          <div class="flex items-center gap-2">
            <span class="text-lg">🚇</span>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">커밋 노선</h3>
            <span class="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {{ filteredCommits.length }}
            </span>
          </div>
        </div>
        
        <div class="max-h-80 overflow-y-auto">
          <div class="space-y-2 p-3">
            <div v-for="(commit, index) in filteredCommits.slice(0, 10)" :key="commit.sha" class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30">
              <div class="w-3 h-3 rounded-full mt-2 flex-shrink-0" :class="getSubwayStationColor(index)"></div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">{{ truncateCommitMessage(commit.commit.message, 40) }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <code class="text-xs font-mono px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">{{ getCommitHash(commit.sha) }}</code>
                  <span class="text-xs text-gray-500">{{ formatRelativeTime(commit.commit.author.date) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 문서용 프로즈 약간 보정 */
.prose :where(p):not(:first-child){ margin-top: .5rem; }
.prose :where(pre){ max-width: 100%; overflow: auto; }

/* sticky header 아래 그림자 보강 */
header.sticky{ box-shadow: 0 6px 10px -10px rgba(0,0,0,.25); }

/* 지하철 노선 스크롤바 커스터마이징 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #2563eb, #7c3aed);
}

/* 지하철역 호버 효과 */
@keyframes station-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.3); }
  50% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.6), 0 0 25px rgba(59, 130, 246, 0.3); }
}

.station-glow {
  animation: station-glow 2s ease-in-out infinite;
}

/* 반응형 그리드 최적화 */
@media (max-width: 640px) {
  .prose { font-size: 0.875rem; }
  .prose :where(h1, h2, h3, h4) { font-size: 1rem; margin-top: 1rem; margin-bottom: 0.5rem; }
}
</style>