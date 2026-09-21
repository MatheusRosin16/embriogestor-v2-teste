import { useEffect, useId, useState, type ReactNode } from 'react'

export function SearchBar({value,onChange,placeholder}:{value:string,onChange:(v:string)=>void,placeholder:string}){
  return <input className="search-input" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
}

export function Modal({title,onClose,children}:{title:string,onClose:()=>void,children:ReactNode}){
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal-box" data-enter-flow="true" onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><h3>{title}</h3><button onClick={onClose}>×</button></div>
      {children}
    </div>
  </div>
}

export function Field({label,children}:{label:string,children:ReactNode}){
  return <label className="field"><span>{label}</span>{children}</label>
}

export type SearchOption={value:string;label:string;search?:string}
export function SearchableSelect({value,onChange,options,placeholder='Digite para localizar...',disabled=false}:{value:string;onChange:(v:string)=>void;options:SearchOption[];placeholder?:string;disabled?:boolean}){
  const listId='search-list-'+useId().replace(/:/g,'')
  const labelAtual=options.find(o=>o.value===value)?.label||''
  const [texto,setTexto]=useState(labelAtual)
  useEffect(()=>{setTexto(options.find(o=>o.value===value)?.label||'')},[value,options])
  return <div className="searchable-select">
    <input disabled={disabled} list={listId} value={texto} placeholder={placeholder}
      onFocus={e=>e.currentTarget.select()}
      onChange={e=>{
        const txt=e.target.value;setTexto(txt)
        const q=txt.trim().toLocaleLowerCase('pt-BR')
        const achou=options.find(o=>o.label.toLocaleLowerCase('pt-BR')===q || String(o.search||'').toLocaleLowerCase('pt-BR')===q)
        if(achou)onChange(achou.value)
        else if(!txt)onChange('')
      }}
      onBlur={()=>{
        if(!texto.trim()){onChange('');return}
        const q=texto.trim().toLocaleLowerCase('pt-BR')
        const exato=options.find(o=>o.label.toLocaleLowerCase('pt-BR')===q)
        if(exato){onChange(exato.value);setTexto(exato.label);return}
        const filtrados=options.filter(o=>(o.label+' '+(o.search||'')).toLocaleLowerCase('pt-BR').includes(q))
        if(filtrados.length===1){onChange(filtrados[0].value);setTexto(filtrados[0].label)}
        else setTexto(options.find(o=>o.value===value)?.label||texto)
      }}/>
    <datalist id={listId}>{options.map(o=><option key={o.value} value={o.label}/>)}</datalist>
  </div>
}
