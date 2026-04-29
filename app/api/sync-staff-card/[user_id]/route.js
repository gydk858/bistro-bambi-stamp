import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const STAFF_PROGRAM_CODE = 'stamp_staff_attendance'
const STAFF_TEMPLATE_FOLDER = 'staff-cards'
const STAFF_CARD_BUCKET = 'stamp-images'

function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables are not set')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...(init.headers || {}),
    },
  })
}

function clampAttendanceCount(count) {
  const num = Number(count ?? 0)
  if (Number.isNaN(num)) return 0
  return Math.max(0, Math.min(15, num))
}

async function syncStaffCard(userId) {
  if (!userId || Number.isNaN(Number(userId))) {
    return json(
      {
        ok: false,
        message: 'user_id が不正です',
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createSupabaseAdmin()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    const { data: card, error: cardError } = await supabase
      .from('v_staff_stamp_cards_current')
      .select(
        'card_id, user_id, staff_code, display_name, current_count, max_count, program_code, card_status'
      )
      .eq('user_id', Number(userId))
      .eq('program_code', STAFF_PROGRAM_CODE)
      .eq('card_status', 'active')
      .maybeSingle()

    if (cardError) {
      console.error('[sync-staff-card] fetch card error:', cardError)
      return json(
        {
          ok: false,
          message: '従業員カード情報の取得に失敗しました',
          error: cardError.message,
        },
        { status: 500 }
      )
    }

    if (!card) {
      return json(
        {
          ok: false,
          message: `Staff card not found: ${userId}`,
        },
        { status: 404 }
      )
    }

    const currentCount = clampAttendanceCount(card.current_count)
    const displayStaffCode = String(card.staff_code ?? '').trim() || `STAFF-${card.user_id}`

    const baseImageUrl =
      `${supabaseUrl}/storage/v1/object/public/${STAFF_CARD_BUCKET}/${STAFF_TEMPLATE_FOLDER}/${currentCount}.png?v=${Date.now()}`

    const baseImageResponse = await fetch(baseImageUrl, {
      cache: 'no-store',
    })

    if (!baseImageResponse.ok) {
      console.error('[sync-staff-card] failed to fetch base image:', baseImageUrl)
      return json(
        {
          ok: false,
          message: '従業員カード画像テンプレートの取得に失敗しました',
          baseImageUrl,
        },
        { status: 500 }
      )
    }

    const baseImageArrayBuffer = await baseImageResponse.arrayBuffer()
    const baseImageBase64 = Buffer.from(baseImageArrayBuffer).toString('base64')
    const baseImageDataUrl = `data:image/png;base64,${baseImageBase64}`

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: '1050px',
            height: '600px',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
          }}
        >
          <img
            src={baseImageDataUrl}
            width="1050"
            height="600"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '1050px',
              height: '600px',
            }}
          />

          {/* 右上のネーム枠に従業員番号のみ表示 */}
          <div
            style={{
              position: 'absolute',
              top: '70px',
              left: '768px',
              width: '170px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#862e10',
              fontSize: '28px',
              fontWeight: 700,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayStaffCode}
          </div>
        </div>
      ),
      {
        width: 1050,
        height: 600,
      }
    )

    const generatedPngBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const uploadPath = `live-staff/${card.user_id}.png`

    const { error: uploadError } = await supabase.storage
      .from(STAFF_CARD_BUCKET)
      .upload(uploadPath, generatedPngBuffer, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '0',
      })

    if (uploadError) {
      console.error('[sync-staff-card] upload error:', uploadError)
      return json(
        {
          ok: false,
          message: '従業員カード画像のアップロードに失敗しました',
          error: uploadError.message,
        },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = supabase.storage
      .from(STAFF_CARD_BUCKET)
      .getPublicUrl(uploadPath)

    return json({
      ok: true,
      message: '従業員カード画像を同期しました',
      user_id: card.user_id,
      card_id: card.card_id,
      staff_code: card.staff_code,
      current_count: card.current_count,
      max_count: card.max_count,
      image_url: publicUrlData.publicUrl,
      synced_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[sync-staff-card] unexpected error:', error)
    return json(
      {
        ok: false,
        message: '従業員カード同期中に予期しないエラーが発生しました',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(_request, context) {
  const params = await context.params
  const userId = params?.user_id
  return syncStaffCard(userId)
}

export async function GET(_request, context) {
  const params = await context.params
  const userId = params?.user_id
  return syncStaffCard(userId)
}