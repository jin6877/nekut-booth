// 내장 샘플 인물 사진 생성기 — 웹캠/모델 없이도 체험·검증할 수 있게
// 뚜렷한 중심 피사체(인물)를 가진 일러스트 초상을 900x675 PNG로 렌더한다.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../public/samples')
mkdirSync(OUT, { recursive: true })

const W = 900
const H = 675

function portrait({ bg, bg2, skin, skinShade, hair, hairShade, cloth, clothShade, cheek, hairStyle }) {
  const hairTop =
    hairStyle === 'bob'
      ? `<path d="M255 300 C255 150 645 150 645 300 C665 250 665 150 560 105 C520 70 380 70 340 105 C235 150 235 250 255 300 Z" fill="${hair}"/>`
      : `<path d="M262 320 C250 140 650 140 638 320 C700 300 690 150 610 108 C640 130 470 60 300 108 C210 150 205 300 262 320 Z" fill="${hair}"/>`
  const bangs =
    hairStyle === 'bob'
      ? `<path d="M330 175 C400 130 500 130 570 175 C560 250 540 268 520 260 C505 210 470 195 450 195 C430 195 395 210 380 260 C360 268 340 250 330 175 Z" fill="${hairShade}"/>`
      : `<path d="M338 185 C400 150 500 150 562 185 C548 240 520 250 500 232 C486 205 470 200 450 200 C430 200 414 205 400 232 C380 250 352 240 338 185 Z" fill="${hairShade}"/>`
  const sideHair =
    hairStyle === 'long'
      ? `<path d="M262 300 C240 460 250 560 300 620 L340 620 C300 520 300 400 320 330 Z" fill="${hairShade}"/>
         <path d="M638 300 C660 460 650 560 600 620 L560 620 C600 520 600 400 580 330 Z" fill="${hairShade}"/>`
      : ''

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${bg2}"/>
      <stop offset="100%" stop-color="${bg}"/>
    </radialGradient>
    <linearGradient id="cloth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${cloth}"/>
      <stop offset="100%" stop-color="${clothShade}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="140" cy="130" r="46" fill="#ffffff" opacity="0.14"/>
  <circle cx="770" cy="520" r="70" fill="#ffffff" opacity="0.1"/>

  <!-- 몸통/옷 -->
  <path d="M300 675 C300 540 340 470 450 470 C560 470 600 540 600 675 Z" fill="url(#cloth)"/>
  <path d="M450 470 C505 470 545 500 565 560 L335 560 C355 500 395 470 450 470 Z" fill="${clothShade}" opacity="0.5"/>
  <!-- 목 -->
  <path d="M410 430 L490 430 L488 486 C470 505 430 505 412 486 Z" fill="${skinShade}"/>
  <!-- 뒷머리 -->
  ${hairTop}
  ${sideHair}
  <!-- 얼굴 -->
  <ellipse cx="450" cy="300" rx="118" ry="132" fill="${skin}"/>
  <path d="M332 300 C332 380 360 425 450 432 C540 425 568 380 568 300 C560 340 520 360 450 360 C380 360 340 340 332 300 Z" fill="${skinShade}" opacity="0.35"/>
  <!-- 귀 -->
  <ellipse cx="336" cy="312" rx="20" ry="28" fill="${skin}"/>
  <ellipse cx="564" cy="312" rx="20" ry="28" fill="${skin}"/>
  <!-- 앞머리 -->
  ${bangs}
  <!-- 볼터치 -->
  <ellipse cx="388" cy="336" rx="26" ry="17" fill="${cheek}" opacity="0.55"/>
  <ellipse cx="512" cy="336" rx="26" ry="17" fill="${cheek}" opacity="0.55"/>
  <!-- 눈썹 -->
  <path d="M382 268 Q408 256 432 266" stroke="${hairShade}" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M468 266 Q492 256 518 268" stroke="${hairShade}" stroke-width="7" fill="none" stroke-linecap="round"/>
  <!-- 눈 -->
  <ellipse cx="405" cy="300" rx="13" ry="17" fill="#2a201b"/>
  <ellipse cx="495" cy="300" rx="13" ry="17" fill="#2a201b"/>
  <circle cx="409" cy="294" r="4.5" fill="#fff"/>
  <circle cx="499" cy="294" r="4.5" fill="#fff"/>
  <!-- 코 -->
  <path d="M448 312 Q440 336 452 344" stroke="${skinShade}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <!-- 입 -->
  <path d="M418 366 Q450 396 484 366 Q452 380 418 366 Z" fill="#c9506a"/>
  </svg>`
}

const SAMPLES = [
  {
    name: 'sample-1',
    opt: {
      bg: '#f2748c', bg2: '#f9a7b6',
      skin: '#f6cfae', skinShade: '#e8b28c',
      hair: '#3d2a22', hairShade: '#2c1d17',
      cloth: '#8fd6c0', clothShade: '#5cb79c',
      cheek: '#ef8fa2', hairStyle: 'bob',
    },
  },
  {
    name: 'sample-2',
    opt: {
      bg: '#9a7fd6', bg2: '#c3aae8',
      skin: '#f3c8a8', skinShade: '#e2ab84',
      hair: '#5a3320', hairShade: '#3f2214',
      cloth: '#f4d06a', clothShade: '#e2b23e',
      cheek: '#f09a86', hairStyle: 'long',
    },
  },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })
for (const s of SAMPLES) {
  const svg = portrait(s.opt)
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${svg}</body></html>`,
    { waitUntil: 'load' },
  )
  await page.waitForTimeout(150)
  await page.screenshot({ path: resolve(OUT, `${s.name}.png`), clip: { x: 0, y: 0, width: W, height: H } })
  console.log('wrote', s.name)
}
await browser.close()
