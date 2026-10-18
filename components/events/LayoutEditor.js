'use client'
import { useEffect, useRef, useState } from 'react'
import s from '@/app/admin/events/events.module.css'
export function useAssetUrls(assets, accessToken) {
 const [urls,setUrls]=useState({}),key=assets.map(a=>a.id).join(',')
 useEffect(()=>{
  const controller=new AbortController(),created=[];let active=true
  setUrls({})
  Promise.all(assets.map(async a=>{
   try {const r=await fetch(`/api/event-assets/${a.id}`,{headers:accessToken?{'x-event-access':accessToken}:{},signal:controller.signal,cache:'no-store'});if(!r.ok)return null;const url=URL.createObjectURL(await r.blob());created.push(url);return [a.id,url]}catch{return null}
  })).then(pairs=>{if(active)setUrls(Object.fromEntries(pairs.filter(Boolean)));else created.forEach(URL.revokeObjectURL)})
  return ()=>{active=false;controller.abort();created.forEach(URL.revokeObjectURL)}
 // Asset content is immutable; IDs determine reloads.
 },[key,accessToken])
 return urls
}
export function newLayout(count=1) {
 return {stamp_mode:'common',background:'',stamp:'',number:{x:76,y:14,size:2},name:{x:76,y:20,size:2},slots:Array.from({length:count},(_,i)=>({id:crypto.randomUUID(),label:`枠${i+1}`,x:count===1?50:count===15?(213+(i%5)*133)/1050*100:15+(i%5)*17.5,y:count===1?50:count===15?(254+Math.floor(i/5)*127)/600*100:35+Math.floor(i/5)*50/Math.max(1,Math.ceil(count/5)-1),size:8.6,angle:0,asset_id:''}))}
}
function TransformItem({position,textItem=false,editable,chosen,onSelect,onChange,label,style,children}) {
 const gesture=useRef(null),element=useRef(null)
 const clamp=(v,min,max)=>Math.round(Math.max(min,Math.min(max,v))*10)/10
 function start(e,mode){if(!editable||e.currentTarget.closest('fieldset:disabled'))return;e.stopPropagation();e.preventDefault();onSelect?.();const r=element.current.parentElement.getBoundingClientRect(),p=position,cx=r.left+r.width*p.x/100,cy=r.top+r.height*p.y/100;gesture.current={mode,p:{...p},r,cx,cy,px:e.clientX,py:e.clientY,d:Math.max(1,Math.hypot(e.clientX-cx,e.clientY-cy)),a:Math.atan2(e.clientY-cy,e.clientX-cx)};e.currentTarget.setPointerCapture(e.pointerId)}
 function move(e){const g=gesture.current;if(!g||!editable)return;e.stopPropagation();const p=g.p;
  if(g.mode==='move')onChange?.({...p,x:clamp(p.x+(e.clientX-g.px)/g.r.width*100,0,textItem?95:100),y:clamp(p.y+(e.clientY-g.py)/g.r.height*100,0,textItem?95:100)})
  if(g.mode==='size')onChange?.({...p,size:clamp(p.size*Math.hypot(e.clientX-g.cx,e.clientY-g.cy)/g.d,1,textItem?6:40)})
  if(g.mode==='angle'){const raw=(p.angle||0)+(Math.atan2(e.clientY-g.cy,e.clientX-g.cx)-g.a)*180/Math.PI;onChange?.({...p,angle:Math.round((((raw+180)%360+360)%360-180)*10)/10})}
 }
 const handlers={onPointerMove:move,onPointerUp:()=>{gesture.current=null},onPointerCancel:()=>{gesture.current=null}}
 return <div ref={element} role="button" tabIndex={0} aria-label={label} aria-pressed={chosen} className={`${textItem?s.cardText:s.stamp} ${editable?s.transformItem:''} ${chosen&&editable?s.selectedTransform:''}`} style={{...style,transform:textItem?`rotate(${position.angle||0}deg)`:`translate(-50%,-50%) rotate(${position.angle||0}deg)`,transformOrigin:textItem?'top left':'center'}} onClick={e=>{e.stopPropagation();if(!e.currentTarget.closest('fieldset:disabled'))onSelect?.()}} onPointerDown={e=>start(e,'move')} {...handlers}
 onKeyDown={e=>{if(e.target!==e.currentTarget||e.currentTarget.closest('fieldset:disabled'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.()}if(!editable)return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();onChange?.({...position,x:clamp(position.x+d[0],0,textItem?95:100),y:clamp(position.y+d[1],0,textItem?95:100)})}}}>
  {children}
  {editable&&chosen&&<>{[['size','拡大・縮小','↘'],['angle','回転','↻']].map(([mode,title,symbol])=><button key={mode} type="button" className={`${s.transformHandle} ${mode==='size'?s.sizeHandle:s.angleHandle}`} aria-label={`${label} ${title}`} onClick={e=>e.stopPropagation()} onPointerDown={e=>start(e,mode)} {...handlers}>{symbol}</button>)}</>}
 </div>
}
export function StampBoard({layout,urls,selected=-1,editable=false,onSelect,onTransform,selectedText=null,onSelectText,onTextTransform,marked=[],showAll=false,cardNo,name}) {
 const slots=layout?.slots||[]
 if(!layout?.background)return <p className={s.empty}>台紙を登録してください。</p>
 if(!urls[layout.background])return <p className={s.empty}>台紙を読み込み中です。表示されない場合は再読込してください。</p>
 return <div className={s.board}>
  <img className={s.boardBg} src={urls[layout.background]} alt="イベントの台紙" draggable={false}/>
  {slots.map((slot,i)=>{const pressed=marked.includes(slot.id),asset=layout.stamp_mode==='individual'?slot.asset_id:layout.stamp;if(!showAll&&!pressed)return null;return <TransformItem key={slot.id} position={slot} editable={editable} chosen={editable?(!selectedText&&i===selected):pressed} onSelect={()=>onSelect?.(i)} onChange={p=>onTransform?.(slot.id,p)} label={`${i+1} ${slot.label} ${pressed?'押印済み':'未押印'}`} style={{left:`${slot.x}%`,top:`${slot.y}%`,width:`${slot.size}%`,outline:showAll?'1px dashed #52785a':undefined}}>
   {urls[asset]&&<img src={urls[asset]} alt="" draggable={false} style={{opacity:pressed?1:.4}}/>}{showAll&&<span className={s.slotBadge}>{i+1}</span>}
  </TransformItem>})}
  {[['number',cardNo?`No. ${cardNo}`:'','カード番号',14],['name',name,'お客様名',20]].map(([key,text,label,y])=>{if(!text||layout[key]?.visible===false)return null;const pos={x:76,y,size:2,angle:0,...layout[key]};return <TransformItem key={key} position={pos} textItem editable={editable} chosen={selectedText===key} onSelect={()=>onSelectText?.(key)} onChange={p=>onTextTransform?.(key,p)} label={`${label}の位置を移動`} style={{left:`${pos.x}%`,top:`${pos.y}%`,fontSize:`${pos.size}cqw`,maxWidth:`${100-pos.x}%`}}>{text}</TransformItem>})}
 </div>
}
export default function LayoutEditor({value,onChange,assets,urls,onUpload,onDeleteAsset,onResetBackground,locked,eventType}) {
 const [index,setIndex]=useState(0),[textSelection,setTextSelection]=useState(null),[trial,setTrial]=useState(false),[marked,setMarked]=useState([]),[count,setCount]=useState(value.slots?.length||1),[cols,setCols]=useState(5)
 const slots=value.slots||[],selected=slots[index],stamps=assets.filter(a=>a.kind==='stamp')
 function update(next){onChange(next);setMarked([])}
 function field(key,v){update({...value,slots:slots.map((x,i)=>i===index?{...x,[key]:v}:x)})}
 async function upload(kind,file){if(!file)return;const asset=await onUpload(kind,file);if(asset){if(kind==='background')update({...value,background:asset.id});else if(value.stamp_mode==='individual'&&selected)field('asset_id',asset.id);else update({...value,stamp:asset.id})}}
 function addSlot(){if(slots.length>=50)return;const base=selected||newLayout().slots[0];let n=slots.length+1;while(slots.some(x=>x.label===`枠${n}`))n++;update({...value,slots:[...slots,{...base,id:crypto.randomUUID(),label:`枠${n}`,x:base.x>85?base.x-5:base.x+5,y:base.y>85?base.y-5:base.y+5,asset_id:base.asset_id||value.stamp||''}]});setTextSelection(null);setIndex(slots.length);setCount(slots.length+1)}
 function removeSlot(){if(slots.length<=1||!window.confirm('選択中の枠を削除しますか？'))return;update({...value,slots:slots.filter((_,i)=>i!==index)});setIndex(Math.max(0,index-1));setCount(slots.length-1)}
 function reorder(delta){const next=index+delta;if(next<0||next>=slots.length)return;const reordered=[...slots];[reordered[index],reordered[next]]=[reordered[next],reordered[index]];update({...value,slots:reordered});setIndex(next)}
 return <section className={`${s.panel} ${s.spacer}`}><h2>台紙・スタンプ・配置</h2>{locked&&<p className={s.message}>カード発行済みのため、画像・種類・配置は固定されています。</p>}
  <fieldset disabled={locked}><div className={s.row}>{['number','name'].map(k=><label className={s.check} key={k}><input type="checkbox" checked={value[k]?.visible!==false} onChange={e=>update({...value,[k]:{...value[k],visible:e.target.checked}})}/>{k==='number'?'画像にカード番号を表示':'画像にお客様名を表示'}</label>)}</div><div className={s.dates}>
   <label>台紙（1枚）<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{upload('background',e.target.files[0]);e.target.value=''}}/></label>
   <label>スタンプ画像の方式<select value={value.stamp_mode||'common'} onChange={e=>update({...value,stamp_mode:e.target.value})}><option value="common">全枠共通</option><option value="individual">枠ごとに指定</option></select></label>
  </div><p className={s.small}>PNG・JPEG・WebP／各2MB以下。スタンプは透過PNGがおすすめです。</p>
  <button type="button" className={s.secondary} disabled={!value.background} onClick={onResetBackground}>台紙をリセット</button>
  <div className={s.row}>
   <label>{value.stamp_mode==='individual'?'選択枠の画像を追加':'共通スタンプを登録'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{upload('stamp',e.target.files[0]);e.target.value=''}}/></label>
   {value.stamp_mode!=='individual'&&<label>共通画像<select value={value.stamp||''} onChange={e=>update({...value,stamp:e.target.value})}><option value="">選択してください</option>{stamps.map((a,i)=><option key={a.id} value={a.id}>スタンプ {i+1}</option>)}</select></label>}
  </div>
  <h3 className={s.spacer}>登録済みスタンプ</h3>
  <p className={s.small}>{value.stamp_mode==='individual'?`画像を押すと、選択中の枠 ${index+1}（${selected?.label||''}）に使用します。`:'画像を押すと、全枠に使用する共通スタンプが切り替わります。'}変更後は「設定と配置を保存」を押してください。</p>
  <div className={s.stampGallery} role="group" aria-label="登録済みスタンプ">
   {stamps.map((a,i)=>{const chosen=(value.stamp_mode==='individual'?selected?.asset_id:value.stamp)===a.id;return <div key={a.id}><button type="button" aria-label={`スタンプ ${i+1} を使用`} aria-pressed={chosen} disabled={locked||(value.stamp_mode==='individual'&&!selected)} className={`${s.stampOption} ${chosen?s.chosenStamp:''}`} onClick={()=>value.stamp_mode==='individual'?field('asset_id',a.id):update({...value,stamp:a.id})}>
    <span className={s.stampThumbnail}>{urls[a.id]?<img src={urls[a.id]} alt={`スタンプ ${i+1}`}/>:<span>読込中</span>}</span><span>スタンプ {i+1}</span><span className={s.small}>{chosen?'使用中':'選択する'}</span>
   </button><button type="button" className={s.secondary} aria-label={`スタンプ ${i+1} を削除`} onClick={()=>onDeleteAsset(a.id)}>削除</button></div>})}
  </div>{!stamps.length&&<p className={s.small}>スタンプ画像を登録すると、ここに表示されます。</p>}
  <div className={`${s.row} ${s.spacer}`}><button type="button" className={s.button} disabled={slots.length>=50} onClick={addSlot}>枠を追加</button><button type="button" className={s.secondary} disabled={slots.length<=1} onClick={removeSlot}>選択中の枠を削除</button><span>{slots.length} / 50 枠</span></div>
  <p className={s.small}>枠は1つから追加できます。追加後は台紙上でドラッグして配置してください。既存の枠は動きません。</p>
  <details><summary>まとめて自動配置する</summary><div className={`${s.row} ${s.spacer}`}><label>枠数<input type="number" min="1" max="50" value={count} onChange={e=>setCount(e.target.value)}/></label><label>列数<input type="number" min="1" max="10" value={cols} onChange={e=>setCols(e.target.value)}/></label>
   <button type="button" className={s.secondary} onClick={()=>{const n=Number(count),c=Number(cols);if(!Number.isInteger(n)||n<1||n>50||!Number.isInteger(c)||c<1||c>10)return;if(!window.confirm('押印枠を自動配置し直します。現在の枠と試し押しはリセットされます。'))return;const rows=Math.ceil(n/c);update({...value,slots:newLayout(n).slots.map((x,i)=>({...x,x:c===1?50:15+i%c*70/(c-1),y:rows===1?58:35+Math.floor(i/c)*48/(rows-1),size:Math.min(8.6,60/c,25/rows),asset_id:value.stamp||''}))});setIndex(0)}}>自動配置</button>
   <button type="button" className={s.secondary} onClick={()=>{if(window.confirm('添付見本の15枠位置に戻しますか？画像は変更しません。')){update({...value,slots:newLayout(15).slots});setIndex(0);setCount(15)}}}>見本の15枠位置</button>
  </div></details></fieldset>
  <div className={`${s.row} ${s.spacer}`}><button type="button" className={trial?s.secondary:s.button} onClick={()=>setTrial(false)}>配置を編集</button><button type="button" className={trial?s.button:s.secondary} onClick={()=>setTrial(true)}>試し押し</button><span>{marked.length} / {slots.length}</span></div>
  {!trial&&<div className={`${s.row} ${s.spacer}`}><button type="button" className={s.secondary} disabled={locked} onClick={()=>setTextSelection('number')}>カード番号を選択</button><button type="button" className={s.secondary} disabled={locked} onClick={()=>setTextSelection('name')}>お客様名を選択</button><button type="button" className={s.secondary} disabled={locked} onClick={()=>setTextSelection(null)}>スタンプ枠を選択</button></div>}
  <p className={s.small}>対象を選択し、↘ をドラッグして拡大・縮小、↻ をドラッグして回転します。対象そのものをドラッグすると移動できます。</p>
  <div className={s.spacer}><StampBoard layout={value} urls={urls} selected={trial?-1:index} selectedText={textSelection} onSelectText={setTextSelection} editable={!locked&&!trial} showAll={!trial||eventType==='specific'} marked={trial?marked:slots.map(x=>x.id)} cardNo="12345" name="見本のお名前" onSelect={i=>{if(!trial){setIndex(i);setTextSelection(null);}else if(eventType==='specific')setMarked(old=>old.includes(slots[i].id)?old.filter(x=>x!==slots[i].id):[...old,slots[i].id])}} onTextTransform={(key,p)=>update({...value,[key]:p})} onTransform={(id,p)=>update({...value,slots:slots.map(s=>s.id===id?p:s)})}/></div>
  {trial?<div className={`${s.row} ${s.spacer}`}>{eventType==='sequential'&&<button type="button" className={s.button} disabled={marked.length>=slots.length} onClick={()=>setMarked(old=>[...old,slots[old.length].id])}>次の枠に押す</button>}<button type="button" className={s.secondary} onClick={()=>setMarked([])}>試し押しをクリア</button><span className={s.small}>試し押しはカードに保存されません。</span></div>:
  <fieldset disabled={locked} className={s.spacer}><div className={s.row}><label>選択する枠<select value={index} onChange={e=>{setIndex(Number(e.target.value));setTextSelection(null)}}>{slots.map((x,i)=><option value={i} key={x.id}>{i+1}：{x.label}</option>)}</select></label><button type="button" className={s.secondary} disabled={index<=0} onClick={()=>reorder(-1)}>前へ</button><button type="button" className={s.secondary} disabled={index>=slots.length-1} onClick={()=>reorder(1)}>後へ</button></div>
  {selected&&<><div className={`${s.dates} ${s.spacer}`}><label>枠名<input maxLength={40} value={selected.label} onChange={e=>field('label',e.target.value)}/></label>{value.stamp_mode==='individual'&&<label>この枠の画像<select value={selected.asset_id||''} onChange={e=>field('asset_id',e.target.value)}><option value="">選択してください</option>{stamps.map((a,i)=><option key={a.id} value={a.id}>スタンプ {i+1}</option>)}</select></label>}</div>
  <button type="button" className={s.secondary} onClick={()=>update({...value,slots:slots.map(x=>({...x,size:selected.size,angle:selected.angle}))})}>大きさ・角度を全枠に適用</button></>}
  </fieldset>}
 </section>
}
