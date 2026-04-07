import { supabase } from '@/lib/supabase'

export default async function Page({ params }) {
  const { user_id } = await params

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle()

  if (userError || !user) {
    return (
      <div>
        <h1>ユーザー取得エラー</h1>
        <p>URLの user_id: {user_id}</p>
        <pre>{JSON.stringify({ user, userError }, null, 2)}</pre>
      </div>
    )
  }

  const { data: image, error: imageError } = await supabase
    .from('stamp_images')
    .select('*')
    .eq('stamp_count', user.stamp_count)
    .maybeSingle()

  if (imageError || !image) {
    return (
      <div>
        <h1>画像取得エラー</h1>
        <p>URLの user_id: {user_id}</p>
        <p>stamp_count: {user.stamp_count}</p>
        <pre>{JSON.stringify({ image, imageError }, null, 2)}</pre>
      </div>
    )
  }

  const imageUrl = `https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/${image.image_path}`

  return (
    <div>
      <h1>カード確認</h1>
      <p>user_id: {user.user_id}</p>
      <p>stamp_count: {user.stamp_count}</p>
      <p>image_path: {image.image_path}</p>
      <img src={imageUrl} alt="stamp card" style={{ maxWidth: '600px' }} />
    </div>
  )
}