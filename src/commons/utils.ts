import Papa from 'papaparse'
import type { Player } from '@/types/player'

export const CSV_PATHS = {
    Batters: '/DB/9UP_ProBaseball_PlayerDB_202507_Batters.csv',
    Pitchers: '/DB/9UP_ProBaseball_PlayerDB_202507_Pitchers.csv'
} as const

export async function loadPlayers(tab: keyof typeof CSV_PATHS): Promise<Player[]> {
    const path = CSV_PATHS[tab]
    const res = await fetch(path)
    const text = await res.text()

    return new Promise((resolve, reject) => {
        Papa.parse<Player>(text, {
            header: true,
            skipEmptyLines: true,
            complete: results => resolve(results.data),
            error: err => reject(err)
        })
    })
}

export function applyFilters(
    players: Player[],
    filters: Record<string, any>,
    inputFields: string[],
    selectFields: string[],
    rarityField: string
): Player[] {
    return players.filter(p => {
        return Object.entries(filters).every(([field, selected]) => {
            if (!selected || selected === '') return true
            if (field === rarityField) return Number(p[field]) === Number(selected)
            if (inputFields.includes(field)) return p[field]?.toLowerCase().includes(selected.toLowerCase())
            return p[field] === selected
        })
    })
}

export function getFilterOptions(
    players: Player[],
    selectFields: string[]
): Record<string, string[]> {
    const options: Record<string, string[]> = {}
    selectFields.forEach(field => {
        const set = new Set<string>()
        players.forEach(p => {
            if (p[field]?.trim()) set.add(p[field].trim())
        })
        options[field] = Array.from(set).sort()
    })
    return options
}
