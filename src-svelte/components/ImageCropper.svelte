<script>
  /**
   * ImageCropper.svelte — Reusable circular crop editor.
   * Mirrors the canvas drag/zoom logic from src/index.html (account + profile).
   *
   * Props:
   *   canvasSize     — px (default 280)
   *   cropRadius     — px (default 110)
   *   outSize        — output PNG size, default 200
   *
   * Usage:
   *   <ImageCropper bind:this={cropper} on:change={(e) => imgSrc = e.detail.dataUrl} />
   *   cropper.loadFile(file)
   *   cropper.reset()
   */
  import { onDestroy, createEventDispatcher } from 'svelte'

  export let canvasSize = 280
  export let cropRadius = 110
  export let outSize    = 200

  const dispatch = createEventDispatcher()

  let canvas, wrap
  let editor = {
    img: null, offsetX: 0, offsetY: 0, scale: 1,
    minScale: 0.01, maxScale: 1,
    dragging: false, lastX: 0, lastY: 0,
  }
  let zoomPct = 0
  let hasImage = false
  let dragAbort = null

  function _cropCanvas(size = outSize) {
    const out = document.createElement('canvas')
    out.width = out.height = size
    const ctx = out.getContext('2d')
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()
    const cx = canvasSize / 2
    const cropX = cx - cropRadius
    const cropW = cropRadius * 2
    const sx = (cropX - editor.offsetX) / editor.scale
    const sy = (cropX - editor.offsetY) / editor.scale
    const sw = cropW / editor.scale
    ctx.drawImage(editor.img, sx, sy, sw, sw, 0, 0, size, size)
    return out
  }

  function draw() {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvasSize, H = canvasSize
    const cx = W / 2, cy = H / 2
    ctx.clearRect(0, 0, W, H)
    if (editor.img) {
      const iw = editor.img.naturalWidth  * editor.scale
      const ih = editor.img.naturalHeight * editor.scale
      ctx.drawImage(editor.img, editor.offsetX, editor.offsetY, iw, ih)
    }
    // Dim outside crop circle
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.arc(cx, cy, cropRadius, 0, Math.PI * 2, true)
    ctx.fillStyle = 'rgba(7,7,14,0.6)'
    ctx.fill('evenodd')
    ctx.restore()
    // Crop circle border
    ctx.beginPath()
    ctx.arc(cx, cy, cropRadius, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])

    if (editor.img) {
      const dataUrl = _cropCanvas(outSize).toDataURL('image/png')
      dispatch('change', { dataUrl })
    }
  }

  function setZoomPct(scale) {
    zoomPct = Math.round(((scale - editor.minScale) / (editor.maxScale - editor.minScale)) * 100)
  }

  function applyZoom(newScale, pivotX, pivotY) {
    newScale = Math.min(editor.maxScale, Math.max(editor.minScale, newScale))
    editor.offsetX = pivotX - (pivotX - editor.offsetX) * (newScale / editor.scale)
    editor.offsetY = pivotY - (pivotY - editor.offsetY) * (newScale / editor.scale)
    editor.scale = newScale
    setZoomPct(newScale)
    draw()
  }

  function onZoomChange(e) {
    if (!editor.img) return
    applyZoom(parseFloat(e.target.value), canvasSize / 2, canvasSize / 2)
  }

  function attachDrag() {
    if (!wrap) return
    if (dragAbort) { dragAbort.abort(); dragAbort = null }
    dragAbort = new AbortController()
    const sig = { signal: dragAbort.signal }

    wrap.addEventListener('mousedown', e => {
      editor.dragging = true
      editor.lastX = e.clientX
      editor.lastY = e.clientY
      e.preventDefault()
    }, sig)
    window.addEventListener('mousemove', e => {
      if (!editor.dragging) return
      editor.offsetX += e.clientX - editor.lastX
      editor.offsetY += e.clientY - editor.lastY
      editor.lastX = e.clientX
      editor.lastY = e.clientY
      draw()
    }, sig)
    window.addEventListener('mouseup', () => { editor.dragging = false }, sig)

    wrap.addEventListener('wheel', e => {
      e.preventDefault()
      const rect = wrap.getBoundingClientRect()
      const pivotX = e.clientX - rect.left
      const pivotY = e.clientY - rect.top
      const factor = e.deltaY > 0 ? 0.93 : 1.07
      applyZoom(editor.scale * factor, pivotX, pivotY)
    }, { passive: false, signal: dragAbort.signal })
  }

  function detachDrag() {
    if (dragAbort) { dragAbort.abort(); dragAbort = null }
    editor.dragging = false
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  export function loadFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        editor.img = img
        const cropDiam = cropRadius * 2
        const initScale = Math.max(cropDiam / img.naturalWidth, cropDiam / img.naturalHeight)
        editor.scale    = initScale
        editor.minScale = initScale * 0.5
        editor.maxScale = initScale * 5
        editor.offsetX = (canvasSize - img.naturalWidth  * initScale) / 2
        editor.offsetY = (canvasSize - img.naturalHeight * initScale) / 2
        setZoomPct(initScale)
        hasImage = true
        draw()
        attachDrag()
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  export function reset() {
    editor = { img: null, offsetX: 0, offsetY: 0, scale: 1, minScale: 0.01, maxScale: 1, dragging: false, lastX: 0, lastY: 0 }
    hasImage = false
    detachDrag()
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvasSize, canvasSize)
    }
  }

  export function loadDataUrl(dataUrl) {
    if (!dataUrl) { reset(); return }
    const img = new Image()
    img.onload = () => {
      editor.img = img
      const cropDiam = cropRadius * 2
      const initScale = Math.max(cropDiam / img.naturalWidth, cropDiam / img.naturalHeight)
      editor.scale    = initScale
      editor.minScale = initScale * 0.5
      editor.maxScale = initScale * 5
      editor.offsetX = (canvasSize - img.naturalWidth  * initScale) / 2
      editor.offsetY = (canvasSize - img.naturalHeight * initScale) / 2
      setZoomPct(initScale)
      hasImage = true
      draw()
      attachDrag()
    }
    img.src = dataUrl
  }

  export function getCroppedDataUrl() {
    if (!editor.img) return null
    return _cropCanvas(outSize).toDataURL('image/png')
  }

  onDestroy(detachDrag)
</script>

<div class="acc-img-canvas-wrap" bind:this={wrap} style="display:{hasImage ? 'block' : 'none'}">
  <canvas bind:this={canvas} width={canvasSize} height={canvasSize}></canvas>
</div>

{#if hasImage}
  <div class="acc-img-zoom-row">
    <label>Zoom</label>
    <input
      type="range"
      min={editor.minScale}
      max={editor.maxScale}
      step={(editor.maxScale - editor.minScale) / 200}
      value={editor.scale}
      on:input={onZoomChange}
    />
    <label>{zoomPct}%</label>
  </div>
{/if}
