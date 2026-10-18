import {inflateRawSync} from 'node:zlib'
export function puzzleZip(buffer){
 if(buffer.length>4*1024*1024)throw Error('ZIPは4MB以下にしてください。')
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break}
 if(end<0)throw Error('ZIP形式を確認してください。')
 const count=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16),total=0;const files=[]
 if(count>120||buffer.readUInt16LE(end+4)!==0||buffer.readUInt16LE(end+6)!==0)throw Error('ZIPのファイル数・形式を確認してください。')
 for(let i=0;i<count;i++){
  if(offset+46>buffer.length||buffer.readUInt32LE(offset)!==0x02014b50)throw Error('ZIPの一覧が不正です。')
  const flags=buffer.readUInt16LE(offset+8),method=buffer.readUInt16LE(offset+10),compressed=buffer.readUInt32LE(offset+20),size=buffer.readUInt32LE(offset+24),len=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32),local=buffer.readUInt32LE(offset+42)
  const name=buffer.subarray(offset+46,offset+46+len).toString('utf8');offset+=46+len+extra+comment
  if(name.endsWith('/')||name.startsWith('__MACOSX/')||name.split('/').pop().startsWith('.'))continue
  if(!name.toLowerCase().endsWith('.png'))throw Error('ZIPにはPNG画像だけを入れてください。')
  if(flags&1||![0,8].includes(method)||size>2*1024*1024||files.length>=50||(total+=size)>25*1024*1024)throw Error('各PNGは2MB以下、1〜50枚にしてください。暗号化ZIPには対応しません。')
  if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw Error('ZIPの画像が不正です。')
  const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28)
  if(start+compressed>buffer.length)throw Error('ZIPの画像が欠けています。')
  const raw=buffer.subarray(start,start+compressed),data=method===8?inflateRawSync(raw,{maxOutputLength:2*1024*1024}):raw
  if(data.length!==size)throw Error('ZIPの画像サイズが一致しません。')
  files.push({name,data})
 }
 if(!files.length)throw Error('PNG画像がありません。')
 return files.sort((a,b)=>a.name.localeCompare(b.name,'ja',{numeric:true}))
}
