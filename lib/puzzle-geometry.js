export function puzzleLayout(count=14,random=Math.random){
 count=Math.max(1,Math.min(50,Math.round(count)))
 const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols)
 const seeds=Array.from({length:count},(_,i)=>[(i%cols+.2+.6*random())*100/cols,(Math.floor(i/cols)+.2+.6*random())*100/rows])
 const vertices=[],lookup=new Map()
 const slots=seeds.map((seed,i)=>{
  let poly=[[0,0],[100,0],[100,100],[0,100]]
  seeds.forEach((q,j)=>{if(i===j)return;const a=q[0]-seed[0],b=q[1]-seed[1],c=(q[0]**2+q[1]**2-seed[0]**2-seed[1]**2)/2,out=[]
   for(let k=0;k<poly.length;k++){const p=poly[k],r=poly[(k+1)%poly.length],dp=a*p[0]+b*p[1]-c,dr=a*r[0]+b*r[1]-c;if(dp<=1e-8)out.push(p);if((dp<0&&dr>0)||(dp>0&&dr<0)){const t=dp/(dp-dr);out.push([p[0]+t*(r[0]-p[0]),p[1]+t*(r[1]-p[1])])}}poly=out
  })
  const points=poly.map(p=>{p=p.map(v=>Math.round(Math.max(0,Math.min(100,v))*1e6)/1e6);const key=p.join(',');if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(p)}return lookup.get(key)})
  return {id:crypto.randomUUID(),label:`お題${i+1}`,x:50,y:50,size:8.6,angle:0,asset_id:'',points}
 })
 return {puzzle:true,puzzle_mode:'auto',vertices,background:'',stamp:'',stamp_mode:'common',number:{x:76,y:14,size:2,visible:false},name:{x:76,y:20,size:2,visible:false},slots}
}
export function validPuzzleMesh(layout){
 const vs=layout.vertices,slots=layout.slots
 if(!Array.isArray(vs)||vs.length>300||!Array.isArray(slots)||!slots.length||slots.length>50)return false
 if(vs.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>100)))return false
 let area=0
 const edges=new Map()
 for(const s of slots){const ids=s.points;if(!Array.isArray(ids)||ids.length<3||ids.length>60||new Set(ids).size!==ids.length||ids.some(i=>!Number.isInteger(i)||!vs[i]))return false
  let a=0;for(let i=0;i<ids.length;i++){const p=vs[ids[i]],q=vs[ids[(i+1)%ids.length]],r=vs[ids[(i+2)%ids.length]];a+=p[0]*q[1]-q[0]*p[1];if((q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]) < -1e-5)return false;const key=[ids[i],ids[(i+1)%ids.length]].sort((x,y)=>x-y).join(':');edges.set(key,(edges.get(key)||0)+1)}if(a<.01)return false;area+=a/2
 }
 if(Math.abs(area-10000)>.02)return false
 for(const [edge,n]of edges){if(n===2)continue;if(n!==1)return false;const [p,q]=edge.split(':').map(i=>vs[Number(i)]);if(!((p[0]===q[0]&&(p[0]===0||p[0]===100))||(p[1]===q[1]&&(p[1]===0||p[1]===100))))return false}
 return true
}
export function movePuzzleVertex(layout,index,point){const old=layout.vertices[index],p=point.map(v=>Math.max(0,Math.min(100,v)));for(let k=0;k<2;k++)if(old[k]===0||old[k]===100)p[k]=old[k];const next={...layout,vertices:layout.vertices.map((v,i)=>i===index?p:v)};return validPuzzleMesh(next)?next:layout}
