import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Hero from './components/Hero'
import Booth from './components/Booth'
import Editor from './components/Editor'
import { getEngine, onModelProgress, removeBackground } from './lib/removeBg'
import {
  CUT_W,
  CUT_H,
  renderCut,
  composeStrip,
  drawCover,
  loadImage,
  downloadCanvas,
  canvasToBlob,
  formatDate,
  filterCssFor,
  DEFAULT_BG,
  type BgSpec,
  type FilterId,
  type LayoutId,
  type DecoId,
} from './lib/photobooth'

type Phase = 'intro' | 'capture' | 'edit'
type CutoutStatus = 'none' | 'pending' | 'done' | 'error'
type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

const SAMPLE_URLS = ['/samples/sample-1.png', '/samples/sample-2.png']

function makeOriginal(src: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = CUT_W
  c.height = CUT_H
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  drawCover(ctx, src, 0, 0, CUT_W, CUT_H)
  return c
}

const emptyStatus: CutoutStatus[] = ['none', 'none', 'none', 'none']

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [captureMode, setCaptureMode] = useState<'full' | 'single'>('full')
  const [retakeIndex, setRetakeIndex] = useState(0)
  const [isSample, setIsSample] = useState(false)

  const [originals, setOriginals] = useState<HTMLCanvasElement[]>([])
  const [cutouts, setCutouts] = useState<(HTMLCanvasElement | null)[]>([null, null, null, null])
  const [cutoutStatus, setCutoutStatus] = useState<CutoutStatus[]>(emptyStatus)

  const [bg, setBg] = useState<BgSpec>(DEFAULT_BG)
  const [filter, setFilter] = useState<FilterId>('film')
  const [layout, setLayout] = useState<LayoutId>('strip')
  const [frameColor, setFrameColor] = useState('#fbf4e6')
  const [deco, setDeco] = useState<DecoId>('heart')
  const [caption, setCaption] = useState('우리의 네컷')
  const [showDate, setShowDate] = useState(true)

  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [modelProgress, setModelProgress] = useState(0)
  const [modelError, setModelError] = useState<string | null>(null)

  const [renderedCuts, setRenderedCuts] = useState<HTMLCanvasElement[]>([])
  const [cutThumbs, setCutThumbs] = useState<string[]>([])
  const [baseThumb, setBaseThumb] = useState<string | null>(null)
  const [stripUrl, setStripUrl] = useState<string | null>(null)
  const stripCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const renderToken = useRef(0)
  const processingRef = useRef(false)

  // ---- 모델 로드 (배경 교체를 켤 때 최초 1회) ----
  useEffect(() => {
    if (bg.mode === 'original' || modelStatus !== 'idle') return
    setModelStatus('loading')
    setModelError(null)
    const off = onModelProgress(setModelProgress)
    getEngine()
      .then(() => setModelStatus('ready'))
      .catch((e) => {
        setModelStatus('error')
        setModelError(e?.message || 'AI 모델을 불러오지 못했어요.')
      })
      .finally(() => off())
  }, [bg.mode, modelStatus])

  // ---- 컷별 누끼 생성 (한 컷씩 순차) ----
  useEffect(() => {
    if (phase !== 'edit' || bg.mode === 'original' || modelStatus !== 'ready') return
    if (processingRef.current) return
    const i = cutouts.findIndex((c, idx) => c == null && cutoutStatus[idx] !== 'error' && cutoutStatus[idx] !== 'pending')
    if (i < 0 || !originals[i]) return
    processingRef.current = true
    setCutoutStatus((s) => s.map((v, idx) => (idx === i ? 'pending' : v)))
    removeBackground(originals[i])
      .then((canvas) => {
        setCutouts((prev) => {
          const n = [...prev]
          n[i] = canvas
          return n
        })
        setCutoutStatus((s) => s.map((v, idx) => (idx === i ? 'done' : v)))
      })
      .catch((err) => {
        setCutoutStatus((s) => s.map((v, idx) => (idx === i ? 'error' : v)))
        setModelError(err?.message || '인물 분리에 실패했어요.')
      })
      .finally(() => {
        processingRef.current = false
      })
  }, [phase, bg.mode, modelStatus, cutouts, cutoutStatus, originals])

  // ---- 4컷 렌더(배경+필터) ----
  useEffect(() => {
    if (phase !== 'edit' || originals.length !== 4) return
    const token = ++renderToken.current
    ;(async () => {
      try {
        const cuts = await Promise.all(
          originals.map((o, i) => renderCut(o, cutouts[i], bg, filter)),
        )
        const base = await renderCut(originals[0], cutouts[0], bg, 'none')
        if (token !== renderToken.current) return
        setRenderedCuts(cuts)
        setCutThumbs(cuts.map((c) => c.toDataURL('image/png')))
        setBaseThumb(base.toDataURL('image/png'))
      } catch (e) {
        console.error(e)
      }
    })()
  }, [phase, originals, cutouts, bg, filter])

  // ---- 스트립 합성 ----
  useEffect(() => {
    if (renderedCuts.length !== 4) return
    try {
      const { canvas } = composeStrip(renderedCuts, {
        layout,
        frameColor,
        deco,
        caption,
        showDate,
        date: new Date(),
      })
      stripCanvasRef.current = canvas
      setStripUrl(canvas.toDataURL('image/png'))
      setSaveError(null)
    } catch (e) {
      setSaveError((e as Error).message)
    }
  }, [renderedCuts, layout, frameColor, deco, caption, showDate])

  // ---- 검증용 훅 노출 ----
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__nekut = {
      loadImage,
      makeOriginal,
      removeBackground,
      renderCut,
      composeStrip,
      canvasToBlob,
      CUT_W,
      CUT_H,
    }
  }, [])

  // ---- 핸들러 ----
  const resetCutouts = useCallback(() => {
    setCutouts([null, null, null, null])
    setCutoutStatus(emptyStatus)
  }, [])

  const handleStart = useCallback(() => {
    setCaptureMode('full')
    setPhase('capture')
  }, [])

  const handleUseSamples = useCallback(async () => {
    const imgs = await Promise.all(SAMPLE_URLS.map(loadImage))
    const src = [imgs[0], imgs[1], imgs[0], imgs[1]].map(makeOriginal)
    setOriginals(src)
    resetCutouts()
    setIsSample(true)
    setPhase('edit')
  }, [resetCutouts])

  const handleComplete = useCallback(
    (cuts: HTMLCanvasElement[]) => {
      setOriginals(cuts)
      resetCutouts()
      setIsSample(false)
      setPhase('edit')
    },
    [resetCutouts],
  )

  const handleCompleteSingle = useCallback((index: number, cut: HTMLCanvasElement) => {
    setOriginals((prev) => {
      const n = [...prev]
      n[index] = cut
      return n
    })
    setCutouts((prev) => {
      const n = [...prev]
      n[index] = null
      return n
    })
    setCutoutStatus((prev) => prev.map((v, i) => (i === index ? 'none' : v)))
    setIsSample(false)
    setPhase('edit')
  }, [])

  const handleRetake = useCallback((index: number) => {
    setRetakeIndex(index)
    setCaptureMode('single')
    setPhase('capture')
  }, [])

  const handleRestart = useCallback(() => {
    setOriginals([])
    resetCutouts()
    setRenderedCuts([])
    setStripUrl(null)
    setIsSample(false)
    setPhase('intro')
  }, [resetCutouts])

  const handleDownload = useCallback(() => {
    if (!stripCanvasRef.current) {
      setSaveError('저장할 이미지가 아직 준비되지 않았어요.')
      return
    }
    try {
      downloadCanvas(stripCanvasRef.current, `nekut-${formatDate(new Date())}.png`)
    } catch (e) {
      setSaveError((e as Error).message)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (!stripCanvasRef.current) return
    try {
      const blob = await canvasToBlob(stripCanvasRef.current)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const CI = (window as any).ClipboardItem
      if (!CI || !navigator.clipboard?.write) throw new Error('클립보드 미지원')
      await navigator.clipboard.write([new CI({ 'image/png': blob })])
      setCopyState('ok')
    } catch {
      setCopyState('fail')
    }
    setTimeout(() => setCopyState('idle'), 1800)
  }, [])

  const liveFilterCss = useMemo(() => filterCssFor(filter), [filter])

  return (
    <div className="min-h-dvh bg-[#f6ecdb] text-ink-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <button onClick={handleRestart} className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-cherry-500 text-white shadow-md shadow-cherry-500/30">
            <span className="text-lg">◆</span>
          </span>
          <span className="text-lg font-black tracking-tight text-ink-900">
            네컷 부스<span className="text-cherry-500">.</span>
          </span>
        </button>
        <span className="hidden text-xs font-semibold text-ink-300 sm:block">
          Nekut Booth · 브라우저 포토부스
        </span>
      </header>

      <main className="pb-16">
        {phase === 'intro' && <Hero onStart={handleStart} onUseSamples={handleUseSamples} />}
        {phase === 'capture' && (
          <Booth
            mode={captureMode}
            retakeIndex={retakeIndex}
            filterCss={liveFilterCss}
            onComplete={handleComplete}
            onCompleteSingle={handleCompleteSingle}
            onCancel={() => (originals.length === 4 ? setPhase('edit') : setPhase('intro'))}
            onUseSamples={handleUseSamples}
          />
        )}
        {phase === 'edit' && (
          <Editor
            stripUrl={stripUrl}
            cutThumbs={cutThumbs}
            baseThumb={baseThumb}
            bg={bg}
            setBg={setBg}
            filter={filter}
            setFilter={setFilter}
            layout={layout}
            setLayout={setLayout}
            frameColor={frameColor}
            setFrameColor={setFrameColor}
            deco={deco}
            setDeco={setDeco}
            caption={caption}
            setCaption={setCaption}
            showDate={showDate}
            setShowDate={setShowDate}
            modelStatus={modelStatus}
            modelProgress={modelProgress}
            modelError={modelError}
            cutoutStatus={cutoutStatus}
            onRetake={handleRetake}
            onRestart={handleRestart}
            onDownload={handleDownload}
            onCopy={handleCopy}
            copyState={copyState}
            isSample={isSample}
            saveError={saveError}
          />
        )}
      </main>

      <footer className="border-t border-ink-900/5 py-6 text-center text-xs text-ink-300">
        <p>네컷 부스 · 웹캠 4컷 · AI 배경 교체 · 100% 브라우저에서 처리</p>
        <p className="mt-1">사진은 어디에도 업로드되지 않습니다.</p>
      </footer>
    </div>
  )
}
