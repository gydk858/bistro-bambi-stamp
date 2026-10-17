import sharp from 'sharp'
import path from 'node:path'
const escape = value => String(value).replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&apos;' })[c])
export async function legacyEventImage(event, card) {
const cols = Math.min(10, event.max_stamps), rows = Math.ceil(event.max_stamps / cols)
    const height = 420 + rows * 92
    const circles = Array.from({ length: event.max_stamps }, (_, i) => {
      const cx = 80 + (i % cols) * 100, cy = 305 + Math.floor(i / cols) * 92
      return `<circle cx="${cx}" cy="${cy}" r="33" fill="${i < card.stamps ? '#52785a' : '#ffffff'}" stroke="#c4d3bd" stroke-width="2"/><text x="${cx}" y="${cy + 8}" text-anchor="middle" font-family="sans-serif" font-size="22" fill="${i < card.stamps ? '#ffffff' : '#a0ae98'}">${i + 1}</text>`
    }).join('')
    const bg = Buffer.from(`<svg width="1080" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="${height}" rx="28" fill="#f7faf5"/><rect x="18" y="18" width="1044" height="${height - 36}" rx="20" fill="none" stroke="#c4d3bd" stroke-width="3"/><text x="48" y="70" font-family="sans-serif" font-size="23" letter-spacing="4" fill="#52785a">BISTRO BAMBI / EVENT STAMP CARD</text>${circles}<text x="48" y="${height - 55}" font-family="sans-serif" font-size="24" fill="#52785a">No. ${card.card_no}   |   ${card.stamps} / ${event.max_stamps}</text></svg>`)
    const fontfile = path.join(process.cwd(), 'public/fonts/rounded-x-mplus-1p-medium.ttf')
    async function textImage(text, size, width, height) {
      return sharp({ text: { text: `<span foreground="#2f4a34">${escape(text)}</span>`, font: `Rounded Mplus 1p Medium ${size}`, fontfile, width, height, rgba: true } }).png().toBuffer()
    }
    const layers = [
      { input: await textImage(event.name, 38, 980, 90), left: 48, top: 95 },
      ...(card.display_name ? [{ input: await textImage(`${card.display_name} 様`, 28, 970, 45), left: 48, top: 192 }] : []),
      { input: await textImage(`${event.starts_on || '開始日未定'} 〜 ${event.ends_on || '終了日未定'}`, 19, 650, 32), left: 370, top: height - 76 },
    ]

 return sharp(bg).composite(layers).png().toBuffer()
}
export async function renderEventImage(event,card,getAsset) {
 const layout=event.layout
 if(!layout?.background)return legacyEventImage(event,card)
 const background=await getAsset(layout.background)
 const {width:w,height:h}=await sharp(background).metadata(),layers=[]
 const marked=new Set(card.marked_slots||[])
 const slots=layout.slots||[]
 for(let i=0;i<slots.length;i++) {
  const s=slots[i],pressed=event.event_type==='specific'?marked.has(s.id):i<card.stamps
  if(!pressed)continue
  const assetId=layout.stamp_mode==='individual'?s.asset_id:layout.stamp
  const size=Math.max(1,Math.round(w*s.size/100))
  const {data,info}=await sharp(await getAsset(assetId)).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).rotate(s.angle,{background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer({resolveWithObject:true})
  const left=Math.round(w*s.x/100-info.width/2),top=Math.round(h*s.y/100-info.height/2)
  const x=Math.max(0,left),y=Math.max(0,top),cw=Math.min(w,left+info.width)-x,ch=Math.min(h,top+info.height)-y
  if(cw>0&&ch>0)layers.push({input:await sharp(data).extract({left:x-left,top:y-top,width:cw,height:ch}).toBuffer(),left:x,top:y})
 }
 async function addText(value,position) {
  if(!value)return
  const pos=position||{x:76,y:16,size:2},left=Math.round(w*pos.x/100),top=Math.round(h*pos.y/100)
  const maxWidth=Math.max(1,w-left-4),maxHeight=Math.max(1,h-top-4)
  const input=await sharp({text:{text:`<span foreground="#263427">${escape(value)}</span>`,font:`Rounded Mplus 1p Medium ${Math.max(1,Math.round(w*pos.size/100))}`,fontfile:path.join(process.cwd(),'public/fonts/rounded-x-mplus-1p-medium.ttf'),dpi:72,width:maxWidth,rgba:true}}).png().toBuffer()
  const resized=await sharp(input).resize({width:maxWidth,height:maxHeight,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true})
  const angle=Number(pos.angle)||0
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}"><image x="${left}" y="${top}" width="${resized.info.width}" height="${resized.info.height}" transform="rotate(${angle} ${left} ${top})" xlink:href="data:image/png;base64,${resized.data.toString('base64')}"/></svg>`)
  layers.push({input:await sharp(svg).png().toBuffer(),left:0,top:0})
 }
 await addText(`No. ${card.card_no}`,layout.number||{x:76,y:14,size:2})
 await addText(card.display_name,layout.name||{x:76,y:19,size:2})
 return sharp(background).composite(layers).png().toBuffer()
}
