// Employee profiles are scoped to the authenticated hunter store. No private profile fields are returned.
const fields='user_id,staff_code,employee_name'
const label=e=>String(e.employee_name||'').trim()||'氏名未登録'
export async function hunterEmployees(db,store){
 const employees=[]
 for(let page=0;;page++){
  const {data,error}=await db.from('employee_profiles').select(fields).eq('store_id',store).eq('employment_status','active').order('user_id',{ascending:true}).range(page*500,page*500+499)
  if(error)throw Error('従業員一覧を取得できませんでした。自動更新後にもう一度お試しください。')
  employees.push(...data.map(e=>({id:String(e.user_id),name:label(e),staff_code:e.staff_code||''})))
  if(data.length<500)break
 }
 return employees.sort((a,b)=>a.staff_code.localeCompare(b.staff_code,'ja',{numeric:true})||a.id.localeCompare(b.id,'en',{numeric:true})).map(({id,name})=>({id,name}))
}
export async function hunterEmployeeActor(db,store,id){
 if(typeof id!=='string'||!/^\d+$/.test(id))throw Error('受付担当者を従業員一覧から選択してください。')
 const {data,error}=await db.from('employee_profiles').select(fields).eq('store_id',store).eq('user_id',id).eq('employment_status','active').maybeSingle()
 if(error)throw Error('受付担当者の在籍状況を確認できませんでした。自動更新後にもう一度お試しください。')
 if(!data)throw Error('選択した担当者は在籍していません。一覧の自動更新後にもう一度お試しください。')
 const name=label(data)
 if(name.length>40)throw Error('従業員名は40文字以内にしてください。')
 return name
}
