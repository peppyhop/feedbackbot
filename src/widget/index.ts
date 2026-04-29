// IIFE widget entry. Attaches a Shadow-DOM-rooted floating bubble to
// the host page. No globals leaked beyond __FEEDBACKBOT_ORIGIN__ (the
// origin of the widget script itself, used by api.ts to call back
// into our worker without the host page's origin getting baked in).
// Idempotent — calling twice is a no-op.

import { h, render } from 'preact'

import { Widget } from './widget'
import { WIDGET_CSS } from './styles'

const MOUNT_ATTR = 'data-feedbackbot'

// `document.currentScript` is only valid while the IIFE body runs
// synchronously — by the time `mount()` actually fires (post
// DOMContentLoaded) it's been nulled out. Capture the script's URL
// up here, then derive the origin from it lazily.
const SCRIPT_SRC = (() => {
  try {
    const cur = document.currentScript as HTMLScriptElement | null
    return cur?.src ?? ''
  } catch {
    return ''
  }
})()

function detectOrigin(): string {
  if (SCRIPT_SRC) {
    try {
      return new URL(SCRIPT_SRC).origin
    } catch {
      // Fall through to empty.
    }
  }
  return ''
}

function mount() {
  if (document.querySelector(`[${MOUNT_ATTR}]`)) return
  if (!window.__FEEDBACKBOT_ORIGIN__) {
    window.__FEEDBACKBOT_ORIGIN__ = detectOrigin()
  }

  const host = document.createElement('div')
  host.setAttribute(MOUNT_ATTR, '1')
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = WIDGET_CSS
  shadow.appendChild(style)

  const target = document.createElement('div')
  shadow.appendChild(target)

  const theme =
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

  render(h(Widget, { theme }), target)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true })
} else {
  mount()
}
