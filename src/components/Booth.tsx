import { useEffect, useRef, useState, useCallback } from 'react'
import { CUT_W, CUT_H } from '../lib/photobooth'
import { CameraIcon, ArrowLeftIcon, RefreshIcon } from './icons'

type CamStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'error'

interface Props {
  mode: 'full' | 'single'
  retakeIndex?: number
  filterCss: string
  onComplete: (cuts: HTMLCanvasElement[]) => void
  onCompleteSingle: (index: number, cut: HTMLCanvasElement) => void
  onCancel: () => void
  onUseSamples: () => void
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CUT_W
  canvas.height = CUT_H
  const ctx = canvas.getContext('2d')!
  const vw = video.videoWidth || 640
  const vh = video.videoHeight || 480
  const scale = Math.max(CUT_W / vw, CUT_H / vh)
  const rw = vw * scale
  const rh = vh * scale
  // 셀피처럼 좌우반전해서 저장
  ctx.save()
  ctx.translate(CUT_W, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, (CUT_W - rw) / 2, (CUT_H - rh) / 2, rw, rh)
  ctx.restore()
  return canvas
}

export default function Booth({
  mode,
  retakeIndex = 0,
  filterCss,
  onComplete,
  onCompleteSingle,
  onCancel,
  onUseSamples,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canceledRef = useRef(false)

  const [camStatus, setCamStatus] = useState<CamStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [current, setCurrent] = useState(0)
  const [done, setDone] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setCamStatus('requesting')
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCamStatus('live')
    } catch (err) {
      const e = err as DOMException
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        setCamStatus('denied')
      } else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
        setCamStatus('error')
        setErrorMsg('사용 가능한 카메라를 찾지 못했어요.')
      } else {
        setCamStatus('error')
        setErrorMsg(e.message || '카메라를 열 수 없어요.')
      }
    }
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      canceledRef.current = true
      stopCamera()
    }
  }, [startCamera, stopCamera])

  const flashOnce = useCallback(() => {
    setFlash(true)
    setTimeout(() => setFlash(false), 450)
  }, [])

  const countdownFrom = useCallback(async (n: number) => {
    for (let k = n; k >= 1; k--) {
      if (canceledRef.current) return
      setCountdown(k)
      await wait(1000)
    }
    setCountdown(null)
  }, [])

  const runSequence = useCallback(async () => {
    if (!videoRef.current || running) return
    setRunning(true)
    setDone(false)
    setThumbs([])
    const count = mode === 'single' ? 1 : 4
    const cuts: HTMLCanvasElement[] = []
    for (let i = 0; i < count; i++) {
      if (canceledRef.current) return
      setCurrent(i)
      await countdownFrom(i === 0 ? 3 : 3)
      if (canceledRef.current) return
      flashOnce()
      await wait(120)
      const cut = grabFrame(videoRef.current)
      cuts.push(cut)
      setThumbs((prev) => [...prev, cut.toDataURL('image/png')])
      if (i < count - 1) await wait(1100)
    }
    setRunning(false)
    setDone(true)
    await wait(650)
    if (canceledRef.current) return
    if (mode === 'single') onCompleteSingle(retakeIndex, cuts[0])
    else onComplete(cuts)
  }, [running, mode, countdownFrom, flashOnce, onComplete, onCompleteSingle, retakeIndex])

  const totalSlots = mode === 'single' ? 1 : 4

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <button
        onClick={onCancel}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-1.5 text-sm font-semibold text-ink-700 shadow-sm ring-1 ring-ink-900/5 transition hover:bg-white"
      >
        <ArrowLeftIcon width={16} height={16} /> 뒤로
      </button>

      <div className="relative overflow-hidden rounded-[2rem] bg-ink-900 p-3 shadow-2xl ring-1 ring-ink-900/10">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black">
          {/* 라이브 프리뷰 (누끼 없이 가볍게) */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)', filter: filterCss === 'none' ? undefined : filterCss }}
          />

          {/* 상태 오버레이 */}
          {camStatus !== 'live' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink-900/95 px-6 text-center text-paper-100">
              {camStatus === 'requesting' && (
                <>
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-paper-100/20 border-t-cherry-400" />
                  <p className="text-sm text-paper-300">카메라 권한을 확인하는 중…</p>
                </>
              )}
              {(camStatus === 'denied' || camStatus === 'error') && (
                <>
                  <CameraIcon className="text-cherry-400" width={40} height={40} />
                  <div>
                    <p className="text-base font-bold">
                      {camStatus === 'denied' ? '카메라 권한이 필요해요' : '카메라를 열 수 없어요'}
                    </p>
                    <p className="mt-1 text-sm text-paper-300">
                      {camStatus === 'denied'
                        ? '브라우저 주소창의 카메라 아이콘에서 허용해 주세요.'
                        : errorMsg}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={startCamera}
                      className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-paper-100 ring-1 ring-white/20 transition hover:bg-white/20"
                    >
                      다시 시도
                    </button>
                    <button
                      onClick={onUseSamples}
                      className="rounded-full bg-cherry-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-cherry-500/30 transition hover:bg-cherry-600"
                    >
                      샘플로 체험하기
                    </button>
                  </div>
                </>
              )}
              {camStatus === 'idle' && <p className="text-sm text-paper-300">카메라 준비 중…</p>}
            </div>
          )}

          {/* 카운트다운 */}
          {countdown != null && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                key={`${current}-${countdown}`}
                className="animate-count select-none text-[8rem] font-black text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.5)]"
                style={{ textShadow: '0 0 40px rgba(232,66,90,0.6)' }}
              >
                {countdown}
              </span>
            </div>
          )}

          {/* 컷 진행 배지 */}
          {camStatus === 'live' && mode === 'full' && (
            <div className="absolute left-3 top-3 rounded-full bg-ink-900/60 px-3 py-1 text-xs font-bold text-paper-100 backdrop-blur">
              {running || done ? `${Math.min(current + 1, 4)} / 4 컷` : '4컷 촬영'}
            </div>
          )}

          {/* 플래시 */}
          {flash && <div className="animate-flash absolute inset-0 bg-white" />}
        </div>
      </div>

      {/* 촬영된 컷 슬롯 */}
      <div className="mt-4 flex justify-center gap-2.5">
        {Array.from({ length: totalSlots }).map((_, i) => (
          <div
            key={i}
            className={`relative aspect-[4/3] w-20 overflow-hidden rounded-xl ring-2 transition sm:w-24 ${
              thumbs[i]
                ? 'ring-cherry-400'
                : running && current === i
                  ? 'animate-pulse ring-cherry-300'
                  : 'ring-ink-900/10'
            } bg-paper-200`}
          >
            {thumbs[i] ? (
              <img src={thumbs[i]} alt={`컷 ${i + 1}`} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-sm font-bold text-ink-300">
                {i + 1}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 컨트롤 */}
      <div className="mt-6 flex flex-col items-center gap-2">
        {camStatus === 'live' && !running && !done && (
          <button
            onClick={runSequence}
            className="group inline-flex items-center gap-2.5 rounded-full bg-cherry-500 px-8 py-4 text-lg font-extrabold text-white shadow-xl shadow-cherry-500/30 transition hover:-translate-y-0.5 hover:bg-cherry-600 active:translate-y-0"
          >
            <CameraIcon className="transition group-hover:rotate-6" />
            {mode === 'single' ? '이 컷 다시 찍기' : '촬영 시작'}
          </button>
        )}
        {running && (
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-500">
            <span className="h-2 w-2 animate-ping rounded-full bg-cherry-500" />
            포즈 준비! 카운트다운에 맞춰 찰칵
          </p>
        )}
        {done && (
          <p className="flex items-center gap-2 text-sm font-bold text-cherry-600">
            <RefreshIcon width={16} height={16} className="animate-spin-slow" /> 예쁘게 담는 중…
          </p>
        )}
        {camStatus === 'live' && !running && !done && (
          <p className="text-xs text-ink-300">3·2·1 카운트다운 뒤 자동으로 {totalSlots}컷을 찍어요</p>
        )}
      </div>
    </div>
  )
}
