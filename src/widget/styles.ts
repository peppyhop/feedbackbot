// Shadow-DOM-scoped CSS for the widget. Pasted as a <style> child of
// the Shadow root so host-page CSS can't leak in (PLAN.md §7.4).
//
// Tokens mirror hi-tokens.jsx — dark + light kept minimal since the
// widget only shows a fixed theme determined by its own preference.

export const WIDGET_CSS = `
:host { all: initial; }

.wrap {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483647;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  color: #0a0a0a;

  --bg: #ffffff;
  --surface: #ffffff;
  --fg: #0a0a0a;
  --fg-mute: #3a362e;
  --fg-faint: #7a7368;
  --border: #0a0a0a;
  --border-soft: #b8b0a0;
  --accent: #ffe24a;
  --accent-ink: #0a0a0a;
  --danger: #c0391c;
}
.wrap.theme-dark {
  color: #f4f1ea;
  --bg: #0b0b0a;
  --surface: #141312;
  --fg: #f4f1ea;
  --fg-mute: #c4bdb0;
  --fg-faint: #7a7368;
  --border: #f4f1ea;
  --border-soft: #3a362e;
  --danger: #ff6a4a;
}

.stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
}

.panel {
  width: 360px;
  background: var(--surface);
  border: 2px solid var(--border);
  box-shadow: 6px 6px 0 0 var(--border);
  animation: slide-in .24s ease-out;
}
@keyframes slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--accent);
  color: var(--accent-ink);
  border-bottom: 2px solid var(--border);
}
.head .title { font-weight: 700; font-size: 14px; letter-spacing: -0.01em; }
.head .spacer { flex: 1; }
.head .x {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--accent-ink);
  background: transparent;
  color: var(--accent-ink);
  cursor: pointer;
}

.body { padding: 16px; }

.kinds {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1.5px solid var(--border);
  margin-bottom: 14px;
}
.kinds button {
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: none;
  background: var(--surface);
  color: var(--fg);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase;
  cursor: pointer;
}
.kinds button + button { border-left: 1.5px solid var(--border); }
.kinds button.active { background: var(--fg); color: var(--bg); }

.textwrap { border: 2px solid var(--border); background: var(--surface); }
.textwrap textarea {
  width: 100%;
  border: none; resize: none; outline: none;
  padding: 10px 12px;
  font-size: 14px; line-height: 1.45;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  background: transparent; color: var(--fg);
  box-sizing: border-box;
}
.textwrap .ctl {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-top: 1.5px solid var(--border-soft);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px; color: var(--fg-mute);
}
.ctl label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.ctl .check {
  width: 14px; height: 14px;
  border: 1.5px solid var(--border);
  display: flex; align-items: center; justify-content: center;
}
.ctl .check.on { background: var(--accent); }
.ctl .divider { width: 1px; height: 14px; background: var(--border-soft); }
.ctl .spacer { flex: 1; }
.ctl .tag { padding: 1px 6px; border: 1px solid var(--border-soft); }

.email {
  margin-top: 10px;
  display: flex; align-items: center; gap: 8px;
  border: 1.5px solid var(--border);
  padding: 8px 10px;
  background: var(--surface);
}
.email .label { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; color: var(--fg-faint); }
.email input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12px;
  color: var(--fg);
}

.foot {
  margin-top: 14px;
  display: flex; align-items: center; gap: 8px;
}
.foot .brand {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; color: var(--fg-faint);
  text-decoration: none;
  letter-spacing: 0.04em;
}
.foot .brand:hover {
  color: var(--fg-mute);
  text-decoration: underline;
}
.foot .spacer { flex: 1; }

.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 14px;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 600; font-size: 13px;
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  box-shadow: 3px 3px 0 0 var(--border);
  cursor: pointer;
  white-space: nowrap;
  transition: transform .08s, box-shadow .08s;
}
.btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 0 var(--border); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 var(--border); }
.btn.primary {
  background: var(--accent); color: var(--accent-ink); border-color: var(--accent-ink);
  box-shadow: 3px 3px 0 0 var(--accent-ink);
}
.btn.primary:hover { box-shadow: 4px 4px 0 0 var(--accent-ink); }
.btn.primary:active { box-shadow: 1px 1px 0 0 var(--accent-ink); }
.btn.ghost { box-shadow: none; background: transparent; }
.btn[disabled] { opacity: 0.5; pointer-events: none; }

.pending { padding: 44px 16px; text-align: center; }
.pending .hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px; color: var(--fg-mute);
  letter-spacing: 0.1em; text-transform: uppercase;
}
.dots { margin-top: 10px; display: flex; justify-content: center; gap: 6px; }
.dots span {
  width: 8px; height: 8px; background: var(--fg);
  animation: bounce 1s infinite alternate;
}
.dots span:nth-child(2) { animation-delay: .12s; }
.dots span:nth-child(3) { animation-delay: .24s; }
@keyframes bounce { from { opacity: .2; } to { opacity: 1; } }

.sent { padding: 24px 16px 18px; text-align: center; }
.sent .badge {
  width: 44px; height: 44px; margin: 0 auto 10px;
  background: var(--accent); color: var(--accent-ink);
  border: 2px solid var(--accent-ink);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 3px 3px 0 0 var(--accent-ink);
}
.sent .title { font-size: 20px; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 4px; }
.sent .sub { font-size: 13px; color: var(--fg-mute); margin-bottom: 14px; }
.sent .err { color: var(--danger); font-size: 13px; margin-bottom: 14px; }

.bubble {
  width: 56px; height: 56px;
  background: var(--accent); color: var(--accent-ink);
  border: 2px solid var(--border);
  box-shadow: 4px 4px 0 0 var(--border);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: transform .08s, box-shadow .08s;
}
.bubble.open { background: var(--surface); color: var(--fg); }
.bubble:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 0 var(--border); }
`
