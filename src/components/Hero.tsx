import { CameraIcon, SparklesIcon, LockIcon } from './icons'

interface Props {
  onStart: () => void
  onUseSamples: () => void
}

const CUTS = [
  { src: '/samples/sample-1.png', filter: 'sepia(0.22) contrast(1.06) saturate(0.92)' },
  { src: '/samples/sample-2.png', filter: 'saturate(1.4) contrast(1.12)' },
  { src: '/samples/sample-1.png', filter: 'grayscale(1) contrast(1.12)' },
  { src: '/samples/sample-2.png', filter: 'sepia(0.3) saturate(1.14) brightness(1.05)' },
]

function StripPreview() {
  return (
    <div className="relative">
      <div className="animate-float [--r:4deg] absolute -left-6 top-6 -z-0 hidden h-full w-[210px] rotate-6 rounded-[1.6rem] bg-lilac-300/60 sm:block" />
      <div className="animate-float relative z-10 w-[210px] rotate-[-4deg] rounded-[1.6rem] bg-paper-50 p-3 shadow-[0_30px_60px_-20px_rgba(80,40,30,0.45)] ring-1 ring-ink-900/5">
        <div className="grain relative flex flex-col gap-2 overflow-hidden rounded-[1.1rem]">
          {CUTS.map((c, i) => (
            <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-paper-200">
              <img
                src={c.src}
                alt=""
                className="h-full w-full object-cover"
                style={{ filter: c.filter, transform: i % 2 ? 'scaleX(-1)' : undefined }}
              />
            </div>
          ))}
        </div>
        <div className="px-1 pb-1 pt-2.5 text-center">
          <p className="font-hand text-lg font-bold leading-none text-cherry-600">우리의 네컷 ♡</p>
          <p className="mt-1 text-[10px] font-semibold tracking-wider text-ink-300">NEKUT · 2026.08.12</p>
        </div>
      </div>
      {/* 떠다니는 스티커 */}
      <div className="animate-float [--r:12deg] absolute -right-5 -top-4 z-20 grid h-12 w-12 place-items-center rounded-2xl bg-butter-400 text-2xl shadow-lg">✷</div>
      <div className="animate-float [--r:-10deg] absolute -bottom-3 -left-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-cherry-500 text-xl text-white shadow-lg">♡</div>
    </div>
  )
}

export default function Hero({ onStart, onUseSamples }: Props) {
  return (
    <div className="relative overflow-hidden">
      {/* 배경 블롭 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cherry-300/30 blur-3xl" />
        <div className="absolute -right-16 top-32 h-72 w-72 rounded-full bg-lilac-300/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-butter-400/25 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
        <div className="animate-fade-up text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-bold text-cherry-600 shadow-sm ring-1 ring-cherry-500/15">
            <SparklesIcon width={14} height={14} /> 무료 · 무설치 · 워터마크 없음
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight text-ink-900 sm:text-6xl">
            집에서 찍는
            <br />
            <span className="relative whitespace-nowrap text-cherry-500">
              AI 네컷
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none">
                <path d="M2 8C40 3 160 3 198 8" stroke="#a37ddb" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-ink-900"> 부스</span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-ink-500 sm:text-lg lg:mx-0">
            웹캠으로 4컷을 자동 촬영하고, <b className="text-ink-700">AI가 배경을 바꿔</b> 감성
            프레임까지 얹어 네컷 스트립으로 저장해요. 프사·커플·모임용으로 딱.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <button
              onClick={onStart}
              className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-cherry-500 px-8 py-4 text-lg font-extrabold text-white shadow-xl shadow-cherry-500/30 transition hover:-translate-y-0.5 hover:bg-cherry-600 active:translate-y-0 sm:w-auto"
            >
              <CameraIcon className="transition group-hover:rotate-6" /> 촬영 시작
            </button>
            <button
              onClick={onUseSamples}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/80 px-6 py-4 text-base font-bold text-ink-700 shadow-sm ring-1 ring-ink-900/5 transition hover:bg-white sm:w-auto"
            >
              <SparklesIcon width={18} height={18} className="text-lilac-500" /> 샘플로 미리보기
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-500 lg:justify-start">
            <span className="inline-flex items-center gap-1.5">
              <LockIcon width={16} height={16} className="text-mint-400" /> 사진은 기기 밖으로 안 나가요
            </span>
            <span className="inline-flex items-center gap-1.5">
              <SparklesIcon width={16} height={16} className="text-butter-500" /> 브라우저에서 바로 실행
            </span>
          </div>
        </div>

        <div className="flex animate-pop-in justify-center lg:justify-end">
          <StripPreview />
        </div>
      </div>
    </div>
  )
}
