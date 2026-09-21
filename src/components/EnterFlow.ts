export function handleEnterFlow(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return

  const target = e.target as HTMLElement
  if (target.tagName === 'TEXTAREA') return

  const form = target.closest('[data-enter-flow="true"]')
  if (!form) return

  const campos = Array.from(
    form.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[data-enter-final="true"]'
    )
  ).filter(el => el.offsetParent !== null)

  const idx = campos.indexOf(target)
  if (idx < 0) return

  e.preventDefault()

  const prox = campos[idx + 1]
  if (prox) {
    prox.focus()
    if (prox instanceof HTMLInputElement && ['text','search','number','date','email','tel'].includes(prox.type)) {
      try { prox.select() } catch {}
    }
  }
}
