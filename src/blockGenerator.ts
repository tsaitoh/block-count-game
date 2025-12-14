export type Vec3 = { x: number; y: number; z: number }

export type ViewDir = 'XP' | 'XN' | 'ZP'

export type GeneratedShape = {
  blocks: Vec3[]
  answer: number
}

type Key = string

const keyOf = (v: Vec3): Key => `${v.x},${v.y},${v.z}`

const neighbors6 = (v: Vec3): Vec3[] => [
  { x: v.x + 1, y: v.y, z: v.z },
  { x: v.x - 1, y: v.y, z: v.z },
  { x: v.x, y: v.y + 1, z: v.z },
  { x: v.x, y: v.y - 1, z: v.z },
  { x: v.x, y: v.y, z: v.z + 1 },
  { x: v.x, y: v.y, z: v.z - 1 },
]

const randInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const shuffleInPlace = <T>(arr: T[]): void => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

export type GeneratorConfig = {
  sizeX: number
  sizeY: number
  sizeZ: number
  blockCountMin: number
  blockCountMax: number
  views: ViewDir[]
  initialView: ViewDir
  fillOccludedInInitialView: boolean
  maxTries: number
}

const defaultConfig: GeneratorConfig = {
  sizeX: 5,
  sizeY: 4,
  sizeZ: 5,
  blockCountMin: 6,
  blockCountMax: 14,
  views: ['XP', 'XN', 'ZP'],
  initialView: 'XP',
  fillOccludedInInitialView: true,
  maxTries: 800,
}

const inBounds = (v: Vec3, c: GeneratorConfig): boolean => {
  return v.x >= 0 && v.x < c.sizeX && v.y >= 0 && v.y < c.sizeY && v.z >= 0 && v.z < c.sizeZ
}

const isFullyInterior = (v: Vec3, set: Set<Key>): boolean => {
  return neighbors6(v).every((n) => set.has(keyOf(n)))
}

const isVisibleFromWithBounds = (v: Vec3, set: Set<Key>, dir: ViewDir, c: GeneratorConfig): boolean => {
  if (dir === 'XP') {
    for (let x = v.x + 1; x < c.sizeX; x++) {
      if (set.has(`${x},${v.y},${v.z}`)) return false
    }
    return true
  }
  if (dir === 'XN') {
    for (let x = v.x - 1; x >= 0; x--) {
      if (set.has(`${x},${v.y},${v.z}`)) return false
    }
    return true
  }
  for (let z = v.z + 1; z < c.sizeZ; z++) {
    if (set.has(`${v.x},${v.y},${z}`)) return false
  }
  return true
}

const fillOccludedInInitialViewXP = (set: Set<Key>, c: GeneratorConfig): void => {
  const maxXByYZ = new Map<string, number>()
  for (const k of set) {
    const [xs, ys, zs] = k.split(',')
    const x = Number(xs)
    const yz = `${ys},${zs}`
    const cur = maxXByYZ.get(yz)
    if (cur == null || x > cur) maxXByYZ.set(yz, x)
  }

  for (const [yz, maxX] of maxXByYZ.entries()) {
    const [ys, zs] = yz.split(',')
    const y = Number(ys)
    const z = Number(zs)
    for (let x = 0; x <= maxX; x++) {
      const v: Vec3 = { x, y, z }
      if (!inBounds(v, c)) continue
      set.add(keyOf(v))
    }
  }
}

const satisfiesVisibilityConstraintB = (set: Set<Key>, c: GeneratorConfig): boolean => {
  for (const k of set) {
    const [xs, ys, zs] = k.split(',')
    const v: Vec3 = { x: Number(xs), y: Number(ys), z: Number(zs) }
    const ok = c.views.some((dir) => isVisibleFromWithBounds(v, set, dir, c))
    if (!ok) return false
  }
  return true
}

const randomGrowConnected = (targetCount: number, c: GeneratorConfig): Set<Key> | null => {
  const set = new Set<Key>()

  const start: Vec3 = {
    x: randInt(0, c.sizeX - 1),
    y: randInt(0, c.sizeY - 1),
    z: randInt(0, c.sizeZ - 1),
  }
  set.add(keyOf(start))

  const frontier: Vec3[] = [start]

  while (set.size < targetCount) {
    const base = frontier[randInt(0, frontier.length - 1)]
    const cand = neighbors6(base).filter((v) => inBounds(v, c) && !set.has(keyOf(v)))
    if (cand.length === 0) {
      const idx = frontier.findIndex((v) => v.x === base.x && v.y === base.y && v.z === base.z)
      if (idx >= 0) frontier.splice(idx, 1)
      if (frontier.length === 0) return null
      continue
    }

    shuffleInPlace(cand)
    let placed = false
    for (const v of cand) {
      const k = keyOf(v)
      set.add(k)

      let interiorCount = 0
      for (const kk of set) {
        const [xs, ys, zs] = kk.split(',')
        const vv: Vec3 = { x: Number(xs), y: Number(ys), z: Number(zs) }
        if (isFullyInterior(vv, set)) interiorCount++
        if (interiorCount > 0) break
      }
      if (interiorCount > 0) {
        set.delete(k)
        continue
      }

      frontier.push(v)
      placed = true
      break
    }

    if (!placed) {
      const idx = frontier.findIndex((v) => v.x === base.x && v.y === base.y && v.z === base.z)
      if (idx >= 0) frontier.splice(idx, 1)
      if (frontier.length === 0) return null
    }
  }

  return set
}

export const generateShape = (config?: Partial<GeneratorConfig>): GeneratedShape => {
  const c: GeneratorConfig = { ...defaultConfig, ...(config ?? {}) }

  for (let i = 0; i < c.maxTries; i++) {
    const targetCount = randInt(c.blockCountMin, c.blockCountMax)
    const set = randomGrowConnected(targetCount, c)
    if (!set) continue

    if (c.fillOccludedInInitialView && c.initialView === 'XP') {
      fillOccludedInInitialViewXP(set, c)
    }

    if (set.size < c.blockCountMin || set.size > c.blockCountMax) continue

    if (!satisfiesVisibilityConstraintB(set, c)) continue

    const blocks: Vec3[] = [...set].map((k) => {
      const [xs, ys, zs] = k.split(',')
      return { x: Number(xs), y: Number(ys), z: Number(zs) }
    })

    return { blocks, answer: blocks.length }
  }

  const fallbackCount = c.blockCountMin
  const set = randomGrowConnected(fallbackCount, c) ?? new Set<Key>(['0,0,0'])
  if (c.fillOccludedInInitialView && c.initialView === 'XP') {
    fillOccludedInInitialViewXP(set, c)
  }
  if (set.size > c.blockCountMax) {
    const trimmed = [...set].slice(0, c.blockCountMax)
    set.clear()
    for (const k of trimmed) set.add(k)
  }
  const blocks: Vec3[] = [...set].map((k) => {
    const [xs, ys, zs] = k.split(',')
    return { x: Number(xs), y: Number(ys), z: Number(zs) }
  })
  return { blocks, answer: blocks.length }
}
