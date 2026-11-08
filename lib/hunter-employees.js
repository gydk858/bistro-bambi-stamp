// Employee profiles are scoped to the authenticated hunter store. No private profile fields are returned.
const fields='user_id,staff_code,employee_name'
const label=e=>String(e.employee_name||'').trim()||String(e.staff_code||'').trim()||`従業員 #${e.user_id}`
export async function hunterEmployees(db,store){
 const employees=[]
 for(let page=0;;page++){
  const {data,error}=await db.from('employee_profiles').select(fields).eq('store_id',store).eq('employment_status','active').order('user_id',{ascending:true}).range(page*500,page*500+499)
  if(error)throw Error('従業員一覧を取得できませんでした。再取得してください。')
  employees.push(...data.map(e=>({id:String(e.user_id),name:label(e),staff_code:e.staff_code||''})))
  if(data.length<500)break
 }
 return employees.sort((a,b)=>a.name.localeCompare(b.name,'ja')||a.id.localeCompare(b.id))
}
export async function hunterEmployeeActor(db,store,id){
 if(typeof id!=='string'||!/^\d+$/.test(id))throw Error('受付担当者を従業員一覧から選択してください。')
 const {data,error}=await db.from('employee_profiles').select(fields).eq('store_id',store).eq('user_id',id).eq('employment_status','active').maybeSingle()
 if(error)throw Error('受付担当者の在籍状況を確認できませんでした。再取得してください。')
 if(!data)throw Error('選択した担当者は在籍していません。従業員一覧を再取得してください。')
 const name=label(data)
 if(name.length>40)throw Error('従業員名は40文字以内にしてください。')
 return name
}
