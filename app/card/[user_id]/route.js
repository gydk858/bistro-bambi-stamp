import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request, { params }) {
  const { user_id } = await params

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', Number(user_id))
    .maybeSingle()

  if (userError || !user) {
    return new Response('User not found', { status: 404 })
  }

  const { data: image, error: imageError } = await supabase
    .from('stamp_images')
    .select('*')
    .eq('stamp_count', user.stamp_count)
    .maybeSingle()

  if (imageError || !image) {
    return new Response('Image not found', { status: 404 })
  }

  const baseImageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/stamp-images/${image.image_path}`
  const displayName = user.name || '未登録'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <img
          src={baseImageUrl}
          alt="stamp card"
          style={{
            width: '1200px',
            height: '630px',
            objectFit: 'cover',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '12px',
            right: '32px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              fontWeight: 800,
              color: '#5a3318',
              border: '4px solid #d98b3a',
              borderRadius: '999px',
              padding: '10px 20px',
              boxShadow: '0 4px 0 rgba(140, 80, 20, 0.25)',
            }}
          >
            番号：{user.user_id}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '18px',
              fontWeight: 800,
              color: '#5a3318',
              border: '4px solid #d98b3a',
              borderRadius: '999px',
              padding: '10px 24px',
              boxShadow: '0 4px 0 rgba(140, 80, 20, 0.25)',
              maxWidth: '760px',
            }}
          >
            氏名：{displayName}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}