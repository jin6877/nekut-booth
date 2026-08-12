import { useRef, useState } from 'react'
import {
  FILTERS,
  BG_COLORS,
  GRADIENTS,
  FRAMES,
  DECOS,
  gradientCss,
  type FilterId,
  type BgSpec,
  type BgMode,
  type LayoutId,
  type DecoId,
} from '../lib/photobooth'
import {
  DownloadIcon,
  CopyIcon,
  RefreshIcon,
  SparklesIcon,
  ImageIcon,
  CheckIcon,
  CameraIcon,
  LockIcon,
} from './icons'

type CutoutStatus = 'none' | 'pending' | 'done' | 'error'
type Tab = 'bg' | 'filter' | 'frame' | 'deco'

interface Props {
  stripUrl: string | null
  cutThumbs: string[]
  baseThumb: string | null
  bg: BgSpec
  setBg: (b: BgSpec) => void
  filter: FilterId
  setFilter: (f: FilterId) => void
  layout: LayoutId
  setLayout: (l: LayoutId) => void
  frameColor: string
  setFrameColor: (c: string) => void
  deco: DecoId
  setDeco: (d: DecoId) => void
  caption: string
  setCaption: (c: string) => void
  showDate: boolean
  setShowDate: (v: boolean) => void
  modelStatus: 'idle' | 'loading' | 'ready' | 'error'
  modelProgress: number
  modelError: string | null
  cutoutStatus: CutoutStatus[]
  onRetake: (index: number) => void
  onRestart: () => void
  onDownload: () => void
  onCopy: () => void
  copyState: 'idle' | 'ok' | 'fail'
  isSample: boolean
  saveError: string | null
}

const BG_MODES: { id: BgMode; label: string }[] = [
  { id: 'original', label: '원본' },
  { id: 'blur', label: '배경흐림' },
  { id: 'color', label: '단색' },
  { id: 'gradient', label: '그라데이션' },
  { id: 'image', label: '이미지' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-300">{title}</h4>
      {children}
    </div>
  )
}

export default function Editor(p: Props) {
  const [tab, setTab] = useState<Tab>('bg')
  const fileRef = useRef<HTMLInputElement>(null)

  const aiActive = p.bg.mode !== 'original'
  const processing = p.cutoutStatus.some((s) => s === 'pending')
  const cutoutErr = p.cutoutStatus.some((s) => s === 'error')

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    p.setBg({ ...p.bg, mode: 'image', imageUrl: url })
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'bg', label: 'AI 배경' },
    { id: 'filter', label: '필터' },
    { id: 'frame', label: '프레임' },
    { id: 'deco', label: '꾸미기' },
  ]

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ===== 프리뷰 ===== */}
      <div className="flex flex-col items-center">
        {p.isSample && (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-lilac-400/20 px-3.5 py-1.5 text-xs font-bold text-lilac-600 ring-1 ring-lilac-500/20">
            <SparklesIcon width={14} height={14} /> 샘플 인물로 미리보기 중 · 상단에서 촬영을 시작해 보세요
          </div>
        )}
        <div className="relative flex w-full flex-1 items-start justify-center rounded-3xl bg-[#efe2cd] p-5 shadow-inner sm:p-8">
          <div className="grain relative">
            {p.stripUrl ? (
              <img
                src={p.stripUrl}
                alt="네컷 미리보기"
                className="max-h-[64vh] w-auto rounded-xl drop-shadow-[0_24px_40px_rgba(80,45,30,0.35)]"
              />
            ) : (
              <div className="grid h-96 w-64 place-items-center rounded-xl bg-paper-200 text-ink-300">
                준비 중…
              </div>
            )}
            {processing && (
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-ink-900/45 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-2 text-paper-100">
                  <SparklesIcon className="animate-pulse text-cherry-300" />
                  <span className="text-sm font-bold">AI가 배경 바꾸는 중…</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 액션 */}
        <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={p.onDownload}
            className="inline-flex items-center gap-2 rounded-full bg-cherry-500 px-6 py-3 text-base font-extrabold text-white shadow-lg shadow-cherry-500/30 transition hover:-translate-y-0.5 hover:bg-cherry-600"
          >
            <DownloadIcon width={20} height={20} /> PNG 저장
          </button>
          <button
            onClick={p.onCopy}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-base font-bold text-ink-700 shadow-sm ring-1 ring-ink-900/5 transition hover:bg-paper-100"
          >
            {p.copyState === 'ok' ? (
              <CheckIcon width={18} height={18} className="text-mint-400" />
            ) : (
              <CopyIcon width={18} height={18} />
            )}
            {p.copyState === 'ok' ? '복사됨' : p.copyState === 'fail' ? '복사 실패' : '복사'}
          </button>
          <button
            onClick={p.onRestart}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-base font-bold text-ink-700 shadow-sm ring-1 ring-ink-900/5 transition hover:bg-paper-100"
          >
            <RefreshIcon width={18} height={18} /> 처음부터
          </button>
        </div>
        {p.saveError && (
          <p className="mt-2 text-sm font-semibold text-cherry-600">⚠ {p.saveError}</p>
        )}

        {/* 컷 썸네일 + 개별 재촬영 */}
        <div className="mt-5 w-full">
          <p className="mb-2 text-center text-xs font-bold text-ink-300">
            마음에 안 드는 컷은 눌러서 다시 찍기
          </p>
          <div className="flex justify-center gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => p.onRetake(i)}
                className="group relative aspect-[4/3] w-20 overflow-hidden rounded-xl bg-paper-200 ring-2 ring-ink-900/10 transition hover:ring-cherry-400 sm:w-24"
              >
                {p.cutThumbs[i] && (
                  <img src={p.cutThumbs[i]} alt={`컷 ${i + 1}`} className="h-full w-full object-cover" />
                )}
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-ink-900/0 text-white opacity-0 transition group-hover:bg-ink-900/55 group-hover:opacity-100">
                  <CameraIcon width={18} height={18} />
                  <span className="text-[10px] font-bold">재촬영</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 컨트롤 패널 ===== */}
      <div className="rounded-3xl bg-white/80 p-4 shadow-xl ring-1 ring-ink-900/5 backdrop-blur sm:p-5">
        <div className="mb-4 grid grid-cols-4 gap-1 rounded-full bg-paper-200 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full py-2 text-sm font-bold transition ${
                tab === t.id ? 'bg-cherry-500 text-white shadow' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* --- 배경 --- */}
        {tab === 'bg' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {BG_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => p.setBg({ ...p.bg, mode: m.id })}
                  className={`rounded-xl py-2.5 text-sm font-bold ring-1 transition ${
                    p.bg.mode === m.id
                      ? 'bg-lilac-400/20 text-lilac-600 ring-lilac-500/40'
                      : 'bg-paper-100 text-ink-500 ring-ink-900/5 hover:bg-paper-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {aiActive && (
              <div className="rounded-2xl bg-lilac-300/20 p-3 text-sm ring-1 ring-lilac-500/15">
                <p className="flex items-center gap-1.5 font-bold text-lilac-600">
                  <SparklesIcon width={16} height={16} /> AI가 인물만 남기고 배경을 바꿔요
                </p>
                {p.modelStatus === 'loading' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs font-semibold text-ink-500">
                      <span>AI 모델 준비 중…</span>
                      <span>{Math.round(p.modelProgress * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-200">
                      <div
                        className="h-full rounded-full bg-lilac-500 transition-all"
                        style={{ width: `${Math.max(4, p.modelProgress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-300">
                      최초 1회만 다운로드해요 (약 44MB). 이후엔 즉시 처리.
                    </p>
                  </div>
                )}
                {p.modelStatus === 'ready' && !processing && !cutoutErr && (
                  <p className="mt-1.5 text-xs font-semibold text-mint-400">✓ 배경 교체 완료</p>
                )}
                {processing && (
                  <p className="mt-1.5 text-xs font-semibold text-ink-500">컷마다 인물을 분리하는 중…</p>
                )}
                {(p.modelStatus === 'error' || cutoutErr) && (
                  <p className="mt-1.5 text-xs font-semibold text-cherry-600">
                    ⚠ {p.modelError || 'AI 처리에 실패했어요. 원본으로 표시 중이에요.'}
                  </p>
                )}
              </div>
            )}

            {p.bg.mode === 'color' && (
              <Section title="색상">
                <div className="flex flex-wrap gap-2">
                  {BG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => p.setBg({ ...p.bg, color: c })}
                      className={`h-9 w-9 rounded-full ring-2 transition ${
                        p.bg.color === c ? 'ring-cherry-500' : 'ring-ink-900/10'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full ring-2 ring-ink-900/10">
                    <span
                      className="block h-full w-full"
                      style={{ background: 'conic-gradient(from 0deg,#f06e83,#f2c14e,#8fd6c0,#a37ddb,#f06e83)' }}
                    />
                    <input
                      type="color"
                      value={p.bg.color}
                      onChange={(e) => p.setBg({ ...p.bg, color: e.target.value })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </Section>
            )}

            {p.bg.mode === 'gradient' && (
              <Section title="그라데이션">
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => p.setBg({ ...p.bg, gradientId: g.id })}
                      className={`h-14 rounded-xl text-xs font-bold text-white/90 ring-2 transition ${
                        p.bg.gradientId === g.id ? 'ring-cherry-500' : 'ring-transparent'
                      }`}
                      style={{ background: gradientCss(g.id), textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {p.bg.mode === 'image' && (
              <Section title="배경 이미지">
                <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-900/15 bg-paper-100 py-4 text-sm font-bold text-ink-500 transition hover:border-cherry-400 hover:text-cherry-600"
                >
                  <ImageIcon width={18} height={18} />
                  {p.bg.imageUrl ? '다른 이미지 선택' : '이미지 업로드'}
                </button>
                {p.bg.imageUrl && (
                  <img src={p.bg.imageUrl} alt="배경" className="mt-2 h-24 w-full rounded-xl object-cover" />
                )}
              </Section>
            )}

            {p.bg.mode === 'blur' && (
              <p className="rounded-2xl bg-paper-100 p-3 text-xs text-ink-500">
                원본 배경을 흐리게 처리해 인물을 또렷하게 만들어요. (아웃포커스 느낌)
              </p>
            )}
          </div>
        )}

        {/* --- 필터 --- */}
        {tab === 'filter' && (
          <Section title="감성 필터">
            <div className="grid grid-cols-2 gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => p.setFilter(f.id)}
                  className={`overflow-hidden rounded-xl ring-2 transition ${
                    p.filter === f.id ? 'ring-cherry-500' : 'ring-ink-900/5 hover:ring-ink-900/15'
                  }`}
                >
                  <div className="relative aspect-[4/2] w-full">
                    {p.baseThumb ? (
                      <img
                        src={p.baseThumb}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ filter: f.css === 'none' ? undefined : f.css }}
                      />
                    ) : (
                      <div className="h-full w-full bg-paper-200" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/70 to-transparent px-2 py-1 text-left text-xs font-bold text-white">
                      {f.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-300">필터는 실시간 프리뷰와 최종 저장에 모두 적용돼요.</p>
          </Section>
        )}

        {/* --- 프레임 --- */}
        {tab === 'frame' && (
          <div className="space-y-4">
            <Section title="레이아웃">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'strip', label: '세로 4컷', hint: '클래식 스트립' },
                  { id: 'grid', label: '2 × 2', hint: '그리드' },
                ] as const).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => p.setLayout(l.id)}
                    className={`rounded-xl p-3 text-left ring-2 transition ${
                      p.layout === l.id
                        ? 'bg-cherry-500/10 ring-cherry-500'
                        : 'bg-paper-100 ring-ink-900/5 hover:bg-paper-200'
                    }`}
                  >
                    <div className="mb-2 flex gap-1">
                      {l.id === 'strip' ? (
                        <div className="flex flex-col gap-0.5">
                          {[0, 1, 2, 3].map((k) => (
                            <div key={k} className="h-1.5 w-6 rounded-sm bg-ink-300" />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-0.5">
                          {[0, 1, 2, 3].map((k) => (
                            <div key={k} className="h-3 w-3 rounded-sm bg-ink-300" />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-bold text-ink-700">{l.label}</p>
                    <p className="text-[11px] text-ink-300">{l.hint}</p>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="프레임 색상">
              <div className="flex flex-wrap gap-2">
                {FRAMES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => p.setFrameColor(f.color)}
                    title={f.name}
                    className={`h-10 w-10 rounded-xl ring-2 transition ${
                      p.frameColor === f.color ? 'ring-cherry-500' : 'ring-ink-900/10'
                    }`}
                    style={{ backgroundColor: f.color }}
                  />
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* --- 꾸미기 --- */}
        {tab === 'deco' && (
          <div className="space-y-4">
            <Section title="스티커">
              <div className="grid grid-cols-4 gap-2">
                {DECOS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => p.setDeco(d.id)}
                    className={`rounded-xl py-2.5 text-sm font-bold ring-1 transition ${
                      p.deco === d.id
                        ? 'bg-cherry-500/10 text-cherry-600 ring-cherry-500/40'
                        : 'bg-paper-100 text-ink-500 ring-ink-900/5 hover:bg-paper-200'
                    }`}
                  >
                    {d.id === 'heart' ? '♡' : d.id === 'star' ? '✦' : d.id === 'confetti' ? '✷' : '−'}
                    <span className="ml-1">{d.name}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="캡션">
              <input
                type="text"
                value={p.caption}
                maxLength={18}
                onChange={(e) => p.setCaption(e.target.value)}
                placeholder="우리의 네컷 ♡"
                className="w-full rounded-xl border-none bg-paper-100 px-4 py-3 text-sm font-semibold text-ink-900 outline-none ring-1 ring-ink-900/5 placeholder:text-ink-300 focus:ring-2 focus:ring-cherry-400"
              />
            </Section>

            <Section title="날짜">
              <button
                onClick={() => p.setShowDate(!p.showDate)}
                className="flex w-full items-center justify-between rounded-xl bg-paper-100 px-4 py-3 ring-1 ring-ink-900/5"
              >
                <span className="text-sm font-bold text-ink-700">오늘 날짜 표시</span>
                <span
                  className={`relative h-6 w-11 rounded-full transition ${
                    p.showDate ? 'bg-cherry-500' : 'bg-ink-300/50'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      p.showDate ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>
            </Section>
          </div>
        )}

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-300">
          <LockIcon width={13} height={13} /> 모든 처리는 브라우저 안에서 — 사진은 서버로 전송되지 않아요
        </p>
      </div>
    </div>
  )
}
