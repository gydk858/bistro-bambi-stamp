'use client'
import { useEffect, useId, useState } from 'react'
import { eventTextColor, parseEventTextColor } from '@/lib/event-text-color'
import s from '@/app/admin/events/events.module.css'

export default function TextColorField({label,value,onChange}) {
 const color=eventTextColor(value),[draft,setDraft]=useState(color),id=useId()
 useEffect(()=>{setDraft(color)},[color])
 const invalid=parseEventTextColor(draft)===null
 function edit(e){const next=e.target.value;setDraft(next);const parsed=parseEventTextColor(next);if(parsed&&next.trim().replace(/^#/,'').length===6)onChange(parsed)}
 function commit(){const parsed=parseEventTextColor(draft);if(parsed){setDraft(parsed);onChange(parsed)}}
 return <div className={s.textColorField}>
  <span>{label}</span><div className={s.row}>
   <input type="color" aria-label={`${label}のパレット`} value={color} onChange={e=>{setDraft(e.target.value.toUpperCase());onChange(e.target.value.toUpperCase())}}/>
   <input aria-label={`${label}のカラーコード`} aria-describedby={id} aria-invalid={invalid} value={draft} placeholder="#263427" maxLength={7} spellCheck={false} pattern="#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})" required onChange={edit} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit()}}}/>
  </div><span id={id} className={s.small}>{invalid?'#と3桁または6桁の16進数で入力してください。':'例：#8B5E3C（#なし・3桁も入力可能）'}</span>
 </div>
}
