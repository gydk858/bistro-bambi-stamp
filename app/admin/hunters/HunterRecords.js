'use client'
import {useState,useRef,useEffect} from 'react'
import s from './hunters.module.css'
export default function HunterRecords({card,stats,records,count,page,onPage,onSave,busy,dirty,animals=[],onDirty}){
 const [animal,setAnimal]=useState(animals[0]||''),[min,setMin]=useState(''),[max,setMax]=useState(''),[edit,setEdit]=useState(null),[error,setError]=useState('')
 const operation=useRef(null),hasInput=min!==''||max!==''||!!edit,st=stats.find(x=>x.animal===animal)
 useEffect(()=>{onDirty?.(hasInput);return()=>onDirty?.(false)},[hasInput,onDirty])
 function reset(){setMin('');setMax('');setEdit(null);setError('');operation.current=null}
 function change(set,v){set(v);operation.current=null}
 function save(e){e.preventDefault();setError('');if(!animal||[min,max].every(v=>v==='')||[min,max].some(v=>v!==''&&(!/^\d{1,9}(\.\d{1,3})?$/.test(v)||Number(v)<=0))||(min!==''&&max!==''&&Number(min)>Number(max))){setError('正のサイズを入力してください。最小・最大は片方だけでも保存できます。両方入力する場合は最小≦最大にしてください。');return}
 operation.current??=crypto.randomUUID();onSave({action:'size_save',animal,size_min:min,size_max:max,size_id:edit?.id,operation_id:operation.current})}
 return <section><h3>サイズ記録</h3><p className={s.muted}>動物を選び、計測した最小・最大を入力してください。討伐数は買取でのみ加算されます。</p>
 <form onSubmit={save}><fieldset disabled={busy||dirty}><div className={s.fields}>
 <label>動物<select aria-label="サイズ記録の動物" value={animal} disabled={!!edit} onChange={e=>{if(hasInput&&!confirm('入力中のサイズを破棄しますか？'))return;reset();setAnimal(e.target.value)}}>{[...new Set([...animals,...(edit?[edit.animal]:[])])].map(a=><option key={a}>{a}</option>)}</select></label>
 <label>最小サイズ<input aria-label="最小サイズ" type="number" min="0.001" max="999999999.999" step="0.001" placeholder="未計測" value={min} onChange={e=>change(setMin,e.target.value)}/></label>
 <label>最大サイズ<input aria-label="最大サイズ" type="number" min="0.001" max="999999999.999" step="0.001" placeholder="未計測" value={max} onChange={e=>change(setMax,e.target.value)}/></label></div>
 <p>現在の記録：最小 {st?.size_min??'—'} ／ 最大 {st?.size_max??'—'}　討伐数 {st?.quantity||0}頭</p>
 {error&&<p role="alert" className={s.error}>{error}</p>}<div className={s.row}><button className={s.primary} disabled={!hasInput||!animal}>{edit?'訂正を保存':'サイズを保存'}</button>{hasInput&&<button type="button" onClick={reset}>キャンセル</button>}</div>
 <p className={s.muted}>片方だけでも登録できます。新しい計測値が自己記録を更新した場合に反映します。画像の更新は「印刷画像へ反映」で行います。</p></fieldset></form>
 <details><summary>サイズの履歴・訂正（{count}件）</summary><fieldset disabled={busy||dirty||hasInput}><div className={s.history}>{records.map(r=><article key={r.id}><time>{new Date(r.created_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</time>{r.animal}：最小 {r.size_min??'—'} ／ 最大 {r.size_max??'—'}<div className={s.row}><button onClick={()=>{setAnimal(r.animal);setMin(String(r.size_min??''));setMax(String(r.size_max??''));setEdit(r);operation.current=null}}>訂正</button><button onClick={()=>{if(confirm('このサイズ記録を削除して再集計しますか？討伐数は変わりません。'))onSave({action:'size_delete',size_id:r.id,operation_id:crypto.randomUUID()})}}>削除</button></div></article>)}</div><div className={s.row}><button disabled={page===0} onClick={()=>onPage(page-1)}>前へ</button><span>{page+1} / {Math.max(1,Math.ceil(count/30))}</span><button disabled={(page+1)*30>=count} onClick={()=>onPage(page+1)}>次へ</button></div></fieldset></details></section>
}
