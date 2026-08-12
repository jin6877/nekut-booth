// 네컷 합성/필터/레이아웃 파이프라인 — DOM 최소 의존 순수 함수.
// 입력: 원본 4컷(+선택적 누끼) + 옵션  →  출력: 최종 스트립 캔버스.
// 모든 처리는 브라우저 캔버스 안에서만 일어난다.

export type ImageSource = HTMLCanvasElement | HTMLImageElement | ImageBitmap

// 컷 한 장의 고정 해상도(4:3 가로) — 실시간 성능과 무관, 고화질 저장용.
export const CUT_W = 800
export const CUT_H = 600

// ---------- 필터 ----------
export type FilterId = 'none' | 'film' | 'warm' | 'cool' | 'bw' | 'soft' | 'vivid'

export interface FilterDef {
  id: FilterId
  name: string
  css: string
  grain?: number // 필름 그레인 강도(0..1)
  vignette?: number // 비네팅 강도(0..1)
  bloom?: number // 소프트 글로우 강도(0..1)
}

export const FILTERS: FilterDef[] = [
  { id: 'none', name: '원본', css: 'none' },
  { id: 'film', name: '필름', css: 'sepia(0.22) contrast(1.06) saturate(0.92) brightness(1.03)', grain: 0.5, vignette: 0.28 },
  { id: 'warm', name: '웜톤', css: 'sepia(0.3) saturate(1.14) brightness(1.05) contrast(1.02)', vignette: 0.14 },
  { id: 'cool', name: '쿨톤', css: 'saturate(1.06) brightness(1.03) contrast(1.04) hue-rotate(-10deg)' },
  { id: 'bw', name: '흑백', css: 'grayscale(1) contrast(1.14) brightness(1.03)', grain: 0.35, vignette: 0.22 },
  { id: 'soft', name: '소프트', css: 'brightness(1.09) contrast(0.93) saturate(1.05)', bloom: 0.5 },
  { id: 'vivid', name: '비비드', css: 'saturate(1.42) contrast(1.15) brightness(1.02)' },
]

export function getFilter(id: FilterId): FilterDef {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0]
}

/** 실시간 프리뷰(video/img)에 그대로 쓰는 CSS filter 문자열 */
export function filterCssFor(id: FilterId): string {
  return getFilter(id).css
}

// ---------- 배경 ----------
export type BgMode = 'original' | 'color' | 'gradient' | 'blur' | 'image'

export interface BgSpec {
  mode: BgMode
  color: string
  gradientId: string
  imageUrl: string | null
}

export const DEFAULT_BG: BgSpec = {
  mode: 'original',
  color: '#f7c9d4',
  gradientId: 'peach',
  imageUrl: null,
}

export const BG_COLORS = [
  '#f7c9d4', // 체리 파스텔
  '#ffffff',
  '#2a201b',
  '#d7c4f2', // 라일락
  '#bfe3d4', // 민트
  '#ffe6a3', // 버터
  '#ffd0c2', // 코랄
  '#c8def0', // 스카이
] as const

export interface GradientPreset {
  id: string
  name: string
  angle: number
  stops: string[]
}

export const GRADIENTS: GradientPreset[] = [
  { id: 'peach', name: '피치', angle: 145, stops: ['#ffd9c0', '#f7a1b0'] },
  { id: 'lilac', name: '라일락', angle: 150, stops: ['#e6d5f7', '#a98fdb'] },
  { id: 'mint', name: '민트', angle: 150, stops: ['#c9efdd', '#7fc9c0'] },
  { id: 'sunset', name: '노을', angle: 160, stops: ['#ffe1a8', '#f8879b'] },
  { id: 'blueberry', name: '블루베리', angle: 150, stops: ['#c7dcf5', '#8a7fd6'] },
  { id: 'cream', name: '크림', angle: 180, stops: ['#fdf7ec', '#e7d4b6'] },
]

export function gradientCss(id: string): string {
  const g = GRADIENTS.find((x) => x.id === id) ?? GRADIENTS[0]
  return `linear-gradient(${g.angle}deg, ${g.stops.join(', ')})`
}

// ---------- 프레임 / 레이아웃 ----------
export type LayoutId = 'strip' | 'grid'

export interface FramePreset {
  id: string
  name: string
  color: string
}

export const FRAMES: FramePreset[] = [
  { id: 'cream', name: '크림', color: '#fbf4e6' },
  { id: 'ink', name: '먹지', color: '#241c17' },
  { id: 'cherry', name: '체리', color: '#e8425a' },
  { id: 'lilac', name: '라일락', color: '#b49ae0' },
  { id: 'mint', name: '민트', color: '#8fd6c0' },
  { id: 'butter', name: '버터', color: '#f2c14e' },
  { id: 'sky', name: '스카이', color: '#a7c8ea' },
]

export type DecoId = 'none' | 'heart' | 'star' | 'confetti'
export const DECOS: { id: DecoId; name: string }[] = [
  { id: 'none', name: '없음' },
  { id: 'heart', name: '하트' },
  { id: 'star', name: '별' },
  { id: 'confetti', name: '컨페티' },
]

export interface StripOptions {
  layout: LayoutId
  frameColor: string
  deco: DecoId
  caption: string
  showDate: boolean
  date?: Date
}

// ---------- 그리기 헬퍼 ----------
function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function srcW(s: ImageSource): number {
  return s instanceof HTMLImageElement ? s.naturalWidth || s.width : s.width
}
function srcH(s: ImageSource): number {
  return s instanceof HTMLImageElement ? s.naturalHeight || s.height : s.height
}

/** cover(잘라 채우기) 방식으로 소스를 대상 사각형에 그린다. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  src: ImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const sw = srcW(src)
  const sh = srcH(src)
  const scale = Math.max(dw / sw, dh / sh)
  const rw = sw * scale
  const rh = sh * scale
  ctx.drawImage(src as CanvasImageSource, dx + (dw - rw) / 2, dy + (dh - rh) / 2, rw, rh)
}

function paintGradient(ctx: CanvasRenderingContext2D, w: number, h: number, g: GradientPreset) {
  const rad = ((g.angle - 90) * Math.PI) / 180
  const cx = w / 2
  const cy = h / 2
  const half = (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2
  const grad = ctx.createLinearGradient(
    cx - Math.cos(rad) * half,
    cy - Math.sin(rad) * half,
    cx + Math.cos(rad) * half,
    cy + Math.sin(rad) * half,
  )
  const n = g.stops.length
  g.stops.forEach((c, i) => grad.addColorStop(n === 1 ? 0 : i / (n - 1), c))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

let grainTile: HTMLCanvasElement | null = null
function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile
  const size = 128
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 135
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  grainTile = c
  return c
}

function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  const tile = getGrainTile()
  const pattern = ctx.createPattern(tile, 'repeat')!
  ctx.save()
  ctx.globalAlpha = 0.08 * intensity
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

function addVignette(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  const grad = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.35,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72,
  )
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, `rgba(20,10,6,${0.55 * intensity})`)
  ctx.save()
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

// ---------- 컷 렌더 ----------
/**
 * 원본(+선택적 누끼)에 배경/필터를 적용해 CUT_W×CUT_H 컷 캔버스를 만든다.
 * cutout 이 있으면 배경을 교체하고, 없으면(원본유지) 원본을 그대로 쓴다.
 */
export async function renderCut(
  original: ImageSource,
  cutout: ImageSource | null,
  bg: BgSpec,
  filter: FilterId,
): Promise<HTMLCanvasElement> {
  const content = makeCanvas(CUT_W, CUT_H)
  const ctx = content.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'

  const useCutout = bg.mode !== 'original' && cutout != null

  if (!useCutout) {
    drawCover(ctx, original, 0, 0, CUT_W, CUT_H)
  } else {
    // 배경 페인트
    if (bg.mode === 'blur') {
      ctx.save()
      ctx.filter = `blur(${Math.round(CUT_W * 0.02)}px) brightness(1.03)`
      drawCover(ctx, original, -20, -20, CUT_W + 40, CUT_H + 40)
      ctx.restore()
    } else if (bg.mode === 'color') {
      ctx.fillStyle = bg.color
      ctx.fillRect(0, 0, CUT_W, CUT_H)
    } else if (bg.mode === 'gradient') {
      paintGradient(ctx, CUT_W, CUT_H, GRADIENTS.find((g) => g.id === bg.gradientId) ?? GRADIENTS[0])
    } else if (bg.mode === 'image' && bg.imageUrl) {
      const img = await loadImage(bg.imageUrl)
      drawCover(ctx, img, 0, 0, CUT_W, CUT_H)
    }
    // 인물(누끼) 위에 올리기 — 살짝 그림자로 분리감
    ctx.save()
    ctx.shadowColor = 'rgba(30,15,10,0.28)'
    ctx.shadowBlur = CUT_W * 0.02
    ctx.shadowOffsetY = CUT_W * 0.008
    drawCover(ctx, cutout, 0, 0, CUT_W, CUT_H)
    ctx.restore()
  }

  // 필터 적용
  const def = getFilter(filter)
  const out = makeCanvas(CUT_W, CUT_H)
  const octx = out.getContext('2d')!
  octx.imageSmoothingQuality = 'high'
  if (def.css !== 'none') octx.filter = def.css
  octx.drawImage(content, 0, 0)
  octx.filter = 'none'

  if (def.bloom) {
    octx.save()
    octx.globalAlpha = def.bloom * 0.5
    octx.globalCompositeOperation = 'lighter'
    octx.filter = `blur(${Math.round(CUT_W * 0.012)}px) brightness(1.1)`
    octx.drawImage(content, 0, 0)
    octx.restore()
    octx.filter = 'none'
  }
  if (def.vignette) addVignette(octx, CUT_W, CUT_H, def.vignette)
  if (def.grain) addGrain(octx, CUT_W, CUT_H, def.grain)

  return out
}

// ---------- 스트립 합성 ----------
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function relLuminance(hex: string): number {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255
  const g = parseInt(m.slice(2, 4), 16) / 255
  const b = parseInt(m.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(s / 100, s / 100)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 30)
  ctx.bezierCurveTo(-55, -18, -30, -55, 0, -22)
  ctx.bezierCurveTo(30, -55, 55, -18, 0, 30)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, rot = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI / 5) * (2 * i) - Math.PI / 2
    const a2 = a + Math.PI / 5
    ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s)
    ctx.lineTo(Math.cos(a2) * s * 0.44, Math.sin(a2) * s * 0.44)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawDeco(
  ctx: CanvasRenderingContext2D,
  deco: DecoId,
  spots: { x: number; y: number }[],
  onDark: boolean,
) {
  if (deco === 'none') return
  const palette = onDark
    ? ['#f79bab', '#f6cf6a', '#d7c4f2', '#8fd6c0']
    : ['#e8425a', '#f2c14e', '#a37ddb', '#5cb79c']
  spots.forEach((p, i) => {
    const c = palette[i % palette.length]
    const rot = (i * 37) % 60 / 60 - 0.4
    if (deco === 'heart') drawHeart(ctx, p.x, p.y, 34 + (i % 3) * 6, c, rot)
    else if (deco === 'star') drawStar(ctx, p.x, p.y, 20 + (i % 3) * 5, c, rot)
    else {
      // confetti — 하트/별/점 섞기
      const k = i % 3
      if (k === 0) drawHeart(ctx, p.x, p.y, 26, c, rot)
      else if (k === 1) drawStar(ctx, p.x, p.y, 16, c, rot)
      else {
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
}

const MARGIN = 46
const GAP = 20
const CAPTION_H = 138
const RADIUS = 24

export interface StripResult {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

/**
 * 렌더된 4컷을 프레임/레이아웃/캡션과 합성해 최종 스트립 캔버스를 만든다.
 * cuts 길이가 4가 아니면 예외.
 */
export function composeStrip(cuts: HTMLCanvasElement[], opts: StripOptions): StripResult {
  if (cuts.length !== 4) throw new Error(`4컷이 필요합니다 (현재 ${cuts.length}컷)`)

  const cols = opts.layout === 'grid' ? 2 : 1
  const rows = opts.layout === 'grid' ? 2 : 4
  const cellW = CUT_W / (opts.layout === 'grid' ? 1.9 : 1) // 그리드는 컷을 살짝 축소
  const cellH = cellW * (CUT_H / CUT_W)

  const width = Math.round(MARGIN * 2 + cols * cellW + (cols - 1) * GAP)
  const height = Math.round(MARGIN + rows * cellH + (rows - 1) * GAP + CAPTION_H)

  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'

  // 프레임 배경
  ctx.fillStyle = opts.frameColor
  ctx.fillRect(0, 0, width, height)

  const dark = relLuminance(opts.frameColor) < 0.5
  // 프레임 안쪽 아주 옅은 톤 변화로 종이 질감
  const tint = ctx.createLinearGradient(0, 0, 0, height)
  tint.addColorStop(0, dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.25)')
  tint.addColorStop(1, dark ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.05)')
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, width, height)

  // 컷 배치
  const spots: { x: number; y: number }[] = []
  for (let i = 0; i < 4; i++) {
    const cx = i % cols
    const cy = Math.floor(i / cols)
    const x = MARGIN + cx * (cellW + GAP)
    const y = MARGIN + cy * (cellH + GAP)

    ctx.save()
    roundRectPath(ctx, x, y, cellW, cellH, RADIUS)
    // 컷 그림자
    ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(80,55,35,0.22)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 8
    ctx.fillStyle = '#000'
    ctx.fill()
    ctx.restore()

    ctx.save()
    roundRectPath(ctx, x, y, cellW, cellH, RADIUS)
    ctx.clip()
    drawCover(ctx, cuts[i], x, y, cellW, cellH)
    ctx.restore()

    // 컷 테두리 살짝
    ctx.save()
    roundRectPath(ctx, x + 0.5, y + 0.5, cellW - 1, cellH - 1, RADIUS)
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    // 데코 위치(컷 모서리 근처)
    if (i === 0) spots.push({ x: x + cellW - 8, y: y + 10 })
    if (i === 1) spots.push({ x: x + 8, y: y + cellH - 8 })
    if (i === 2 && opts.layout === 'strip') spots.push({ x: x + cellW - 6, y: y + cellH / 2 })
    if (i === 3) spots.push({ x: x + 6, y: y + 8 })
  }

  // 캡션 영역
  const capY = height - CAPTION_H
  const textColor = dark ? '#f7efe1' : '#2a201b'
  const subColor = dark ? 'rgba(247,239,225,0.7)' : 'rgba(42,32,27,0.55)'

  const caption = (opts.caption || '').trim()
  ctx.textAlign = 'center'
  ctx.fillStyle = textColor
  if (caption) {
    ctx.font = `700 ${Math.round(CAPTION_H * 0.34)}px "Gaegu", "Pretendard Variable", system-ui, sans-serif`
    ctx.fillText(caption, width / 2, capY + CAPTION_H * 0.5, width - MARGIN * 2)
  } else {
    ctx.font = `800 ${Math.round(CAPTION_H * 0.3)}px "Pretendard Variable", system-ui, sans-serif`
    ctx.fillText('NEKUT BOOTH', width / 2, capY + CAPTION_H * 0.46, width - MARGIN * 2)
  }

  // 워드마크 + 날짜
  ctx.fillStyle = subColor
  ctx.font = `600 ${Math.round(CAPTION_H * 0.17)}px "Pretendard Variable", system-ui, sans-serif`
  const dateStr = opts.showDate ? formatDate(opts.date ?? new Date()) : ''
  const footer = caption ? ['NEKUT', dateStr].filter(Boolean).join('   ·   ') : dateStr
  if (footer) ctx.fillText(footer, width / 2, capY + CAPTION_H * 0.8)

  // 데코
  drawDeco(ctx, opts.deco, spots, dark)

  return { canvas, width, height }
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

// ---------- 공용 유틸 ----------
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'))
    img.src = url
  })
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 인코딩 실패'))), type)
  })
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 캔버스가 완전히 균일(빈 이미지)한지 검사 — 검증/안전장치용 */
export function isBlankCanvas(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const r0 = data[0]
  const g0 = data[1]
  const b0 = data[2]
  for (let i = 0; i < data.length; i += 4 * 997) {
    if (
      Math.abs(data[i] - r0) > 4 ||
      Math.abs(data[i + 1] - g0) > 4 ||
      Math.abs(data[i + 2] - b0) > 4
    ) {
      return false
    }
  }
  return true
}
