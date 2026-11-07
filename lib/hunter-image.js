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
function geometry(count){return {height:Math.max(1540,980+Math.ceil(count/2)*108),columns:2,rowHeight:108}}
// A single canvas: one title, one continuous parchment, no stitched cards.
export function hunterTemplate(count=10){
 const {height}=geometry(count)
 return Buffer.from(guildFrame(height,'HUNTER CARD / FIELD JOURNAL',
 panel(64,160,1000,90)+panel(64,270,1000,150)+panel(64,440,1000,150)+panel(64,610,1000,150)+panel(1088,160,448,600)+panel(64,820,1472,height-900)+
 `<g fill="none" stroke="#9e9b78" stroke-width="4"><path d="M1112 690L1200 530L1260 610L1380 450L1510 690Z"/><path d="M1220 380L1180 320M1180 320L1155 315M1180 320L1185 285M1320 380L1360 320M1360 320L1385 315M1360 320L1355 285M1220 380L1230 425L1270 450L1310 425L1320 380Z"/></g><text x="1310" y="490" text-anchor="middle" fill="#859071" font-family="serif" font-size="17" letter-spacing="3">HUNTER PORTRAIT</text>`))
}
async function opaquePNG(bg,layers){const composed=await sharp(bg).composite(layers).png().toBuffer();return sharp(composed).flatten({background:'#e8d2a9'}).removeAlpha().png().toBuffer()}
export async function renderHunterPage(settings,card,stats,getAsset){
 const animals=species(stats,settings.animals),{height,rowHeight}=geometry(animals.length),layers=[]
 const bg=settings.background_id?await sharp(await getAsset(settings.background_id)).resize(1600,height,{fit:'fill'}).flatten({background:'#e8d2a9'}).png().toBuffer():await sharp(hunterTemplate(animals.length)).png().toBuffer()
 async function text(value,x,y,w,h,size,color='#352d20',bold=false){
  if(value==null||value==='')return
  const fontfile=path.join(process.cwd(),`public/fonts/rounded-x-mplus-1p-${bold?'bold':'medium'}.ttf`)
  const b=await sharp({text:{text:`<span foreground="${color}">${esc(value)}</span>`,font:`Rounded-X M+ 1p ${bold?'bold':'medium'} ${size}`,fontfile,width:w,dpi:72,rgba:true,wrap:'word-char'}}).png().toBuffer()
  layers.push({input:await sharp(b).resize({width:w,height:h,fit:'inside',withoutEnlargement:true}).png().toBuffer(),left:x,top:y})
 }
 await text('ハンタータグ',88,176,700,23,19,'#716044');await text(card.tag||'—',88,207,730,32,26)
 await text('HR',890,176,140,23,19,'#716044');await text(card.rank||'—',890,204,140,36,32,'#352d20',true)
 await text('ハンター名',88,286,900,22,19,'#716044');await text(card.display_name||'匿名',88,315,940,48,38,'#352d20',true)
 await text(`累計狩猟頭数　${Number(card.kills).toLocaleString('ja-JP')} 頭`,88,374,940,32,27)
 await text('次のミッション',88,456,920,24,20,'#716044');await text(card.mission||'未設定',88,494,946,77,27)
 await text('自己紹介',88,626,920,24,20,'#716044');await text(card.bio||'—',88,664,946,77,26)
 await text('HUNTER PHOTO',1110,180,400,24,18,'#716044')
 if(card.photo_id)layers.push({input:await sharp(await getAsset(card.photo_id)).rotate().resize(400,516,{fit:'cover',position:'centre'}).png().toBuffer(),left:1112,top:220})
 await text('狩猟記録',88,782,920,27,24,'#352d20',true)
 const split=Math.ceil(animals.length/2)
 for(let col=0;col<2;col++){
  const x=88+col*736
  await text('動物',x,840,240,24,20,'#716044');await text('頭数',x+255,840,120,24,20,'#716044');await text('最小',x+400,840,120,24,20,'#716044');await text('最大',x+550,840,120,24,20,'#716044')
 }
 const lines=[]
 for(const [i,animal]of animals.entries()){
  const col=i>=split?1:0,x=88+col*736,y=888+(i-col*split)*rowHeight,a=stats.find(v=>v.animal===animal)
  await text(animal,x,y,240,48,29);await text(Number(a?.quantity||0).toLocaleString('ja-JP'),x+255,y,125,48,29)
  await text(a?.size_min==null?'—':String(Number(a.size_min)),x+400,y,140,48,27);await text(a?.size_max==null?'—':String(Number(a.size_max)),x+550,y,140,48,27)
  lines.push(`<path d="M${x} ${y+70}h688" stroke="#b99b6a" stroke-width="1"/>`)
 }
 layers.push({input:await sharp(Buffer.from(`<svg width="1600" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`)).png().toBuffer(),left:0,top:0})
 await text(`No. ${String(card.hunter_no).padStart(4,'0')}`,1280,height-45,250,25,20,'#dfc799')
 return opaquePNG(bg,layers)
}
