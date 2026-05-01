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
  const [previewKey, setPreviewKey] = useState(Date.now())
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
    setPreviewKey(Date.now())
  }

  const getFixedBingoUrl = (targetUserId) => {
    return `${SUPABASE_PUBLIC_BINGO_BASE}/${targetUserId}.png`
  }

  const getPreviewUrl = (targetRecord) => {
    if (!targetRecord) return ''
    const fixedUrl = getFixedBingoUrl(targetRecord.user_id)
    return `${fixedUrl}?preview=${previewKey}`
  }

  const syncBingoCardImage = async (targetUserId) => {
    const syncRes = await fetch(`/api/sync-bingo-card/${targetUserId}`, {
      method: 'POST',
      cache: 'no-store',
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

  const hasArchivedBingoCardByUserId = async (targetUserId) => {
    const { data, error } = await supabase
      .from('cards')
      .select('card_id, status, card_types!inner(code), card_programs!inner(code)')
      .eq('user_id', Number(targetUserId))
      .eq('status', 'archived')
      .eq('card_types.code', 'bingo')
      .eq('card_programs.code', 'bingo_regular')
      .limit(1)

    if (error) {
      return false
    }

    return Array.isArray(data) && data.length > 0
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

      const isArchived = await hasArchivedBingoCardByUserId(userId)

      if (isArchived) {
        setMessage('このビンゴカードは現在使用できません')
        return
      }

      setMessage(
        error instanceof Error
          ? error.message
          : 'ビンゴカードが見つかりません'
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

  const gridCells =
    cells.length > 0
      ? cells
      : Array.from({ length: 25 }, (_, i) => ({
          cell_index: i + 1,
          number: i + 1,
          is_marked: false,
        }))

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>🎯</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>ビンゴカード管理</p>
              <p style={styles.headerDescription}>
                ビンゴカードの発行、検索、番号開放、商品マッピングを管理します。
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin" style={styles.navButton}>管理メニュー</a>
            <a href="/admin/bingo/manage" style={styles.navButton}>ビンゴ管理</a>
            <button onClick={logout} style={styles.navButton}>ログアウト</button>
          </nav>
        </header>

        {(message || createMessage || openMessage || nameMessage || mappingMessage || previewMessage) && (
          <div style={styles.messageArea}>
            {createMessage && <div style={styles.message}>{createMessage}</div>}
            {message && <div style={styles.message}>{message}</div>}
            {nameMessage && <div style={styles.message}>{nameMessage}</div>}
            {openMessage && <div style={styles.message}>{openMessage}</div>}
            {mappingMessage && <div style={styles.message}>{mappingMessage}</div>}
            {previewMessage && <div style={styles.message}>{previewMessage}</div>}
          </div>
        )}

        <div style={styles.layout}>
          <aside style={styles.sidebar}>
            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>01</span>
                <h2 style={styles.sectionTitle}>ビンゴカード新規発行</h2>
              </div>

              <p style={styles.description}>
                新しいビンゴカードを発行します。
              </p>

              <button onClick={createCard} style={styles.primaryButton}>
                ビンゴカード新規発行
              </button>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>02</span>
                <h2 style={styles.sectionTitle}>ビンゴカード検索</h2>
              </div>

              <div style={styles.formStack}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="番号を入力"
                  value={userId}
                  onChange={(e) => setUserId(normalizeToHalfWidthNumber(e.target.value))}
                  style={styles.input}
                />

                <button onClick={searchCard} style={styles.primaryButton}>
                  検索
                </button>
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>03</span>
                <h2 style={styles.sectionTitle}>氏名登録・修正</h2>
              </div>

              <div style={styles.formStack}>
                <input
                  type="text"
                  placeholder="氏名を入力"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={styles.input}
                />

                <button onClick={saveName} style={styles.primaryButton}>
                  氏名を保存
                </button>
              </div>

              <p style={styles.smallNote}>
                空欄で保存すると、氏名未登録に戻せます。
              </p>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>04</span>
                <h2 style={styles.sectionTitle}>番号を開く</h2>
              </div>

              <p style={styles.description}>
                商品に対応する番号を入力して、該当マスを開きます。
              </p>

              <div style={styles.formStack}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="開ける番号を入力"
                  value={openNumber}
                  onChange={(e) => setOpenNumber(normalizeToHalfWidthNumber(e.target.value))}
                  style={styles.input}
                />

                <button onClick={openBingoNumber} style={styles.primaryButton}>
                  番号を開く
                </button>
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>05</span>
                <h2 style={styles.sectionTitle}>商品番号マッピング</h2>
              </div>

              <p style={styles.description}>
                商品名と対応番号を登録します。登録済み商品から直接マスを開くこともできます。
              </p>

              <div style={styles.formStack}>
                <input
                  type="text"
                  placeholder="商品名を入力"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  style={styles.input}
                />

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="対応番号を入力"
                  value={productNumber}
                  onChange={(e) => setProductNumber(normalizeToHalfWidthNumber(e.target.value))}
                  style={styles.input}
                />

                <div style={styles.mappingButtonRow}>
                  <button onClick={openImagePathDialog} style={styles.secondaryButton}>
                    {productImagePath ? '画像URLを編集' : '画像URLを入力'}
                  </button>

                  {productImagePath && (
                    <button onClick={clearImagePath} style={styles.dangerSmallButton}>
                      画像を解除
                    </button>
                  )}
                </div>

                <div style={styles.imagePreviewBox}>
                  {currentImagePreviewUrl ? (
                    <div style={styles.imagePreviewRow}>
                      <img
                        src={currentImagePreviewUrl}
                        alt="商品画像プレビュー"
                        style={styles.productPreviewImage}
                      />
                      <div>
                        <div style={styles.imagePreviewTitle}>画像設定済み</div>
                        <p style={styles.smallNote}>
                          必要なら「画像URLを編集」から変更できます。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p style={styles.smallNote}>画像はまだ設定されていません。</p>
                  )}
                </div>

                <button onClick={saveMapping} style={styles.primaryButton}>
                  登録・更新
                </button>
              </div>
            </section>
          </aside>

          <main style={styles.main}>
            <section style={styles.summaryGrid}>
              <SummaryCard
                label="カード番号"
                value={cardRecord ? cardRecord.user_id : '-'}
                sub="検索または新規発行後に表示"
              />

              <SummaryCard
                label="氏名"
                value={cardRecord ? cardRecord.display_name || '未登録' : '-'}
                sub="カードに表示される名前"
              />

              <SummaryCard
                label="ビンゴ数"
                value={cardRecord ? cardRecord.current_bingo_count : '-'}
                sub={cardRecord ? `${cardRecord.grid_size} × ${cardRecord.grid_size}` : 'カードサイズ'}
              />
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHead}>
                <div>
                  <h2 style={styles.mainTitle}>カード情報</h2>
                  <p style={styles.mainDescription}>
                    ビンゴカード番号、氏名、ビンゴ数、固定URLを確認します。
                  </p>
                </div>
              </div>

              {cardRecord ? (
                <>
                  <div style={styles.infoGrid}>
                    <InfoItem label="番号" value={cardRecord.user_id} />
                    <InfoItem label="カードID" value={cardRecord.card_id} />
                    <InfoItem label="氏名" value={cardRecord.display_name || '未登録'} />
                    <InfoItem label="ビンゴ数" value={cardRecord.current_bingo_count} />
                    <InfoItem label="サイズ" value={`${cardRecord.grid_size} × ${cardRecord.grid_size}`} />
                    <InfoItem label="状態" value={cardRecord.card_status || 'active'} />
                  </div>

                  <div style={styles.urlBox}>
                    <div style={styles.inputLabel}>固定カードURL</div>

                    <div style={styles.urlRow}>
                      <a
                        href={getFixedBingoUrl(cardRecord.user_id)}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.link}
                      >
                        {getFixedBingoUrl(cardRecord.user_id)}
                      </a>

                      <button
                        onClick={copyFixedUrl}
                        style={copiedFixed ? styles.copyButtonActive : styles.copyButton}
                      >
                        {copiedFixed ? 'コピー済み' : 'コピー'}
                      </button>
                    </div>

                    <p style={styles.smallNote}>
                      GTA内印刷機能や実運用で使う固定URLです。
                    </p>
                  </div>
                </>
              ) : (
                <div style={styles.emptyBox}>
                  ビンゴカードを検索すると、ここに情報が表示されます。
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHead}>
                <div>
                  <h2 style={styles.mainTitle}>ビンゴカード画像プレビュー</h2>
                  <p style={styles.mainDescription}>
                    名前や開放済みマスを反映した画像です。
                  </p>
                </div>
              </div>

              {cardRecord ? (
                <>
                  <div style={styles.previewFrame}>
                    <img
                      src={getPreviewUrl(cardRecord)}
                      alt={`ビンゴカード ${cardRecord.user_id}`}
                      onError={() => {
                        setPreviewMessage('画像がまだ生成されていないか、同期に失敗しています。検索し直すか、もう一度操作を試してください。')
                      }}
                      onLoad={() => {
                        setPreviewMessage('')
                      }}
                      style={styles.previewImage}
                    />
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <button onClick={refreshPreview} style={styles.secondaryButton}>
                      プレビュー再読み込み
                    </button>
                  </div>
                </>
              ) : (
                <div style={styles.emptyBox}>
                  ビンゴカードを検索すると、ここに画像プレビューが表示されます。
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHead}>
                <div>
                  <h2 style={styles.mainTitle}>ビンゴカード</h2>
                  <p style={styles.mainDescription}>
                    開いたマスには緑色の枠を表示します。
                  </p>
                </div>
              </div>

              <div style={styles.bingoGrid}>
                {gridCells.map((cell) => (
                  <div
                    key={cell.cell_index}
                    style={{
                      ...styles.bingoCell,
                      ...(cell.is_marked ? styles.bingoCellMarked : {}),
                    }}
                  >
                    <div style={styles.bingoNumber}>{cell.number}</div>

                    {cell.is_marked && (
                      <div style={styles.markedRing} />
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHead}>
                <div>
                  <h2 style={styles.mainTitle}>登録済み商品番号</h2>
                  <p style={styles.mainDescription}>
                    商品を選択すると入力欄と開放番号に反映できます。
                  </p>
                </div>
              </div>

              {mappings.length > 0 ? (
                <div style={styles.mappingList}>
                  {mappings.map((mapping) => (
                    <div key={mapping.mapping_id} style={styles.mappingCard}>
                      <button
                        onClick={() => applyMappingToInput(mapping)}
                        style={styles.mappingInfoButton}
                      >
                        {mapping.image_path ? (
                          <img
                            src={mapping.image_path}
                            alt={mapping.product_name}
                            style={styles.mappingImage}
                          />
                        ) : (
                          <div style={styles.mappingNoImage}>画像なし</div>
                        )}

                        <div>
                          <div style={styles.mappingTitle}>
                            {mapping.product_name} → {mapping.bingo_number}番
                          </div>
                          <div style={styles.mappingSub}>
                            クリックすると入力欄と開放番号に反映されます
                          </div>
                        </div>
                      </button>

                      <div style={styles.mappingActions}>
                        <button onClick={() => openFromMapping(mapping)} style={styles.mappingActionButton}>
                          この商品で開く
                        </button>

                        <button onClick={() => deleteMapping(mapping)} style={styles.dangerSmallButton}>
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyBox}>
                  まだ商品番号マッピングは登録されていません。
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summarySub}>{sub}</div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  )
}

const theme = {
  bg: '#eef2ec',
  bg2: '#f7faf5',
  panel: '#fbfdf9',
  panel2: '#f3f7ef',
  border: '#d8e3d2',
  border2: '#c4d3bd',
  text: '#263427',
  muted: '#6c7b67',
  deep: '#2f4a34',
  green: '#52785a',
  pale: '#e6efe1',
  white: '#ffffff',
  danger: '#8f5b50',
}

const styles = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bg2} 100%)`,
    color: theme.text,
    padding: '24px',
  },
  container: {
    maxWidth: '1720px',
    margin: '0 auto',
  },
  header: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '24px',
    padding: '24px 28px',
    marginBottom: '18px',
    boxShadow: '0 12px 30px rgba(47, 74, 52, 0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  brandMark: {
    width: '58px',
    height: '58px',
    borderRadius: '18px',
    background: theme.pale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    border: `1px solid ${theme.border2}`,
  },
  title: {
    fontSize: '38px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: '20px',
    color: theme.deep,
    fontWeight: 900,
  },
  headerDescription: {
    margin: '6px 0 0',
    fontSize: '14px',
    color: theme.muted,
    lineHeight: 1.6,
  },
  nav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  navButton: {
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 800,
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  messageArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '18px',
  },
  message: {
    fontSize: '15px',
    fontWeight: 800,
    color: theme.deep,
    background: theme.white,
    padding: '13px 15px',
    borderRadius: '14px',
    border: `1px solid ${theme.border}`,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '390px minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'start',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'sticky',
    top: '16px',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minWidth: 0,
  },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
  },
  sectionNumber: {
    fontSize: '13px',
    fontWeight: 900,
    color: theme.white,
    background: theme.green,
    borderRadius: '999px',
    padding: '5px 9px',
    lineHeight: 1,
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 900,
    color: theme.deep,
    margin: 0,
  },
  description: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '0 0 14px',
  },
  smallNote: {
    fontSize: '13px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '8px 0 0',
  },
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    fontSize: '16px',
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  inputLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '6px',
  },
  primaryButton: {
    width: '100%',
    justifyContent: 'center',
    padding: '13px 16px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
  secondaryButton: {
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  dangerSmallButton: {
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.danger,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  mappingButtonRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  imagePreviewBox: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  imagePreviewRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  productPreviewImage: {
    width: '82px',
    height: '82px',
    objectFit: 'contain',
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    display: 'block',
  },
  imagePreviewTitle: {
    fontSize: '15px',
    fontWeight: 900,
    color: theme.deep,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '14px',
  },
  summaryCard: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 10px 24px rgba(47, 74, 52, 0.06)',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: 900,
    color: theme.muted,
    marginBottom: '8px',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  summarySub: {
    fontSize: '12px',
    color: theme.muted,
    marginTop: '8px',
    lineHeight: 1.5,
  },
  mainSectionHead: {
    marginBottom: '16px',
  },
  mainTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  mainDescription: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '6px 0 0',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  infoItem: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  infoLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '8px',
  },
  infoValue: {
    fontSize: '18px',
    color: theme.deep,
    fontWeight: 900,
    wordBreak: 'break-word',
  },
  emptyBox: {
    background: theme.white,
    border: `1px dashed ${theme.border2}`,
    borderRadius: '16px',
    padding: '42px 24px',
    textAlign: 'center',
    color: theme.muted,
    fontSize: '17px',
    lineHeight: 1.8,
  },
  urlBox: {
    marginTop: '16px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  urlRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  link: {
    color: theme.green,
    fontWeight: 900,
    textDecoration: 'none',
    wordBreak: 'break-all',
  },
  copyButton: {
    padding: '10px 13px',
    fontSize: '14px',
    fontWeight: 900,
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
  },
  copyButtonActive: {
    padding: '10px 13px',
    fontSize: '14px',
    fontWeight: 900,
    borderRadius: '10px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
  },
  previewFrame: {
    background: theme.white,
    padding: '16px',
    borderRadius: '18px',
    border: `1px solid ${theme.border}`,
  },
  previewImage: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: '16px',
    border: `1px solid ${theme.border2}`,
    display: 'block',
    background: theme.white,
  },
  bingoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '12px',
  },
  bingoCell: {
    aspectRatio: '1 / 1',
    borderRadius: '18px',
    border: `2px solid ${theme.border2}`,
    background: theme.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bingoCellMarked: {
    background: theme.pale,
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.12)',
  },
  bingoNumber: {
    fontSize: '30px',
    fontWeight: 950,
    color: theme.deep,
    lineHeight: 1,
  },
  markedRing: {
    position: 'absolute',
    inset: '9px',
    borderRadius: '14px',
    border: `4px solid ${theme.green}`,
    pointerEvents: 'none',
  },
  mappingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  mappingCard: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
  },
  mappingInfoButton: {
    flex: 1,
    textAlign: 'left',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: theme.text,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },
  mappingImage: {
    width: '58px',
    height: '58px',
    objectFit: 'contain',
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    display: 'block',
    flexShrink: 0,
  },
  mappingNoImage: {
    width: '58px',
    height: '58px',
    borderRadius: '10px',
    border: `1px dashed ${theme.border2}`,
    background: theme.panel2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.muted,
    fontSize: '11px',
    fontWeight: 900,
    flexShrink: 0,
  },
  mappingTitle: {
    fontSize: '16px',
    fontWeight: 900,
    color: theme.deep,
    lineHeight: 1.5,
  },
  mappingSub: {
    marginTop: '4px',
    fontSize: '12px',
    color: theme.muted,
    lineHeight: 1.5,
  },
  mappingActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  mappingActionButton: {
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 900,
    borderRadius: '10px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}