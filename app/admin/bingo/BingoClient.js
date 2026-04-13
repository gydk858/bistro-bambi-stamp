'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const SUPABASE_PUBLIC_BINGO_BASE =
  'https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live-bingo'

export default function BingoClient() {
  const [userId, setUserId] = useState('')
  const [cardRecord, setCardRecord] = useState(null)
  const [cells, setCells] = useState([])
  const [message, setMessage] = useState('')
  const [createMessage, setCreateMessage] = useState('')
  const [openNumber, setOpenNumber] = useState('')
  const [openMessage, setOpenMessage] = useState('')
  const [previewKey, setPreviewKey] = useState(0)
  const [copiedFixed, setCopiedFixed] = useState(false)
  const [previewMessage, setPreviewMessage] = useState('')

  const [editName, setEditName] = useState('')
  const [nameMessage, setNameMessage] = useState('')

  const [productName, setProductName] = useState('')
  const [productNumber, setProductNumber] = useState('')
  const [productImagePath, setProductImagePath] = useState('')
  const [mappingMessage, setMappingMessage] = useState('')
  const [mappings, setMappings] = useState([])

  const normalizeToHalfWidthNumber = (value) => {
    return value
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[^0-9]/g, '')
  }

  const refreshPreview = () => {
    setPreviewKey((prev) => prev + 1)
  }

  const getFixedBingoUrl = (targetUserId) => {
    return `${SUPABASE_PUBLIC_BINGO_BASE}/${targetUserId}.png`
  }

  const getPreviewUrl = (targetRecord) => {
    if (!targetRecord) return ''
    const fixedUrl = getFixedBingoUrl(targetRecord.user_id)
    const version = targetRecord.updated_at
      ? new Date(targetRecord.updated_at).getTime()
      : Date.now()

    return `${fixedUrl}?v=${version}`
  }

  const syncBingoCardImage = async (targetUserId) => {
    const syncRes = await fetch(`/api/sync-bingo-card/${targetUserId}`, {
      method: 'POST',
    })

    const syncJson = await syncRes.json()

    if (!syncRes.ok || !syncJson.ok) {
      throw new Error(syncJson.error || 'ビンゴカード画像の同期に失敗しました')
    }

    return syncJson
  }

  const loadMappings = async () => {
    const { data: program, error: programError } = await supabase
      .from('card_programs')
      .select('program_id')
      .eq('code', 'bingo_regular')
      .maybeSingle()

    if (programError || !program) {
      throw new Error('ビンゴ program の取得に失敗しました')
    }

    const { data, error } = await supabase
      .from('bingo_product_mappings')
      .select('*')
      .eq('program_id', program.program_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('bingo_number', { ascending: true })
      .order('product_name', { ascending: true })

    if (error || !data) {
      throw new Error('商品番号マッピングの取得に失敗しました')
    }

    setMappings(data)
  }

  const loadBingoCard = async (targetUserId) => {
    const { data: card, error: cardError } = await supabase
      .from('v_bingo_cards_current')
      .select('*')
      .eq('user_id', Number(targetUserId))
      .eq('program_code', 'bingo_regular')
      .eq('card_status', 'active')
      .maybeSingle()

    if (cardError || !card) {
      throw new Error('ビンゴカードが見つかりません')
    }

    const { data: cellRows, error: cellError } = await supabase
      .from('bingo_card_cells')
      .select('*')
      .eq('card_id', card.card_id)
      .order('cell_index', { ascending: true })

    if (cellError || !cellRows) {
      throw new Error('ビンゴマスの取得に失敗しました')
    }

    setCardRecord(card)
    setCells(cellRows)
    setEditName(card.display_name || '')
    return { card, cellRows }
  }

  const searchCard = async () => {
    setMessage('')
    setCreateMessage('')
    setOpenMessage('')
    setCopiedFixed(false)
    setPreviewMessage('')
    setNameMessage('')

    if (!userId) {
      setCardRecord(null)
      setCells([])
      setEditName('')
      setMessage('番号を入力してください')
      return
    }

    try {
      await loadBingoCard(userId)
      await syncBingoCardImage(Number(userId))
      setMessage('ビンゴカードを表示しました')
      refreshPreview()
    } catch (error) {
      setCardRecord(null)
      setCells([])
      setEditName('')
      setMessage(
        error instanceof Error
          ? error.message
          : 'ビンゴカードの取得に失敗しました'
      )
    }
  }

  const createCard = async () => {
    setMessage('')
    setCreateMessage('')
    setOpenMessage('')
    setCopiedFixed(false)
    setPreviewMessage('')
    setNameMessage('')

    const now = new Date().toISOString()

    const { data: createdUser, error: createUserError } = await supabase
      .from('users')
      .insert({
        display_name: '未登録',
        status: 'active',
        updated_at: now,
      })
      .select('user_id, display_name, updated_at')
      .maybeSingle()

    if (createUserError || !createdUser) {
      setCreateMessage('ビンゴカード発行に失敗しました')
      return
    }

    const { data: createdCardRows, error: createCardError } = await supabase.rpc(
      'create_bingo_card_for_user',
      {
        p_user_id: createdUser.user_id,
        p_program_code: 'bingo_regular',
        p_grid_size: 5,
        p_has_free_center: false,
        p_note: '管理画面からビンゴ新規発行',
      }
    )

    if (createCardError || !createdCardRows || createdCardRows.length === 0) {
      setCreateMessage('ビンゴカード本体の作成に失敗しました')
      return
    }

    try {
      await syncBingoCardImage(createdUser.user_id)
      await loadBingoCard(createdUser.user_id)
      setUserId(String(createdUser.user_id))
      setCreateMessage(`ビンゴカード番号 ${createdUser.user_id} を発行しました`)
      setMessage('新規ビンゴカードを発行しました')
      refreshPreview()
    } catch (error) {
      setCreateMessage(
        error instanceof Error
          ? error.message
          : '発行後の初期化に失敗しました'
      )
    }
  }

  const saveName = async () => {
    setNameMessage('')
    setPreviewMessage('')
    setCopiedFixed(false)

    if (!cardRecord) {
      setNameMessage('先にビンゴカードを検索してください')
      return
    }

    const trimmedName = editName.trim()

    const { data, error } = await supabase
      .from('users')
      .update({
        display_name: trimmedName === '' ? '未登録' : trimmedName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', cardRecord.user_id)
      .select('user_id, display_name, updated_at')
      .maybeSingle()

    if (error || !data) {
      setNameMessage('氏名の保存に失敗しました')
      return
    }

    try {
      await syncBingoCardImage(data.user_id)
      await loadBingoCard(data.user_id)
      setNameMessage('氏名を保存しました')
      refreshPreview()
    } catch (syncError) {
      setNameMessage(
        syncError instanceof Error
          ? syncError.message
          : '画像の同期に失敗しました'
      )
    }
  }

  const executeOpenBingoNumber = async (targetNumber, selectedProductName = null) => {
    setOpenMessage('')
    setCopiedFixed(false)
    setPreviewMessage('')

    if (!cardRecord) {
      setOpenMessage('先にビンゴカードを検索してください')
      return
    }

    if (!Number.isFinite(targetNumber) || targetNumber <= 0) {
      setOpenMessage('開ける番号を入力してください')
      return
    }

    const { data, error } = await supabase.rpc('mark_bingo_number', {
      p_card_id: cardRecord.card_id,
      p_number: targetNumber,
      p_product_name: selectedProductName,
      p_acted_by: 'admin_ui',
      p_note: '管理画面から番号開放',
    })

    if (error || !data || data.length === 0) {
      setOpenMessage('番号の開放に失敗しました')
      return
    }

    const result = data[0]

    try {
      await syncBingoCardImage(cardRecord.user_id)
      await loadBingoCard(cardRecord.user_id)

      if (result.already_marked) {
        setOpenMessage(`${targetNumber}番はすでに開いています`)
      } else if (selectedProductName) {
        setOpenMessage(`「${selectedProductName}」として ${targetNumber}番を開きました`)
      } else {
        setOpenMessage(`${targetNumber}番を開きました`)
      }

      refreshPreview()
    } catch (reloadError) {
      setOpenMessage(
        reloadError instanceof Error
          ? reloadError.message
          : '更新後の再読み込みに失敗しました'
      )
    }
  }

  const openBingoNumber = async () => {
    const targetNumber = Number(openNumber)

    const selectedMapping = mappings.find(
      (mapping) => Number(mapping.bingo_number) === targetNumber
    )

    await executeOpenBingoNumber(
      targetNumber,
      selectedMapping?.product_name ?? null
    )
  }

  const saveMapping = async () => {
    setMappingMessage('')

    const trimmedName = productName.trim()
    const targetNumber = Number(productNumber)
    const trimmedImagePath = productImagePath.trim()

    if (trimmedName === '') {
      setMappingMessage('商品名を入力してください')
      return
    }

    if (!Number.isFinite(targetNumber) || targetNumber <= 0) {
      setMappingMessage('番号を入力してください')
      return
    }

    const { data: program, error: programError } = await supabase
      .from('card_programs')
      .select('program_id')
      .eq('code', 'bingo_regular')
      .maybeSingle()

    if (programError || !program) {
      setMappingMessage('ビンゴ program の取得に失敗しました')
      return
    }

    const { error } = await supabase
      .from('bingo_product_mappings')
      .upsert(
        {
          program_id: program.program_id,
          product_name: trimmedName,
          bingo_number: targetNumber,
          image_path: trimmedImagePath === '' ? null : trimmedImagePath,
          image_fit: 'contain',
          is_active: true,
          display_order: targetNumber,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'program_id,product_name',
        }
      )

    if (error) {
      setMappingMessage('商品番号マッピングの保存に失敗しました')
      return
    }

    try {
      await loadMappings()
      setMappingMessage(`「${trimmedName}」を ${targetNumber}番に登録しました`)
      setProductName('')
      setProductNumber('')
      setProductImagePath('')
    } catch (reloadError) {
      setMappingMessage(
        reloadError instanceof Error
          ? reloadError.message
          : '保存後の再読み込みに失敗しました'
      )
    }
  }

  const deleteMapping = async (mapping) => {
    setMappingMessage('')

    const confirmed = window.confirm(`「${mapping.product_name}」のマッピングを削除しますか？`)
    if (!confirmed) return

    const { error } = await supabase
      .from('bingo_product_mappings')
      .delete()
      .eq('mapping_id', mapping.mapping_id)

    if (error) {
      setMappingMessage('商品番号マッピングの削除に失敗しました')
      return
    }

    try {
      await loadMappings()
      setMappingMessage(`「${mapping.product_name}」を削除しました`)
    } catch (reloadError) {
      setMappingMessage(
        reloadError instanceof Error
          ? reloadError.message
          : '削除後の再読み込みに失敗しました'
      )
    }
  }

  const applyMappingToInput = (mapping) => {
    const nextName = mapping.product_name || ''
    const nextNumber = String(mapping.bingo_number ?? '')
    const nextImagePath = mapping.image_path || ''

    setProductName(nextName)
    setProductNumber(nextNumber)
    setProductImagePath(nextImagePath)
    setOpenNumber(nextNumber)
    setMappingMessage(`「${nextName}」を選択しました。${nextNumber}番を開けます。`)
  }

  const openFromMapping = async (mapping) => {
    const nextName = mapping.product_name || ''
    const nextNumber = Number(mapping.bingo_number)

    setProductName(nextName)
    setProductNumber(String(mapping.bingo_number ?? ''))
    setProductImagePath(mapping.image_path || '')
    setOpenNumber(String(mapping.bingo_number ?? ''))

    await executeOpenBingoNumber(nextNumber, nextName)
  }

  const openImagePathDialog = () => {
    const currentValue = productImagePath || ''
    const nextValue = window.prompt(
      '画像URLまたは画像パスを入力してください\n例: https://... または bingo-products/coffee.png',
      currentValue
    )

    if (nextValue === null) return
    setProductImagePath(nextValue.trim())
  }

  const clearImagePath = () => {
    setProductImagePath('')
  }

  const copyFixedUrl = async () => {
    if (!cardRecord) return

    const fullUrl = getFixedBingoUrl(cardRecord.user_id)

    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedFixed(true)
      setTimeout(() => setCopiedFixed(false), 2000)
    } catch {
      setCopiedFixed(false)
      setMessage('固定URLのコピーに失敗しました')
    }
  }

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  useEffect(() => {
    loadMappings().catch(() => {
      setMappings([])
    })
  }, [])

  const currentImagePreviewUrl = useMemo(() => {
    const value = productImagePath.trim()
    return value === '' ? '' : value
  }, [productImagePath])

  const cardBoxStyle = {
    background: '#fffaf8',
    border: '1px solid #f0d9d2',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
  }

  const sectionTitleStyle = {
    fontSize: '28px',
    fontWeight: 800,
    color: '#7a4b3a',
    marginBottom: '14px',
  }

  const inputStyle = {
    padding: '16px 18px',
    fontSize: '20px',
    borderRadius: '14px',
    border: '1px solid #dcbeb2',
    background: '#fff',
    color: '#6b4235',
    minWidth: '280px',
    outline: 'none',
  }

  const primaryButtonStyle = {
    padding: '16px 24px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '14px',
    border: 'none',
    background: '#d98b7b',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(217, 139, 123, 0.25)',
  }

  const subButtonStyle = {
    padding: '16px 24px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '14px',
    border: '1px solid #e6c6bb',
    background: '#fff',
    color: '#7a4b3a',
    cursor: 'pointer',
  }

  const copyButtonBaseStyle = {
    padding: '12px 18px',
    fontSize: '18px',
    fontWeight: 700,
    borderRadius: '12px',
    border: '1px solid #e6c6bb',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  }

  const mappingActionButtonStyle = {
    padding: '10px 14px',
    fontSize: '15px',
    fontWeight: 800,
    borderRadius: '12px',
    border: 'none',
    background: '#d98b7b',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    alignSelf: 'flex-start',
  }

  const dangerSmallButtonStyle = {
    padding: '10px 14px',
    fontSize: '15px',
    fontWeight: 800,
    borderRadius: '12px',
    border: '1px solid #e7b8aa',
    background: '#fff',
    color: '#8a4e3d',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    alignSelf: 'flex-start',
  }

  const infoRowStyle = {
    fontSize: '22px',
    lineHeight: 1.8,
    color: '#5f4137',
    margin: 0,
  }

  const gridCells =
    cells.length > 0
      ? cells
      : Array.from({ length: 25 }, (_, i) => ({
          cell_index: i + 1,
          number: i + 1,
          is_marked: false,
        }))

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fff8f4 0%, #fffdfb 100%)',
        padding: '32px',
        color: '#5f4137',
      }}
    >
      <div
        style={{
          maxWidth: '1500px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: '#fff6f1',
            border: '1px solid #f2ddd5',
            borderRadius: '28px',
            padding: '28px 32px',
            marginBottom: '28px',
            boxShadow: '0 12px 30px rgba(201, 157, 145, 0.10)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '42px',
                fontWeight: 900,
                color: '#7a4b3a',
                margin: 0,
              }}
            >
              -Bistro-Bambi
            </h1>
            <p
              style={{
                margin: '10px 0 0 0',
                fontSize: '22px',
                color: '#9a6b5b',
              }}
            >
              ビンゴカード管理画面
            </p>
          </div>

          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="/admin"
              style={{
                padding: '16px 24px',
                fontSize: '20px',
                fontWeight: 700,
                borderRadius: '14px',
                border: '1px solid #e6c6bb',
                background: '#fff',
                color: '#7a4b3a',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              管理メニュー
            </a>

            <a
              href="/admin/settings"
              style={{
                padding: '16px 24px',
                fontSize: '20px',
                fontWeight: 700,
                borderRadius: '14px',
                border: '1px solid #e6c6bb',
                background: '#fff',
                color: '#7a4b3a',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              管理者画面
            </a>

            <button onClick={logout} style={subButtonStyle}>
              ログアウト
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 1.35fr',
            gap: '28px',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>① ビンゴカード新規発行</div>
              <p style={{ fontSize: '20px', color: '#8a6457', marginTop: 0, marginBottom: '18px', lineHeight: 1.7 }}>
                新しいビンゴカードを発行します。
              </p>

              <button onClick={createCard} style={primaryButtonStyle}>
                ビンゴカード新規発行
              </button>

              {createMessage && (
                <p style={{ marginTop: '18px', fontSize: '20px', fontWeight: 700, color: '#7a4b3a', background: '#fff', padding: '14px 16px', borderRadius: '14px', border: '1px solid #f0d9d2' }}>
                  {createMessage}
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>② ビンゴカード検索</div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="番号を入力"
                  value={userId}
                  onChange={(e) => setUserId(normalizeToHalfWidthNumber(e.target.value))}
                  style={inputStyle}
                />
                <button onClick={searchCard} style={primaryButtonStyle}>
                  検索
                </button>
              </div>

              {message && (
                <p style={{ marginTop: '18px', fontSize: '20px', fontWeight: 700, color: '#7a4b3a', background: '#fff', padding: '14px 16px', borderRadius: '14px', border: '1px solid #f0d9d2' }}>
                  {message}
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>③ 氏名登録・修正</div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="氏名を入力"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ ...inputStyle, minWidth: '320px' }}
                />
                <button onClick={saveName} style={primaryButtonStyle}>
                  氏名を保存
                </button>
              </div>

              <p style={{ fontSize: '18px', color: '#9a6b5b', marginTop: '14px', marginBottom: 0, lineHeight: 1.7 }}>
                空欄で保存すると、氏名未登録に戻せます。
              </p>

              {nameMessage && (
                <p style={{ marginTop: '18px', fontSize: '20px', fontWeight: 700, color: '#7a4b3a', background: '#fff', padding: '14px 16px', borderRadius: '14px', border: '1px solid #f0d9d2' }}>
                  {nameMessage}
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>④ 番号を開く</div>
              <p style={{ fontSize: '20px', color: '#8a6457', marginTop: 0, marginBottom: '18px', lineHeight: 1.7 }}>
                商品に対応する番号を入力して、該当マスを開きます。
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="開ける番号を入力"
                  value={openNumber}
                  onChange={(e) => setOpenNumber(normalizeToHalfWidthNumber(e.target.value))}
                  style={inputStyle}
                />
                <button onClick={openBingoNumber} style={primaryButtonStyle}>
                  番号を開く
                </button>
              </div>

              {openMessage && (
                <p style={{ marginTop: '18px', fontSize: '20px', fontWeight: 700, color: '#7a4b3a', background: '#fff', padding: '14px 16px', borderRadius: '14px', border: '1px solid #f0d9d2' }}>
                  {openMessage}
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>⑤ 商品番号マッピング</div>
              <p style={{ fontSize: '20px', color: '#8a6457', marginTop: 0, marginBottom: '18px', lineHeight: 1.7 }}>
                商品名と対応番号を登録します。画像はダイアログから登録し、画面上ではプレビュー表示にします。
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="商品名を入力"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  style={inputStyle}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="対応番号を入力"
                    value={productNumber}
                    onChange={(e) => setProductNumber(normalizeToHalfWidthNumber(e.target.value))}
                    style={inputStyle}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <button onClick={openImagePathDialog} style={subButtonStyle}>
                    {productImagePath ? '画像URLを編集' : '画像URLを入力'}
                  </button>

                  {productImagePath && (
                    <button onClick={clearImagePath} style={dangerSmallButtonStyle}>
                      画像を解除
                    </button>
                  )}
                </div>

                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #ecd3cb',
                    borderRadius: '16px',
                    padding: '14px',
                  }}
                >
                  {currentImagePreviewUrl ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: '14px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <img
                        src={currentImagePreviewUrl}
                        alt="商品画像プレビュー"
                        style={{
                          width: '96px',
                          height: '96px',
                          objectFit: 'contain',
                          borderRadius: '12px',
                          border: '1px solid #ead0c7',
                          background: '#fff',
                          display: 'block',
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#7a4b3a',
                          }}
                        >
                          画像設定済み
                        </p>
                        <p
                          style={{
                            margin: '6px 0 0 0',
                            fontSize: '14px',
                            color: '#9a6b5b',
                            wordBreak: 'break-all',
                          }}
                        >
                          画面上ではURL全文は常時表示しません。必要なら「画像URLを編集」から変更できます。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        color: '#9a6b5b',
                        lineHeight: 1.7,
                      }}
                    >
                      画像はまだ設定されていません。
                    </p>
                  )}
                </div>

                <div>
                  <button onClick={saveMapping} style={primaryButtonStyle}>
                    登録・更新
                  </button>
                </div>
              </div>

              {mappingMessage && (
                <p style={{ marginTop: '18px', fontSize: '20px', fontWeight: 700, color: '#7a4b3a', background: '#fff', padding: '14px 16px', borderRadius: '14px', border: '1px solid #f0d9d2' }}>
                  {mappingMessage}
                </p>
              )}

              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#7a4b3a', marginTop: 0, marginBottom: '12px' }}>
                  登録済み一覧
                </p>

                {mappings.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {mappings.map((mapping) => (
                      <div
                        key={mapping.mapping_id}
                        style={{
                          padding: '16px 18px',
                          borderRadius: '14px',
                          border: '1px solid #ecd3cb',
                          background: '#fff',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '16px',
                          }}
                        >
                          <button
                            onClick={() => applyMappingToInput(mapping)}
                            style={{
                              flex: 1,
                              textAlign: 'left',
                              padding: 0,
                              border: 'none',
                              background: 'transparent',
                              color: '#6b4235',
                              cursor: 'pointer',
                              fontSize: '18px',
                              fontWeight: 700,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                flexWrap: 'wrap',
                              }}
                            >
                              {mapping.image_path ? (
                                <img
                                  src={mapping.image_path}
                                  alt={mapping.product_name}
                                  style={{
                                    width: '64px',
                                    height: '64px',
                                    objectFit: 'contain',
                                    borderRadius: '10px',
                                    border: '1px solid #ead0c7',
                                    background: '#fff',
                                    display: 'block',
                                    flexShrink: 0,
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '10px',
                                    border: '1px dashed #e0beb3',
                                    background: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#b07b6c',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  画像なし
                                </div>
                              )}

                              <div style={{ minWidth: 0 }}>
                                <div>{mapping.product_name} → {mapping.bingo_number}番</div>
                                <div style={{ marginTop: '6px', fontSize: '14px', fontWeight: 600, color: '#b07b6c' }}>
                                  クリックすると入力欄と開放番号に反映されます
                                </div>
                              </div>
                            </div>
                          </button>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexShrink: 0 }}>
                            <button onClick={() => openFromMapping(mapping)} style={mappingActionButtonStyle}>
                              この商品で開く
                            </button>

                            <button onClick={() => deleteMapping(mapping)} style={dangerSmallButtonStyle}>
                              削除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '18px', color: '#9a6b5b', margin: 0, lineHeight: 1.8 }}>
                    まだ商品番号マッピングは登録されていません。
                  </p>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>カード情報</div>

              {cardRecord ? (
                <>
                  <p style={infoRowStyle}><strong>番号：</strong> {cardRecord.user_id}</p>
                  <p style={infoRowStyle}><strong>カードID：</strong> {cardRecord.card_id}</p>
                  <p style={infoRowStyle}><strong>氏名：</strong> {cardRecord.display_name || '未登録'}</p>
                  <p style={infoRowStyle}><strong>ビンゴ数：</strong> {cardRecord.current_bingo_count}</p>
                  <p style={infoRowStyle}><strong>サイズ：</strong> {cardRecord.grid_size} × {cardRecord.grid_size}</p>

                  <div style={{ marginTop: '18px' }}>
                    <p style={{ ...infoRowStyle, marginBottom: '8px' }}>
                      <strong>カードURL：</strong>
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <a
                        href={getFixedBingoUrl(cardRecord.user_id)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: '#c26f5a',
                          fontWeight: 700,
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                        }}
                      >
                        {getFixedBingoUrl(cardRecord.user_id)}
                      </a>

                      <button
                        onClick={copyFixedUrl}
                        style={{
                          ...copyButtonBaseStyle,
                          background: copiedFixed ? '#d98b7b' : '#fff',
                          color: copiedFixed ? '#fff' : '#7a4b3a',
                        }}
                      >
                        {copiedFixed ? 'コピー済み' : 'コピー'}
                      </button>
                    </div>

                    <p style={{ fontSize: '16px', color: '#9a6b5b', marginTop: '8px', marginBottom: 0 }}>
                      コピー機や実運用で使う固定URLです。
                    </p>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: '22px', color: '#9a6b5b', margin: 0, lineHeight: 1.8 }}>
                  ビンゴカードを検索すると、ここに情報が表示されます。
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>ビンゴカード画像プレビュー</div>

              <p style={{ fontSize: '20px', color: '#8a6457', marginTop: 0, marginBottom: '18px', lineHeight: 1.7 }}>
                名前や開放済みマスを反映した画像です。
              </p>

              {previewMessage && (
                <p style={{ marginTop: 0, marginBottom: '18px', fontSize: '18px', fontWeight: 700, color: '#7a4b3a', background: '#fff', padding: '14px 16px', borderRadius: '14px', border: '1px solid #f0d9d2' }}>
                  {previewMessage}
                </p>
              )}

              {cardRecord ? (
                <>
                  <div
                    style={{
                      marginTop: '8px',
                      background: '#fff',
                      padding: '18px',
                      borderRadius: '18px',
                      border: '1px solid #efd8d0',
                    }}
                  >
                    <img
                      src={`${getPreviewUrl(cardRecord)}&preview=${previewKey}`}
                      alt={`ビンゴカード ${cardRecord.user_id}`}
                      onError={() => {
                        setPreviewMessage('画像がまだ生成されていないか、同期に失敗しています。検索し直すか、もう一度開放操作を試してください。')
                      }}
                      onLoad={() => {
                        setPreviewMessage('')
                      }}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        borderRadius: '16px',
                        border: '1px solid #ead0c7',
                        display: 'block',
                        background: '#fff',
                      }}
                    />
                  </div>

                  <div style={{ marginTop: '18px' }}>
                    <button onClick={refreshPreview} style={subButtonStyle}>
                      プレビュー再読み込み
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    background: '#fff',
                    border: '1px dashed #e0beb3',
                    borderRadius: '18px',
                    padding: '42px 24px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: '24px', color: '#9a6b5b', margin: 0, lineHeight: 1.8 }}>
                    ビンゴカードを検索すると、ここに画像プレビューが表示されます。
                  </p>
                </div>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>ビンゴカード</div>

              <p style={{ fontSize: '20px', color: '#8a6457', marginTop: 0, marginBottom: '18px', lineHeight: 1.7 }}>
                開いたマスにはシンプルなマークを表示します。将来的に商品画像表示へ拡張できます。
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: '14px',
                }}
              >
                {gridCells.map((cell) => (
                  <div
                    key={cell.cell_index}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: '20px',
                      border: '2px solid #efc9bf',
                      background: cell.is_marked ? '#fde8e1' : '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: cell.is_marked
                        ? '0 8px 18px rgba(217, 139, 123, 0.12)'
                        : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '34px',
                        fontWeight: 800,
                        color: '#7a4b3a',
                        lineHeight: 1,
                      }}
                    >
                      {cell.number}
                    </div>

                    {cell.is_marked && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: '10px',
                          borderRadius: '16px',
                          border: '4px solid #d98b7b',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}