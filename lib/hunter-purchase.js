// Prices from the supplied Bambi purchase sheet. Amounts are in yen.
export const MATERIALS=[
 {key:'fine_large',label:'上質大の皮',price:625000},
 {key:'fine_medium',label:'上質中の皮',price:2000000},
 {key:'fine_small',label:'上質小の皮',price:150000},
 {key:'large',label:'大の皮',price:500000},
 {key:'medium',label:'中の皮',price:150000},
 {key:'small',label:'小の皮',price:100000},
 {key:'poor_large',label:'悪大の皮',price:375000},
 {key:'poor_medium',label:'悪中の皮',price:100000},
 {key:'poor_small',label:'悪小の皮',price:50000},
 {key:'fine_bird',label:'上質鳥',price:300000},
 {key:'bird',label:'鳥',price:120000},
 {key:'poor_bird',label:'悪鳥',price:60000},
 {key:'meat',label:'肉',price:1000}
]
export const COIN_RATE=10
export const DEFAULT_PRICES=Object.fromEntries(MATERIALS.map(m=>[m.key,m.price]))
export function purchaseSummary(lines,prices=DEFAULT_PRICES,rate=COIN_RATE){
 const materials={},animals={};let amount=0
 for(const l of lines){const n=Number(l.quantity)||0;materials[l.material]=(materials[l.material]||0)+n;amount+=n*Number(prices[l.material]||0);if(l.material!=='meat')animals[l.animal]=(animals[l.animal]||0)+n}
 return {materials,animals,amount,coins:amount/rate,kills:Object.values(animals).reduce((a,b)=>a+b,0)}
}
