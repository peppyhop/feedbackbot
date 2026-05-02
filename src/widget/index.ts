// IIFE widget entry. Attaches a Shadow-DOM-rooted floating bubble to
// the host page. Idempotent — calling twice is a no-op.

import { h, render } from 'preact'

import { Widget } from './widget'
import { WIDGET_CSS } from './styles'

const MOUNT_ATTR = 'data-feedbackbot'

function mount() {
  if (document.querySelector(`[${MOUNT_ATTR}]`)) return

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
