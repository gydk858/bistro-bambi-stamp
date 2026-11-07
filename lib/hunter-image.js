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
function geometry(count){return {height:Math.max(1460,800+count*66),rowHeight:66}}
function crown(x,y){return `<g transform="translate(${x} ${y})" fill="url(#gold)" stroke="#79521c" stroke-width="2"><path d="M2 9L12 17L21 2L30 17L40 9L35 30H7Z"/><rect x="7" y="31" width="28" height="6" rx="2"/><circle cx="21" cy="3" r="3"/><circle cx="2" cy="9" r="2"/><circle cx="40" cy="9" r="2"/></g>`}
// Small original feline guild crest, independent of all live text.
function companion(){return `<g transform="translate(210 48)" stroke="#d9be83" stroke-width="3" fill="#263d31"><path d="M0 35L2 0L22 15Q35 10 48 15L68 0L70 35Q70 66 35 68Q0 66 0 35Z"/><path d="M14 34L26 39M44 39L56 34M31 47L35 51L39 47M35 51V57M12 49L-7 44M12 55L-5 58M58 49L77 44M58 55L75 58" fill="none"/><path d="M18 65L35 77L52 65" fill="#a8783a"/></g>`}
export function hunterTemplate(count=10){
 const {height}=geometry(count)
 return Buffer.from(guildFrame(height,'HUNTER CARD / GUILD RECORD',companion()+
 panel(64,160,1000,150)+panel(64,330,1000,110)+panel(64,460,1000,110)+panel(1088,160,448,410)+panel(64,640,1472,height-720)+
 `<g fill="none" stroke="#9e9b78" stroke-width="4"><path d="M1120 530L1220 400L1290 475L1390 370L1510 530Z"/><path d="M1250 300L1220 250L1225 225M1220 250L1195 245M1370 300L1400 250L1395 225M1400 250L1425 245M1250 300L1260 340L1310 365L1360 340L1370 300Z"/></g><text x="1310" y="395" text-anchor="middle" fill="#859071" font-family="serif" font-size="17" letter-spacing="3">HUNTER PORTRAIT</text>`))
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
 await text(card.tag||'ハンター',88,178,720,25,22,'#716044')
 await text(card.display_name||'匿名',88,214,720,43,38,'#352d20',true)
 await text(`累計討伐数  ${Number(card.kills).toLocaleString('ja-JP')} 頭`,88,269,720,29,25)
 await text('HR',920,184,110,25,20,'#716044');await text(card.rank||'—',920,220,110,45,36,'#352d20',true)
 await text('次のミッション',88,346,920,22,19,'#716044');await text(card.mission||'未設定',88,378,946,50,25)
 await text('自己紹介',88,476,920,22,19,'#716044');await text(card.bio||'—',88,508,946,50,24)
 await text('HUNTER PHOTO',1110,178,400,24,18,'#716044')
 if(card.photo_id)layers.push({input:await sharp(await getAsset(card.photo_id)).rotate().resize(400,326,{fit:'cover',position:'centre'}).png().toBuffer(),left:1112,top:220})
 await text('狩猟記録',88,598,700,28,25,'#352d20',true)
 await text('金冠：全参加者の最大サイズ記録（同率含む）',850,603,660,24,19,'#716044')
 for(const [label,x,w]of [['動物',88,270],['討伐数',410,520],['最小サイズ',1000,220],['最大サイズ',1260,240]])await text(label,x,654,w,26,20,'#716044')
 const marks=[],maxCount=Math.max(1,...stats.map(a=>Number(a.quantity)||0))
 for(const [i,animal]of animals.entries()){
  const y=700+i*rowHeight,a=stats.find(v=>v.animal===animal),quantity=Number(a?.quantity||0),champion=crowns.find(v=>v.animal===animal)
  const awarded=a?.size_max!=null&&champion?.size_max!=null&&Number(a.size_max)>0&&Number(a.size_max)===Number(champion.size_max)
  marks.push(`<rect x="78" y="${y-9}" width="1444" height="${rowHeight}" fill="${i%2?'#ceb580':'#f5e8c9'}" opacity=".25"/><path d="M78 ${y+rowHeight-9}H1522" stroke="#b99b6a"/><rect x="410" y="${y+10}" width="350" height="20" rx="3" fill="#ccb98c"/>${quantity?`<rect x="410" y="${y+10}" width="${Math.max(2,350*quantity/maxCount)}" height="20" rx="3" fill="#334c38" stroke="#9f7c3f"/>`:''}${awarded?crown(1466,y-1):''}`)
 }
 marks.push('<path d="M380 645V'+(height-85)+'M960 645V'+(height-85)+'M1230 645V'+(height-85)+'" stroke="#b99b6a"/>')
 layers.push({input:await sharp(Buffer.from(`<svg width="1600" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#fff3ab"/><stop offset=".45" stop-color="#eac04b"/><stop offset="1" stop-color="#a16c1a"/></linearGradient></defs>${marks.join('')}</svg>`)).png().toBuffer(),left:0,top:0})
 for(const [i,animal]of animals.entries()){
  const y=700+i*rowHeight,a=stats.find(v=>v.animal===animal)
  await text(animal,88,y,270,44,27)
  await text(`${Number(a?.quantity||0).toLocaleString('ja-JP')} 頭`,790,y,155,40,27)
  await text(a?.size_min==null?'—':String(Number(a.size_min)),1000,y,210,40,26)
  await text(a?.size_max==null?'—':String(Number(a.size_max)),1260,y,190,40,26)
 }
 await text(`No. ${String(card.hunter_no).padStart(4,'0')}`,1280,height-45,250,25,20,'#dfc799')
 return opaquePNG(bg,layers)
}
