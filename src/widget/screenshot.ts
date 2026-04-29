// Lazy html2canvas — fetched from a public CDN on demand. Keeps the
// core widget bundle small AND avoids the cross-origin module-import
// CORS problem we'd otherwise hit when the host page (e.g.
// peppyhop.com) dynamic-imports a chunk from usefeedbackbot.com.
// jsDelivr serves with `Access-Control-Allow-Origin: *`, so this
// works on every host without per-origin CORS plumbing.

const HTML2CANVAS_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm'

type Html2CanvasFn = (
  el: Element,
  opts: { logging?: boolean; useCORS?: boolean; scale?: number },
) => Promise<HTMLCanvasElement>

export async function captureScreenshot(): Promise<string | null> {
  try {
    const mod = (await import(/* @vite-ignore */ HTML2CANVAS_CDN)) as {
      default?: Html2CanvasFn
    }
    const html2canvas = mod.default
    if (!html2canvas) throw new Error('html2canvas: missing default export')
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      scale: Math.min(window.devicePixelRatio || 1, 2),
    })
    return canvas.toDataURL('image/png')
  } catch (err) {
    console.warn('screenshot capture failed', err)
    return null
  }
}
