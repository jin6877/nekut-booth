import { chromium } from 'playwright'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOCS = resolve(__dirname, '../docs')
mkdirSync(DOCS, { recursive: true })
const URL = process.env.URL || 'http://localhost:4173'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })

// 1) 히어로(첫 화면)
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
await page.screenshot({ path: resolve(DOCS, 'screenshot.png') })
console.log('wrote docs/screenshot.png')

// 2) 에디터 기본(원본 배경, 필름 필터)
await page.getByText('샘플로 미리보기').click()
await page.waitForTimeout(1800)
await page.screenshot({ path: resolve(DOCS, 'editor.png') })
console.log('wrote docs/editor.png')

// 3) AI 배경 교체(그라데이션) — 누끼 처리 완료까지 대기
await page.getByRole('button', { name: '그라데이션' }).click()
// "AI가 배경 바꾸는 중" 오버레이가 사라질 때까지(최대 150초)
const t0 = Date.now()
while (Date.now() - t0 < 150000) {
  const processing = await page.locator('text=AI가 배경 바꾸는 중').count()
  const ready = await page.locator('text=배경 교체 완료').count()
  if (ready > 0 && processing === 0) break
  await page.waitForTimeout(1500)
}
await page.waitForTimeout(1200)
await page.screenshot({ path: resolve(DOCS, 'editor-ai.png') })
console.log('wrote docs/editor-ai.png', ((Date.now() - t0) / 1000).toFixed(1) + 's')

await browser.close()
