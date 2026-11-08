'use client'
import {useState,useRef,useEffect} from 'react'
import s from './hunters.module.css'
export default function HunterRecords({card,stats,records,count,page,onPage,onSave,busy,dirty,animals=[],onDirty}){
 const [animal,setAnimal]=useState(animals[0]||''),[size,setSize]=useState(''),[edit,setEdit]=useState(null),[error,setError]=useState('')
 const operation=useRef(null),hasInput=size!==''||!!edit,st=stats.find(x=>x.animal===animal)
 useEffect(()=>{onDirty?.(hasInput);return()=>onDirty?.(false)},[hasInput,onDirty])
 function reset(){setSize('');setEdit(null);setError('');operation.current=null}
 function change(set,v){set(v);operation.current=null}
 function startEdit(r,key=null){setAnimal(r.animal);setSize(String(key?r[key]??'':r.size_min??r.size_max??''));setEdit({...r,key});setError('');operation.current=null}
 function save(e){e.preventDefault();setError('');if(!animal||!/^\d{1,9}(\.\d{1,3})?$/.test(size)||Number(size)<=0){setError('サイズを正の数で入力してください（小数点以下3桁まで）。');return}
 const values=edit?.key?{size_min:edit.size_min??'',size_max:edit.size_max??'',[edit.key]:size}:{size_min:size,size_max:size};
 if(values.size_min!==''&&values.size_max!==''&&Number(values.size_min)>Number(values.size_max)){setError('過去の範囲記録の最小が最大を超えています。訂正する値を確認してください。');return}
 operation.current??=crypto.randomUUID();onSave({action:'size_save',animal,...values,size_id:edit?.id,operation_id:operation.current})}
 return <section><h3>サイズ記録</h3><p className={s.muted}>動物を選び、計測したサイズを1つ入力してください。討伐数は買取でのみ加算されます。</p>
 <form onSubmit={save}><fieldset disabled={busy||dirty}><div className={s.fields}>
 <label>動物<select aria-label="サイズ記録の動物" value={animal} disabled={!!edit} onChange={e=>{if(hasInput&&!confirm('入力中のサイズを破棄しますか？'))return;reset();setAnimal(e.target.value)}}>{[...new Set([...animals,...(edit?[edit.animal]:[])])].map(a=><option key={a}>{a}</option>)}</select></label>
 <label>{edit?.key?(edit.key==='size_min'?'過去の最小値を訂正':'過去の最大値を訂正'):'計測サイズ'}<input aria-label="計測サイズ" type="number" min="0.001" max="999999999.999" step="0.001" placeholder="計測したサイズ" value={size} onChange={e=>change(setSize,e.target.value)}/></label></div>
 <p>現在の記録：最小 {st?.size_min??'—'} ／ 最大 {st?.size_max??'—'}　討伐数 {st?.quantity||0}頭</p>
 {error&&<p role="alert" className={s.error}>{error}</p>}<div className={s.row}><button className={s.primary} disabled={!hasInput||!animal}>{edit?'訂正を保存':'サイズを保存'}</button>{hasInput&&<button type="button" onClick={reset}>キャンセル</button>}</div>
 <p className={s.muted}>最初の計測値を最小・最大の両方に登録します。以降は過去の記録と比較して自動判定します。画像の更新は「印刷画像へ反映」で行います。</p></fieldset></form>
 <details><summary>サイズの履歴・訂正（{count}件）</summary><fieldset disabled={busy||dirty||hasInput}><div className={s.history}>{records.map(r=><article key={r.id}><time>{new Date(r.created_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}</time>{r.animal}：最小 {r.size_min??'—'} ／ 最大 {r.size_max??'—'}<div className={s.row}>{r.size_min!=null&&r.size_max!=null&&Number(r.size_min)===Number(r.size_max)?<button onClick={()=>startEdit(r)}>訂正</button>:<>{r.size_min!=null&&<button onClick={()=>startEdit(r,'size_min')}>最小値を訂正</button>}{r.size_max!=null&&<button onClick={()=>startEdit(r,'size_max')}>最大値を訂正</button>}</>}<button onClick={()=>{if(confirm('このサイズ記録を削除して再集計しますか？討伐数は変わりません。'))onSave({action:'size_delete',size_id:r.id,operation_id:crypto.randomUUID()})}}>削除</button></div></article>)}</div><div className={s.row}><button disabled={page===0} onClick={()=>onPage(page-1)}>前へ</button><span>{page+1} / {Math.max(1,Math.ceil(count/30))}</span><button disabled={(page+1)*30>=count} onClick={()=>onPage(page+1)}>次へ</button></div></fieldset></details></section>
}
