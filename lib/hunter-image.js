import sharp from 'sharp'
import path from 'node:path'
import {readFileSync} from 'node:fs'
let guildArtwork
function artwork(){return guildArtwork??=readFileSync(path.join(process.cwd(),'public/hunters/guild-background.png')).toString('base64')}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
// Deterministic SVG decoration keeps all live card text independent of the artwork.
function panel(x,y,w,h){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="url(#paper)" fill-opacity=".74" stroke="#76552e" stroke-width="4"/><rect x="${x+7}" y="${y+7}" width="${w-14}" height="${h-14}" rx="2" fill="url(#grain)" stroke="#c5a263" stroke-width="1"/>${[[x,y,0],[x+w,y,90],[x+w,y+h,180],[x,y+h,270]].map(([a,b,r])=>`<g transform="translate(${a} ${b}) rotate(${r})"><path d="M2 2H40L2 40Z" fill="url(#brass)" stroke="#674720" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="#543f25"/><circle cx="11" cy="11" r="2" fill="#e3c98e"/></g>`).join('')}`}
function guildFrame(height,title,contents){
 const dots=''
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${height}"><defs><linearGradient id="paper" x2=".8" y2="1"><stop stop-color="#e8d2a9"/><stop offset=".45" stop-color="#f3e4c7"/><stop offset="1" stop-color="#ccb181"/></linearGradient><linearGradient id="brass" x2="1" y2="1"><stop stop-color="#e3c88c"/><stop offset=".4" stop-color="#ac854c"/><stop offset=".6" stop-color="#e4c58a"/><stop offset="1" stop-color="#74552e"/></linearGradient><linearGradient id="leather" x2="1" y2="1"><stop stop-color="#304031"/><stop offset="1" stop-color="#17251e"/></linearGradient><pattern id="grain" width="160" height="160" patternUnits="userSpaceOnUse">${dots}<path d="M0 28L160 25M30 0L29 160M0 112L160 115" stroke="#86663a" opacity=".045"/></pattern></defs><svg x="0" y="0" width="1600" height="140" viewBox="0 0 1600 190" preserveAspectRatio="none"><image href="data:image/png;base64,${artwork()}" width="1600" height="1000" preserveAspectRatio="none"/></svg><svg x="0" y="140" width="1600" height="${height-200}" viewBox="0 190 1600 710" preserveAspectRatio="none"><image href="data:image/png;base64,${artwork()}" width="1600" height="1000" preserveAspectRatio="none"/></svg><svg x="0" y="${height-60}" width="1600" height="60" viewBox="0 900 1600 100" preserveAspectRatio="none"><image href="data:image/png;base64,${artwork()}" width="1600" height="1000" preserveAspectRatio="none"/></svg><text x="800" y="65" text-anchor="middle" fill="#e4cca0" font-family="serif" font-size="40" letter-spacing="5">BISTRO BAMBI</text><text x="800" y="104" text-anchor="middle" fill="#ddc69a" font-family="serif" font-size="19" letter-spacing="3">${title}</text><path d="M64 140H1536M64 ${height-60}H1536" stroke="#8f6e3e" stroke-width="2"/>${contents}</svg>`
}
export const HUNTER_ANIMALS=['熊','猪','馬','コヨーテ','ライオン','鶏','兎','鵜','チキンホーク','カラス']
function species(stats,configured){return [...new Set([...(configured||HUNTER_ANIMALS),...stats.map(x=>x.animal)])]}
function geometry(count){return {height:Math.max(1660,1060+count*60),rowHeight:60}}
function crown(x,y){return `<g transform="translate(${x} ${y})" fill="url(#gold)" stroke="#79521c" stroke-width="2"><path d="M2 9L12 17L21 2L30 17L40 9L35 30H7Z"/><rect x="7" y="31" width="28" height="6" rx="2"/><circle cx="21" cy="3" r="3"/><circle cx="2" cy="9" r="2"/><circle cx="40" cy="9" r="2"/></g>`}
function trophy(x,y){return `<g transform="translate(${x} ${y})" fill="url(#gold)" stroke="#79521c" stroke-width="2"><path d="M8 3H34V13Q34 27 21 28Q8 27 8 13Z"/><path d="M8 7H2V14Q2 23 13 23M34 7H40V14Q40 23 29 23" fill="none" stroke-width="3"/><path d="M18 28H24V35H31V40H11V35H18Z"/></g>`}
function badge(x,y,w,h,green=false){return `<path d="M${x+20} ${y}H${x+w-20}L${x+w} ${y+h/2}L${x+w-20} ${y+h}H${x+20}L${x} ${y+h/2}Z" fill="${green?'url(#leather)':'url(#paper)'}" stroke="#8b6837" stroke-width="3"/><path d="M${x+23} ${y+5}H${x+w-23}L${x+w-7} ${y+h/2}L${x+w-23} ${y+h-5}H${x+23}L${x+7} ${y+h/2}Z" fill="none" stroke="#d9bd82"/>`}
export function hunterTemplate(count=10){
 const {height}=geometry(count)
 return Buffer.from(guildFrame(height,'HUNTER CARD',
 badge(100,184,540,54)+badge(100,184,222,54,true)+badge(760,184,236,54)+badge(760,184,110,54,true)+
 badge(116,430,260,58,true)+panel(84,564,922,100)+badge(108,590,205,48,true)+panel(84,682,922,98)+badge(108,707,205,48,true)+
 panel(1040,176,476,604)+panel(64,850,1472,height-930)+
 `<path d="M92 552L180 510L224 530L335 483L394 520L485 500L570 540L680 493L738 520L815 471L900 530L996 508V556Z" fill="#8b8969" opacity=".15"/><path d="M104 396H960M110 814H1490" stroke="#9c7841" stroke-width="2"/><path d="M532 384L544 396L532 408L520 396ZM800 799L815 814L800 829L785 814Z" fill="url(#brass)" stroke="#76552e" stroke-width="2"/>
 <rect x="72" y="858" width="1456" height="50" fill="url(#leather)" stroke="#bfa36b" stroke-width="2"/>
 <g fill="none" stroke="#9e9b78" stroke-width="4"><path d="M1064 724L1170 535L1270 650L1380 480L1492 724Z"/><path d="M1220 380L1180 320L1185 285M1180 320L1155 315M1320 380L1360 320L1355 285M1360 320L1385 315M1220 380L1230 425L1270 450L1310 425L1320 380Z"/></g><text x="1276" y="490" text-anchor="middle" fill="#859071" font-family="serif" font-size="17" letter-spacing="3">HUNTER PORTRAIT</text>`))
}
async function opaquePNG(bg,layers){const composed=await sharp(bg).composite(layers).png().toBuffer();return sharp(composed).flatten({background:'#e8d2a9'}).removeAlpha().png().toBuffer()}
export async function renderHunterPage(settings,card,stats,getAsset,crowns=[]){
 const animals=species(stats,settings.animals),{height,rowHeight}=geometry(animals.length),layers=[]
 const bg=settings.background_id?await sharp(await getAsset(settings.background_id)).resize(1600,height,{fit:'fill'}).flatten({background:'#e8d2a9'}).png().toBuffer():await sharp(hunterTemplate(animals.length)).png().toBuffer()
 async function text(value,x,y,w,h,size,color='#352d20',bold=false){
  if(value==null||value==='')return
  const fontfile=path.join(process.cwd(),`public/fonts/rounded-x-mplus-1p-${bold?'bold':'medium'}.ttf`)
  const b=await sharp({text:{text:`<span foreground="${color}">${esc(value)}</span>`,font:`Rounded-X M+ 1p ${bold?'bold':'medium'} ${size}`,fontfile,width:w,dpi:72,rgba:true,wrap:'word-char'}}).png().toBuffer()
  layers.push({input:await sharp(b).resize({width:w,height:h,fit:'inside',withoutEnlargement:true}).png().toBuffer(),left:x,top:y})
 }
 await text('ハンタータグ',130,199,175,28,23,'#eee0b9')
 await text(card.tag||'—',345,195,270,33,29)
 await text('HR',794,199,65,30,25,'#eee0b9');await text(card.rank||'—',908,194,75,36,32,'#352d20',true)
 await text('ハンター名',136,263,800,28,25,'#716044')
 await text(card.display_name||'匿名',136,306,830,73,62,'#352d20',true)
 await text('累計討伐数',145,446,210,29,25,'#eee0b9')
 await text(`${Number(card.kills).toLocaleString('ja-JP')} 頭`,410,424,475,75,62,'#352d20',true)
 await text('受注クエスト',128,602,175,28,24,'#eee0b9');await text(card.mission||'未設定',342,580,635,70,29)
 await text('自己紹介',141,719,155,28,25,'#eee0b9');await text(card.bio||'—',342,699,635,65,28)
 await text('HUNTER PHOTO',1130,191,350,25,20,'#716044')
 if(card.photo_id)layers.push({input:await sharp(await getAsset(card.photo_id)).rotate().resize(444,536,{fit:'cover',position:'centre'}).png().toBuffer(),left:1056,top:228})
 for(const [label,x,w]of [['動物',110,250],['討伐数',565,340],['最小サイズ',1030,205],['最大サイズ',1260,240]])await text(label,x,870,w,28,24,'#eee0b9')
 const marks=[],totalLeader=crowns.find(v=>v.animal===null)?.total_max,maxCount=Math.max(1,...stats.map(a=>Number(a.quantity)||0))
 if(Number(card.kills)>0&&Number(card.kills)===Number(totalLeader))marks.push(trophy(Math.min(914,430+(`${Number(card.kills).toLocaleString('ja-JP')} 頭`).length*38),440))
 for(const [i,animal]of animals.entries()){
  const y=924+i*rowHeight,a=stats.find(v=>v.animal===animal),quantity=Number(a?.quantity||0),champion=crowns.find(v=>v.animal===animal)
  const awarded=a?.size_max!=null&&champion?.size_max!=null&&Number(a.size_max)>0&&Number(a.size_max)===Number(champion.size_max)
  const minAwarded=a?.size_min!=null&&champion?.size_min!=null&&Number(a.size_min)>0&&Number(a.size_min)===Number(champion.size_min)
  const countAwarded=quantity>0&&quantity===Number(champion?.quantity)
  marks.push(`<rect x="78" y="${y-9}" width="1444" height="${rowHeight}" fill="${i%2?'#ceb580':'#f5e8c9'}" opacity=".25"/><path d="M78 ${y+rowHeight-9}H1522" stroke="#b99b6a"/><rect x="410" y="${y+10}" width="350" height="20" rx="3" fill="#ccb98c"/>${quantity?`<rect x="410" y="${y+10}" width="${Math.max(2,350*quantity/maxCount)}" height="20" rx="3" fill="#334c38" stroke="#9f7c3f"/>`:''}${awarded?crown(1466,y-1):''}${minAwarded?crown(1190,y-1):''}${countAwarded?trophy(940,y-1):''}`)
 }
 // Horizontal rules keep the journal table visually light.
 layers.push({input:await sharp(Buffer.from(`<svg width="1600" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#fff3ab"/><stop offset=".45" stop-color="#eac04b"/><stop offset="1" stop-color="#a16c1a"/></linearGradient></defs>${marks.join('')}</svg>`)).png().toBuffer(),left:0,top:0})
 for(const [i,animal]of animals.entries()){
  const y=924+i*rowHeight,a=stats.find(v=>v.animal===animal)
  await text(animal,88,y,270,44,27)
  await text(`${Number(a?.quantity||0).toLocaleString('ja-JP')} 頭`,790,y,140,40,27)
  await text(a?.size_min==null?'—':String(Number(a.size_min)),1030,y,150,40,26)
  await text(a?.size_max==null?'—':String(Number(a.size_max)),1260,y,190,40,26)
 }
 await text('金冠：最小・最大サイズの全体記録 ／ トロフィー：最多討伐数（同率含む）',100,height-112,1380,25,19,'#716044')
 await text(`No. ${String(card.hunter_no).padStart(4,'0')}`,1280,height-45,250,25,20,'#dfc799')
 return opaquePNG(bg,layers)
}
