import type { ChangeEvent, InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type?: 'date' | 'month' }

/** Layout autocontido: o botão não depende de CSS global nem do seletor :has(). */
export function ClearableDateInput({ value, onChange, type = 'date', style, ...props }: Props) {
  const limpar = () => {
    if (props.disabled || !value) return
    onChange?.({ target: { value: '' }, currentTarget: { value: '' } } as ChangeEvent<HTMLInputElement>)
  }
  return (
    <div className="embrio-clearable-date" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
      <input {...props} type={type} value={value ?? ''} onChange={onChange}
        style={{ ...style, display: 'block', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', fontSize: 16 }} />
      <button type="button" aria-label="Limpar data" title="Limpar data"
        disabled={!value || props.disabled} onClick={e => { e.preventDefault(); e.stopPropagation(); limpar() }}
        style={{ display: 'block', alignSelf: 'stretch', width: '100%', minHeight: 46, padding: '10px 12px', border: '1px solid #a7b8c5', borderRadius: 8, background: '#f2f6f9', color: '#183e5b', fontSize: 16, fontWeight: 600, opacity: !value || props.disabled ? 0.55 : 1, cursor: !value || props.disabled ? 'not-allowed' : 'pointer', touchAction: 'manipulation', position: 'relative', zIndex: 1 }}>
        Limpar data
      </button>
    </div>
  )
}
