// 실경로 스모크 검증:
//  1) 합성/레이아웃/필터 파이프라인 — 샘플 4장 → 최종 스트립 PNG가 무빈칸·기대 해상도
//  2) 누끼 배경합성 — RMBG 실제 로드 → 마스크 생성 → 배경 교체까지, 결과가 원본과 다른지
import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:4173'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('console', (m) => {
  if (m.type() === 'error') console.log('  [page error]', m.text())
})

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!(window).__nekut, { timeout: 15000 })

console.log('== 1) 합성 파이프라인 검증 ==')
const compose = await page.evaluate(async () => {
  const N = window.__nekut
  const imgs = await Promise.all([
    N.loadImage('/samples/sample-1.png'),
    N.loadImage('/samples/sample-2.png'),
  ])
  const originals = [imgs[0], imgs[1], imgs[0], imgs[1]].map(N.makeOriginal)
  const bg = { mode: 'original', color: '#ffffff', gradientId: 'peach', imageUrl: null }
  const cuts = await Promise.all(originals.map((o) => N.renderCut(o, null, bg, 'film')))

  function stats(canvas) {
    const ctx = canvas.getContext('2d')
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let r0 = data[0], g0 = data[1], b0 = data[2], varied = 0, sampled = 0
    for (let i = 0; i < data.length; i += 4 * 503) {
      sampled++
      if (Math.abs(data[i] - r0) > 6 || Math.abs(data[i + 1] - g0) > 6 || Math.abs(data[i + 2] - b0) > 6) varied++
    }
    return { variedRatio: varied / sampled }
  }

  const strip = N.composeStrip(cuts, {
    layout: 'strip', frameColor: '#fbf4e6', deco: 'heart', caption: '테스트 네컷', showDate: true, date: new Date(),
  })
  const grid = N.composeStrip(cuts, {
    layout: 'grid', frameColor: '#241c17', deco: 'confetti', caption: '', showDate: true, date: new Date(),
  })
  return {
    stripW: strip.width, stripH: strip.height, stripVaried: stats(strip.canvas).variedRatio,
    gridW: grid.width, gridH: grid.height, gridVaried: stats(grid.canvas).variedRatio,
  }
})
console.log('  strip:', compose.stripW + 'x' + compose.stripH, 'varied=' + compose.stripVaried.toFixed(3))
console.log('  grid :', compose.gridW + 'x' + compose.gridH, 'varied=' + compose.gridVaried.toFixed(3))
const composeOK =
  compose.stripW === 892 && compose.stripH === 2644 && compose.stripVaried > 0.2 &&
  compose.gridVaried > 0.2
console.log('  => 합성 파이프라인', composeOK ? 'PASS' : 'FAIL')

console.log('== 2) 누끼 배경합성 실경로 검증 (RMBG 로드 → 마스크 → 배경교체) ==')
console.log('  (WASM 폴백이면 수십 초 걸릴 수 있음)')
const t0 = Date.now()
const rmbg = await page.evaluate(async () => {
  const N = window.__nekut
  const img = await N.loadImage('/samples/sample-1.png')
  const original = N.makeOriginal(img)
  let err = null, cutout = null
  try {
    cutout = await N.removeBackground(original)
  } catch (e) {
    err = String((e && e.message) || e)
    return { err }
  }
  // 누끼 투명도 통계
  const cctx = cutout.getContext('2d')
  const cd = cctx.getImageData(0, 0, cutout.width, cutout.height).data
  let transparent = 0, opaque = 0, total = 0
  for (let i = 3; i < cd.length; i += 4 * 97) {
    total++
    if (cd[i] < 20) transparent++
    else if (cd[i] > 235) opaque++
  }
  // 원본유지 컷 vs 단색배경 교체 컷의 좌상단(배경영역) 차이
  const bgSwap = { mode: 'color', color: '#12d1a1', gradientId: 'peach', imageUrl: null }
  const bgKeep = { mode: 'original', color: '#000', gradientId: 'peach', imageUrl: null }
  const swapCut = await N.renderCut(original, cutout, bgSwap, 'none')
  const keepCut = await N.renderCut(original, null, bgKeep, 'none')
  function corner(c) {
    const ctx = c.getContext('2d')
    const d = ctx.getImageData(4, 4, 40, 40).data
    let r = 0, g = 0, b = 0, n = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
    return [r / n, g / n, b / n]
  }
  const a = corner(swapCut), b = corner(keepCut)
  const cornerDiff = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
  return {
    err: null,
    transparentRatio: transparent / total,
    opaqueRatio: opaque / total,
    cornerDiff,
    swapCorner: a.map((v) => Math.round(v)),
    keepCorner: b.map((v) => Math.round(v)),
  }
})
const secs = ((Date.now() - t0) / 1000).toFixed(1)
if (rmbg.err) {
  console.log('  RMBG 실패:', rmbg.err, `(${secs}s)`)
  console.log('  => 누끼 배경합성 FAIL')
} else {
  console.log(`  누끼 투명 비율=${rmbg.transparentRatio.toFixed(3)} 불투명 비율=${rmbg.opaqueRatio.toFixed(3)} (${secs}s)`)
  console.log(`  배경교체 코너 색상 ${JSON.stringify(rmbg.swapCorner)} vs 원본 ${JSON.stringify(rmbg.keepCorner)} diff=${rmbg.cornerDiff.toFixed(0)}`)
  const rmbgOK = rmbg.transparentRatio > 0.05 && rmbg.opaqueRatio > 0.1 && rmbg.cornerDiff > 60
  console.log('  => 누끼 배경합성', rmbgOK ? 'PASS' : 'FAIL')
}

await browser.close()
