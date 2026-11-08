'use client'
import {useEffect,useRef,useState} from 'react'
import {MATERIALS,DEFAULT_PRICES,COIN_RATE,purchaseSummary} from '@/lib/hunter-purchase'
import s from './hunters.module.css'
const skin=MATERIALS.filter(m=>m.key!=='meat'),money=n=>Number(n).toLocaleString('ja-JP')
export default function HunterPurchase({card,animals,api,busy,dirty,onDirty,onSave}){
 const [rows,setRows]=useState({}),[meat,setMeat]=useState(''),[actor,setActor]=useState(''),[note,setNote]=useState(''),[editing,setEditing]=useState(null),[receipts,setReceipts]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[prices,setPrices]=useState(DEFAULT_PRICES),[rate,setRate]=useState(COIN_RATE),[retry,setRetry]=useState(0)
 const operation=useRef(null)
 const options=[...new Set([...animals,...(editing?.lines||[]).map(l=>l.animal).filter(Boolean)])]
 const lines=options.flatMap(animal=>skin.filter(m=>Number(rows[animal]?.[m.key])>0).map(m=>({animal,material:m.key,quantity:Number(rows[animal][m.key])})))
 if(Number(meat)>0)lines.push({animal:null,material:'meat',quantity:Number(meat)})
 const usedPrices=editing?.unit_prices||prices,usedRate=editing?.coin_rate||rate,summary=purchaseSummary(lines,usedPrices,usedRate)
 const hasInput=!!editing||meat!==''||note!==''||Object.values(rows).some(r=>Object.values(r).some(v=>v!==''))
 useEffect(()=>{onDirty(hasInput);return()=>onDirty(false)},[hasInput,onDirty])
 useEffect(()=>{try{setActor(localStorage.getItem('bambi-hunter-purchase-actor')||'')}catch{}},[])
 useEffect(()=>{let active=true;setLoading(true);setError('');api(`?purchases=1&hunter_id=${card.id}&purchase_page=${page}`).then(d=>{if(active){setReceipts(d.purchases);setCount(d.count);setPrices(d.prices);setRate(d.coin_rate)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[card.id,page,retry])
 function change(animal,key,value){operation.current=null;setRows(r=>({...r,[animal]:{...r[animal],[key]:value}}))}
 function reset(){operation.current=null;setEditing(null);setRows({});setMeat('');setNote('');setError('')}
 function edit(r){if(hasInput&&!confirm('入力中の内容を破棄して訂正しますか？'))return;const next={};for(const l of r.lines)if(l.material!=='meat'){next[l.animal]??={};next[l.animal][l.material]=String(l.quantity)};operation.current=null;setRows(next);setMeat(String(r.lines.find(l=>l.material==='meat')?.quantity||''));setNote(r.note);setEditing(r);setError('')}
 function send(action,r=editing){
  setError('');if(!actor.trim()){setError('受付担当者名を入力してください。');return}
  if(action==='purchase_save'&&!lines.length){setError('買取する数量を入力してください。');return}
  if(action==='purchase_save'&&[meat,...Object.values(rows).flatMap(Object.values)].some(v=>v!==''&&(!Number.isInteger(Number(v))||Number(v)<0||Number(v)>999999))){setError('数量は0〜999999の整数で入力してください。');return}
  const payload={action,id:card.id,version:card.version,actor:actor.trim(),note,...(r?{purchase_id:r.id,purchase_version:r.version}:{}),...(action==='purchase_save'?{lines}:{})}
  const signature=JSON.stringify(payload);if(operation.current?.signature!==signature)operation.current={signature,id:crypto.randomUUID()}
  try{localStorage.setItem('bambi-hunter-purchase-actor',actor.trim())}catch{}
  onSave({...payload,operation_id:operation.current.id})
 }
 return <section className={s.purchase}><h3>{editing?'買取の訂正':'素材の買取'} <small>累計 {money(card.kills)} 頭</small></h3>
 <p className={s.muted}>動物別に素材の個数を入力。皮・鳥素材1個＝1頭、肉は買取のみです。表は横にスクロールできます。</p>
 {error&&<p role="alert" className={s.error}>{error} <button type="button" disabled={busy||loading} onClick={()=>setRetry(x=>x+1)}>履歴を再取得</button></p>}
 <form onSubmit={e=>{e.preventDefault();send('purchase_save')}}><fieldset disabled={busy||dirty||loading}>
 <div className={s.fields}><label>受付担当者名<input required maxLength={40} value={actor} onChange={e=>{operation.current=null;setActor(e.target.value)}} autoComplete="off"/></label><label>肉の合計個数（討伐数には含めない）<input aria-label="肉の合計個数" type="number" min="0" max="999999" step="1" value={meat} placeholder="0" onChange={e=>{operation.current=null;setMeat(e.target.value)}}/></label></div>
 <div className={s.tableScroll}><table className={`${s.table} ${s.purchaseTable}`}><thead><tr><th>動物</th>{skin.map(m=><th key={m.key}>{m.label}<small>¥{money(usedPrices[m.key])}</small></th>)}<th>加算頭数</th></tr></thead><tbody>{options.map(a=><tr key={a}><th>{a}</th>{skin.map(m=><td key={m.key}><input aria-label={`${a} ${m.label}`} type="number" min="0" max="999999" step="1" placeholder="—" value={rows[a]?.[m.key]??''} onChange={e=>change(a,m.key,e.target.value)}/></td>)}<td>{summary.animals[a]||0} 頭</td></tr>)}</tbody><tfoot><tr><th>素材合計</th>{skin.map(m=><td key={m.key}>{summary.materials[m.key]||0}</td>)}<td>{summary.kills} 頭</td></tr></tfoot></table></div>
 <div className={s.purchaseTotal}><span>買取合計 <b>¥{money(summary.amount)}</b></span><span>支払コイン <b>{money(summary.coins)} 枚</b></span><span>{editing?'訂正後の加算':'今回追加'} <b>{money(summary.kills)} 頭</b></span></div>
 <p className={s.muted}>肉：1個 ¥{money(usedPrices.meat)} ／ ¥{usedRate}＝1コイン。{editing?'単価はこの買取の登録時のものを使用します。':''}</p>
 {editing&&<p className={s.notice}>訂正によるコイン差額：{summary.coins-editing.coins>=0?'+':''}{money(summary.coins-editing.coins)} 枚（正＝追加支払、負＝返金確認）。頭数は旧明細を置き換えて再計算します。</p>}
 <label>メモ（任意）<input maxLength={300} value={note} onChange={e=>{operation.current=null;setNote(e.target.value)}}/></label>
 <div className={s.row}><button className={s.primary} disabled={!lines.length}>{busy?'保存中…':editing?'訂正を確定':'買取を確定・討伐数へ反映'}</button>{hasInput&&<button type="button" onClick={()=>{if(confirm('入力を破棄しますか？'))reset()}}>入力をクリア</button>}</div>
 <p className={s.muted}>コインの受け渡しはゲーム内で行ってください。このボタンでゲーム内の所持金は変わりません。画像更新は保存後に「印刷画像へ反映」を押します。</p>
 </fieldset></form>
 <details className={s.section}><summary>このハンターの買取履歴（{count}件）</summary>{loading?<p>読み込み中…</p>:<div className={s.history}>{receipts.map(r=><article key={r.id}><b>{r.status==='cancelled'?'取消済み ／ ':''}¥{money(r.amount)} ／ {money(r.coins)}コイン</b><time>{new Date(r.created_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})} ／ #{r.hunter_no} {r.customer_name||'匿名'} ／ 担当：{r.actor}</time>{r.version>1&&<small>最終変更：{new Date(r.updated_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}（第{r.version}版）</small>}<details><summary>素材の明細</summary><ul>{r.lines.map((l,i)=><li key={i}>{l.animal?l.animal+' ／ ':''}{MATERIALS.find(m=>m.key===l.material)?.label||l.material}：{money(l.quantity)}個 × ¥{money(r.unit_prices[l.material])}</li>)}</ul>{r.note&&<p>{r.note}</p>}<small>受付ID：{r.id}</small></details>{r.status==='confirmed'&&<div className={s.row}><button disabled={busy||dirty||loading} onClick={()=>edit(r)}>訂正</button><button disabled={busy||dirty||hasInput||loading} onClick={()=>{if(confirm(`この買取を取り消し、対応する討伐数を戻しますか？\n${money(r.coins)}コインの返金要否はゲーム内で確認してください。`))send('purchase_cancel',r)}}>取消</button></div>}</article>)}{!receipts.length&&<p>買取履歴はありません。</p>}</div>}<div className={s.row}><button disabled={busy||loading||page===0} onClick={()=>setPage(p=>p-1)}>前へ</button><span>{page+1} / {Math.max(1,Math.ceil(count/20))}</span><button disabled={busy||loading||(page+1)*20>=count} onClick={()=>setPage(p=>p+1)}>次へ</button></div></details>
 </section>
}
