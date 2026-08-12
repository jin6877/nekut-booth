import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers'

// 모든 추론은 브라우저 안에서만 — 사진은 절대 서버로 전송되지 않는다.
env.allowLocalModels = false

const MODEL_ID = 'briaai/RMBG-1.4'

const PROCESSOR_CONFIG = {
  do_normalize: true,
  do_pad: false,
  do_rescale: true,
  do_resize: true,
  image_mean: [0.5, 0.5, 0.5],
  feature_extractor_type: 'ImageFeatureExtractor',
  image_std: [1, 1, 1],
  resample: 2,
  rescale_factor: 0.00392156862745098,
  size: { width: 1024, height: 1024 },
}

export type EngineDevice = 'webgpu' | 'wasm'

interface Engine {
  model: PreTrainedModel
  processor: Processor
  device: EngineDevice
}

type ProgressListener = (progress: number) => void

let enginePromise: Promise<Engine> | null = null
const progressListeners = new Set<ProgressListener>()

export function onModelProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

function emitProgress(p: number) {
  for (const listener of progressListeners) listener(p)
}

async function detectWebGPU(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return false
  try {
    const adapter = await gpu.requestAdapter()
    return adapter != null
  } catch {
    return false
  }
}

async function loadEngine(): Promise<Engine> {
  const files = new Map<string, { loaded: number; total: number }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const progress_callback = (item: any) => {
    if (item?.status === 'progress' && item.total) {
      files.set(item.file, { loaded: item.loaded, total: item.total })
      let loaded = 0
      let total = 0
      for (const f of files.values()) {
        loaded += f.loaded
        total += f.total
      }
      if (total > 0) emitProgress(Math.min(0.99, loaded / total))
    }
  }

  const preferWebGPU = await detectWebGPU()
  const baseOptions = {
    // RMBG-1.4는 커스텀 아키텍처 — 베이스 클래스로 ONNX를 직접 실행한다.
    config: { model_type: 'custom' },
    progress_callback,
  }

  let model: PreTrainedModel
  let device: EngineDevice = preferWebGPU ? 'webgpu' : 'wasm'
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model = await AutoModel.from_pretrained(MODEL_ID, { ...baseOptions, device, dtype: 'fp32' } as any)
  } catch (err) {
    if (device === 'wasm') throw err
    // WebGPU 초기화 실패 시 WASM으로 폴백
    device = 'wasm'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model = await AutoModel.from_pretrained(MODEL_ID, { ...baseOptions, device, dtype: 'fp32' } as any)
  }

  const processor = await AutoProcessor.from_pretrained(MODEL_ID, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: PROCESSOR_CONFIG as any,
    progress_callback,
  })

  emitProgress(1)
  return { model, processor, device }
}

export function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = loadEngine().catch((err) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise
}

export function isEngineReady(): boolean {
  return enginePromise !== null
}

/**
 * 정지 이미지에서 인물(주요 피사체)의 알파 마스크를 뽑아 원본 해상도의
 * 투명 RGBA 캔버스를 반환한다. 라이브 영상이 아니라 캡처된 컷에만 적용해
 * 실시간 세그멘테이션의 성능 문제를 피한다.
 */
export async function removeBackground(
  source: Blob | HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  const { model, processor } = await getEngine()

  const blob =
    source instanceof HTMLCanvasElement ? await canvasToBlob(source) : source
  const image = await RawImage.fromBlob(blob)
  const { pixel_values } = await processor(image)
  const { output } = await model({ input: pixel_values })

  let maskTensor = output[0]
  // 출력이 로짓이면 시그모이드 적용 (0..1 범위 확인)
  const data = maskTensor.data as Float32Array
  const eps = 1e-5
  for (let i = 0; i < data.length; i += 101) {
    const x = data[i]
    if (x < -eps || x > 1 + eps) {
      maskTensor = maskTensor.sigmoid()
      break
    }
  }

  const mask = await RawImage.fromTensor(maskTensor.mul(255).to('uint8')).resize(
    image.width,
    image.height,
  )

  const rgba = image.clone().rgba()
  rgba.putAlpha(mask)

  const canvas = document.createElement('canvas')
  canvas.width = rgba.width
  canvas.height = rgba.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height),
    0,
    0,
  )
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 인코딩 실패'))), 'image/png')
  })
}
