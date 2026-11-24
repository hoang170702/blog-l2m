import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import {
  centeredView,
  clampView,
  cropRect,
  minZoom,
  sliderToZoom,
  viewScale,
  zoomToSlider,
  zoomView,
  type CropView,
  type Size,
} from '../lib/crop'
import { outputSize, shapeRatio, type CropRect, type ImageShape } from '../lib/image'

/**
 * Lets the user pick the part of an image to keep: drag to move, slider or wheel to zoom.
 * The frame has the shape's ratio (16:9 cover, round avatar); `onConfirm` gets source pixels.
 */
export function ImageCropper({
  file,
  shape,
  onCancel,
  onConfirm,
}: {
  file: File
  shape: ImageShape
  onCancel: () => void
  onConfirm: (crop: CropRect) => void
}) {
  const [url] = useState(() => URL.createObjectURL(file))
  const [image, setImage] = useState<Size | null>(null)
  const [frame, setFrame] = useState<Size | null>(null)
  // Null until the user moves or zooms; the frame starts centered.
  const [moved, setView] = useState<CropView | null>(null)
  const [dragging, setDragging] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; view: CropView } | null>(null)
  const ratio = shapeRatio(shape)

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  useLayoutEffect(() => {
    const width = frameRef.current?.clientWidth || 480
    setFrame({ width, height: width / ratio })
  }, [ratio])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const view = image && frame ? (moved ?? centeredView(image, frame)) : null
  const ready = image && frame && view
  const scale = ready ? viewScale(view, image, frame) : 1
  const crop = ready ? cropRect(view, image, frame) : null
  // The saved image is never upscaled, so a small crop shows up soft next to sharp covers.
  const lowResolution = crop
    ? outputSize(crop, shape).width < (shape === 'cover' ? 960 : 200)
    : false

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!view) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, view }
    setDragging(true)
  }

  function endDrag() {
    drag.current = null
    setDragging(false)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !image || !frame) return
    const start = drag.current
    setView(
      clampView(
        {
          ...start.view,
          x: start.view.x + event.clientX - start.x,
          y: start.view.y + event.clientY - start.y,
        },
        image,
        frame,
      ),
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chọn vùng ảnh"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
    >
      <div className="card w-full max-w-2xl space-y-4 p-5">
        <p className="font-bold">
          {shape === 'avatar' ? 'Chọn vùng ảnh đại diện' : 'Chọn vùng ảnh bìa'}
        </p>
        <div
          ref={frameRef}
          className={`relative w-full touch-none overflow-hidden bg-canvas select-none ${
            shape === 'avatar' ? 'mx-auto max-w-sm rounded-full' : 'rounded-2xl'
          } ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ aspectRatio: String(ratio) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={(event) => {
            if (ready) setView(zoomView(view, view.zoom * (1 - event.deltaY / 500), image, frame))
          }}
        >
          {/* Shown around a zoomed-out picture, like the blurred fill drawn when it is saved. */}
          <img
            src={url}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-xl"
          />
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(event) =>
              setImage({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            className="absolute top-0 left-0 max-w-none origin-top-left"
            style={
              ready
                ? {
                    width: image.width * scale,
                    height: image.height * scale,
                    transform: `translate(${view.x}px, ${view.y}px)`,
                  }
                : { visibility: 'hidden' }
            }
          />
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold">
          Thu phóng
          <span aria-hidden="true">−</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={ready ? zoomToSlider(view.zoom, minZoom(image, frame)) : 0}
            disabled={!ready}
            onChange={(event) =>
              ready &&
              setView(
                zoomView(
                  view,
                  sliderToZoom(Number(event.target.value), minZoom(image, frame)),
                  image,
                  frame,
                ),
              )
            }
            className="flex-1 accent-primary"
            aria-label="Thu phóng"
          />
          <span aria-hidden="true">+</span>
        </label>
        <p className="text-xs text-muted">
          Kéo ảnh để chọn góc. Thanh trượt ở giữa là vừa khung: sang phải để phóng to, sang trái để
          thu nhỏ giữ nguyên cả ảnh (phần trống được phủ bằng ảnh làm mờ).
          {lowResolution && (
            <span className="block font-semibold text-secondary-dark">
              Vùng chọn nhỏ hơn khung hiển thị nên ảnh có thể hơi mờ; thu nhỏ lại hoặc dùng ảnh gốc
              lớn hơn.
            </span>
          )}
        </p>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Huỷ
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!crop}
            onClick={() => crop && onConfirm(crop)}
          >
            Dùng ảnh này
          </button>
        </div>
      </div>
    </div>
  )
}
