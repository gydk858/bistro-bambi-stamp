'use client'
import {useId,useRef,useState} from 'react'
import {puzzleLayout,movePuzzleVertex} from '@/lib/puzzle-geometry'
import s from '@/app/admin/events/events.module.css'
export function PuzzleBoard({layout,urls,marked=[],showAll=false,onSelect,editing=false,onChange,cardNo,name}){
 const id=useId().replace(/:/g,''),svg=useRef(null),drag=useRef(null),slots=layout.slots||[],aspect=layout.aspect||16/9
 function move(e){if(drag.current===null||!onChange)return;const r=svg.current.getBoundingClientRect();onChange(movePuzzleVertex(layout,drag.current,[(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100]))}
 return <svg ref={svg} viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:'100%',aspectRatio:aspect,display:'block',background:'#ffffff',touchAction:editing?'none':'auto'}} onPointerMove={move} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
 <rect width="100" height="100" fill="#ffffff"/>
 {layout.puzzle_base&&<image href={urls[layout.puzzle_base]} width="100" height="100" preserveAspectRatio="none"/>}
 {layout.puzzle_mode==='import'?slots.filter(t=>marked.includes(t.id)||editing).map(t=><image key={t.id} href={urls[t.asset_id]} width="100" height="100" preserveAspectRatio="none"/>):<><defs>{slots.map((t,i)=><clipPath id={`${id}-${i}`} key={t.id}><polygon points={t.points?.map(n=>layout.vertices[n].join(',')).join(' ')}/></clipPath>)}</defs>{slots.map((t,i)=>{const pts=t.points?.map(n=>layout.vertices[n])||[],done=marked.includes(t.id);return <g key={t.id}>{(done||editing)&&<image href={urls[layout.background]} width="100" height="100" preserveAspectRatio="none" clipPath={`url(#${id}-${i})`}/>}<polygon points={pts.map(p=>p.join(',')).join(' ')} fill="transparent" stroke={showAll||editing?'#52785a':'none'} strokeWidth=".25" role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={`${i+1} ${t.label} ${done?'達成済み':'未達成'}`} onClick={e=>{if(!e.currentTarget.closest('fieldset:disabled'))onSelect?.(i)}} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!e.currentTarget.closest('fieldset:disabled')){e.preventDefault();onSelect?.(i)}}}/>{(showAll||editing)&&pts.length>0&&<text x={pts.reduce((a,p)=>a+p[0],0)/pts.length} y={pts.reduce((a,p)=>a+p[1],0)/pts.length} fontSize="2.4" fill="#1d4227" stroke="white" strokeWidth=".35" paintOrder="stroke" pointerEvents="none">{i+1}</text>}</g>})}</>}
 {editing&&layout.puzzle_mode!=='import'&&layout.vertices?.map((v,i)=><circle key={i} cx={v[0]} cy={v[1]} r=".8" fill="white" stroke="#285b3a" strokeWidth=".25" style={{cursor:'move'}} onPointerDown={e=>{if(e.currentTarget.closest('fieldset:disabled'))return;e.preventDefault();drag.current=i;e.currentTarget.setPointerCapture(e.pointerId)}}/>)}
 {[['number',cardNo?`No. ${cardNo}`:''],['name',name]].map(([k,text])=>layout[k]?.visible!==false&&text?<text key={k} x={layout[k]?.x||76} y={layout[k]?.y||14} fontSize={layout[k]?.size||2} fill="#263427">{text}</text>:null)}
 </svg>
}
export default function PuzzleEditor({value,onChange,urls,onUpload,onImport,locked}){
 const [count,setCount]=useState(value.slots?.length||14),[preview,setPreview]=useState(false),[marks,setMarks]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function baseImage(file){if(!file)return;const a=await onUpload('puzzle_base',file);if(a)onChange({...value,puzzle_base:a.id})}
 async function image(file){if(!file)return;const a=await onUpload('background',file);if(a)onChange({...value,background:a.id,aspect:a.width/a.height})}
 return <section className={s.panel}><h2>画像パズルの準備</h2>{locked&&<p>カード発行後は画像・分割・表示設定を固定します。</p>}<fieldset disabled={locked||busy}>
 <label>完成画像（1枚）<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{image(e.target.files[0]);e.target.value=''}}/></label>
 <label>未達成部分の台紙画像（任意）<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{baseImage(e.target.files[0]);e.target.value=''}}/></label>
 <p className={s.small}>未登録の場合は白です。台紙は完成画像と同じ縦横比を推奨します。異なる場合は全体に合わせて伸縮します。達成した部分から完成画像が現れます。</p>
 {value.puzzle_base&&<button type="button" className={s.secondary} onClick={()=>onChange({...value,puzzle_base:''})}>台紙を白に戻す</button>}
 <div className={s.row}><label>ピース数（1〜50）<input type="number" min="1" max="50" value={count} onChange={e=>setCount(e.target.value)}/></label><button type="button" className={s.secondary} onClick={()=>{if(!Number.isInteger(Number(count))||count<1||count>50)return;if(!confirm('分割とお題名を作り直しますか？'))return;onChange({...puzzleLayout(Number(count)),background:value.background,puzzle_base:value.puzzle_base,aspect:value.aspect,number:value.number,name:value.name});setMarks([])}}>不規則に分割・再生成</button></div>
 <p className={s.small}>白い頂点をドラッグして境界を調整できます。隣接するピースも一緒に動き、重なりや隙間ができる移動は制限します。お題の順番は自由です。</p>
 <details><summary>分割済みの透過PNGをZIPから取り込む</summary><p className={s.small}>同じキャンバス寸法の透過PNGを1〜50枚。ZIPは4MB以下。元の位置のまま重ね、配置調整を省略します。取り込むと現在の分割とお題名を置き換えます。</p><input type="file" accept=".zip" aria-label="分割済みピースZIP" onChange={async e=>{const file=e.target.files[0];e.target.value='';if(!file||!confirm('ZIPのピースで分割とお題名を置き換えますか？'))return;setBusy(true);setError('');try{const data=await onImport(file);onChange({...data.layout,puzzle_base:value.puzzle_base});setCount(data.layout.slots.length);setMarks([])}catch(x){setError(x.message)}finally{setBusy(false)}}}/></details>
 {busy&&<p role="status">ピースを取り込んでいます…</p>}{error&&<p role="alert">{error}</p>}
 <div className={s.row}>{['number','name'].map(k=><label key={k} className={s.check}><input type="checkbox" checked={value[k]?.visible!==false} onChange={e=>onChange({...value,[k]:{...value[k],visible:e.target.checked}})}/>{k==='number'?'画像にカード番号を表示':'画像にお客様名を表示'}</label>)}</div>
 </fieldset><label className={s.check}><input type="checkbox" checked={preview} onChange={e=>setPreview(e.target.checked)}/>参加者画像を試す（保存しません）</label>
 <fieldset disabled={!preview&&locked}><PuzzleBoard layout={value} urls={urls} editing={!preview&&!locked} showAll={!preview} marked={marks} onChange={onChange} cardNo={1} name="見本のお名前" onSelect={preview?i=>setMarks(m=>m.includes(value.slots[i].id)?m.filter(x=>x!==value.slots[i].id):[...m,value.slots[i].id]):undefined}/></fieldset>
 <div className={s.row}><button type="button" className={s.secondary} onClick={()=>{setPreview(true);setMarks([])}}>未達成を確認</button><button type="button" className={s.secondary} onClick={()=>{setPreview(true);setMarks(value.slots.map(t=>t.id))}}>完成状態を確認</button></div>
 <div className={s.slotChoices}>{value.slots.map((t,i)=><div key={t.id}><label>お題 {i+1}<input disabled={locked||busy} maxLength={40} value={t.label} onChange={e=>onChange({...value,slots:value.slots.map((x,j)=>j===i?{...x,label:e.target.value}:x)})}/></label>{preview&&<label className={s.check}><input type="checkbox" checked={marks.includes(t.id)} onChange={e=>setMarks(m=>e.target.checked?[...m,t.id]:m.filter(x=>x!==t.id))}/>達成を試す</label>}</div>)}</div>
 </section>
}
