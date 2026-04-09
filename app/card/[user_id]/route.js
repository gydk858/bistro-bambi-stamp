import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request, { params }) {
  const rawUserId = await params.user_id
  const userId = String(rawUserId).replace('.png', '')

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', Number(userId))
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
          width: '910px',
          height: '550px',
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
            width: '910px',
            height: '550px',
            objectFit: 'cover',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '22px',
            left: '24px',
            right: '24px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '26px',
              fontWeight: 800,
              color: '#5a3318',
              backgroundColor: 'rgba(255,248,220,0.92)',
              border: '3px solid #d98b3a',
              borderRadius: '999px',
              padding: '8px 16px',
              boxShadow: '0 3px 0 rgba(140, 80, 20, 0.25)',
            }}
          >
            番号：{user.user_id}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '30px',
              fontWeight: 800,
              color: '#5a3318',
              backgroundColor: 'rgba(255,248,220,0.92)',
              border: '3px solid #d98b3a',
              borderRadius: '999px',
              padding: '8px 18px',
              boxShadow: '0 3px 0 rgba(140, 80, 20, 0.25)',
              maxWidth: '590px',
            }}
          >
            氏名：{displayName}
          </div>
        </div>
      </div>
    ),
    {
      width: 910,
      height: 550,
    }
  )
}