'use client'
import { useEffect, useRef, useState } from 'react'
import s from '@/app/admin/events/events.module.css'

export default function EventPrintPreview({eventId,layout,eventType}) {
 const [number,setNumber]=useState('12345'),[name,setName]=useState('見本のお名前'),[filled,setFilled]=useState(false)
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const requestRef=useRef(null),generation=useRef(0)
 const signature=JSON.stringify([eventId,layout,eventType,number,name,filled])
 useEffect(()=>()=>{generation.current++;requestRef.current?.abort()},[])
 useEffect(()=>()=>{if(result)URL.revokeObjectURL(result.url)},[result])
 async function preview(){
  if(!/^[0-9]{1,18}$/.test(number)){setError('見本の番号を1〜18桁の半角数字で入力してください。');return}
  requestRef.current?.abort();const controller=new AbortController(),seq=++generation.current;requestRef.current=controller
  setBusy(true);setError('')
  try{
   const response=await fetch('/api/event-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:eventId,layout,event_type:eventType,card_no:number,display_name:name,filled}),signal:controller.signal,cache:'no-store'})
   if(!response.ok){const data=await response.json();throw Error(data.error||'プレビューを作成できませんでした。')}
   const blob=await response.blob();if(seq!==generation.current)return
   setResult({url:URL.createObjectURL(blob),signature})
  }catch(e){if(e.name!=='AbortError'&&seq===generation.current)setError(e.message)}
  finally{if(seq===generation.current)setBusy(false)}
 }
 return <section className={s.spacer} aria-label="発行前の印刷プレビュー"><h3>発行前の印刷プレビュー</h3>
  <p className={s.small}>編集中の設定から印刷画像を作成します。カードの発行・番号の消費・設定の保存は行いません。</p>
  <div className={s.row}><label>見本の番号<input value={number} maxLength={18} inputMode="numeric" onChange={e=>setNumber(e.target.value.replace(/[^0-9]/g,''))}/></label><label>見本のお客様名（任意）<input value={name} maxLength={40} onChange={e=>setName(e.target.value)}/></label><label className={s.check}><input type="checkbox" checked={filled} onChange={e=>setFilled(e.target.checked)}/>全枠に押した状態</label><button type="button" className={s.secondary} disabled={busy||!eventId||!layout?.background} onClick={preview}>{busy?'画像を作成中…':'印刷プレビュー'}</button></div>
  {error&&<p role="alert" className={s.message}>{error}</p>}
  {result&&<>{result.signature!==signature&&<p role="status" className={s.message}>設定が変わっています。「印刷プレビュー」を押して画像を更新してください。</p>}<img className={s.preview} src={result.url} alt="発行前の印刷プレビュー"/><a className={s.secondary} href={result.url} download="event-print-preview.png">プレビューPNGを保存</a></>}
 </section>
}
