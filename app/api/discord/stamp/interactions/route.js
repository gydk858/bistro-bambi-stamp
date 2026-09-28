import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVE_CARD_BASE =
  "https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live";

const LIVE_STAFF_CARD_BASE =
  "https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live-staff";

const STAMP_PROGRAM_CODE = "stamp_regular";
const STAFF_PROGRAM_CODE = "stamp_staff_attendance";
const DEFAULT_MAX_COUNT = 12;
const DEFAULT_STAFF_MAX_COUNT = 15;

function getOptionValue(options, name) {
  if (!Array.isArray(options)) return undefined;
  return options.find((option) => option.name === name)?.value;
}

function getFixedCardUrl(userId) {
  return `${LIVE_CARD_BASE}/${userId}.png`;
}

function getFixedStaffCardUrl(userId) {
  return `${LIVE_STAFF_CARD_BASE}/${userId}.png`;
}

function getPreviewImageUrl(card) {
  const fixedUrl = getFixedCardUrl(card.user_id);
  return `${fixedUrl}?preview=${Date.now()}`;
}

function getStaffPreviewImageUrl(card) {
  const fixedUrl = getFixedStaffCardUrl(card.user_id);
  const count = card.current_count ?? 0;
  const attendance = card.monthly_attendance_count ?? count;
  return `${fixedUrl}?preview=${Date.now()}&count=${count}&attendance=${attendance}`;
}

function getStaffAttachmentFileName(card) {
  const userId = card?.user_id ?? "unknown";
  return `staff-card-${userId}-${Date.now()}.png`;
}

function getOperatorName(body) {
  const nick = body?.member?.nick;
  const globalName = body?.user?.global_name ?? body?.member?.user?.global_name;
  const username = body?.user?.username ?? body?.member?.user?.username;

  return nick || globalName || username || "担当者";
}

function getJstWorkDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour);

  let workDateUtc = Date.UTC(year, month - 1, day);

  if (hour < 4) {
    workDateUtc -= 24 * 60 * 60 * 1000;
  }

  const workDate = new Date(workDateUtc);
  const yyyy = workDate.getUTCFullYear();
  const mm = String(workDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(workDate.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getMonthRangeFromWorkDateString(workDateString) {
  const year = Number(String(workDateString).slice(0, 4));
  const month = Number(String(workDateString).slice(5, 7));

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDate = new Date(Date.UTC(year, month, 0));
  const lastDay = String(lastDate.getUTCDate()).padStart(2, "0");
  const lastDayString = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  return {
    year,
    month,
    firstDay,
    lastDay: lastDayString,
  };
}

function getCurrentWorkMonthRange() {
  return getMonthRangeFromWorkDateString(getJstWorkDateString());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMinutes(minutes) {
  const value = Number(minutes || 0);

  if (value <= 0) {
    return "0分";
  }

  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours <= 0) {
    return `${mins}分`;
  }

  if (mins <= 0) {
    return `${hours}時間`;
  }

  return `${hours}時間${mins}分`;
}

function buildMainEmbed(card, description = "") {
  return {
    embeds: [
      {
        title: "-Bistro-Bambi スタンプカード",
        color: 0xe9a8b5,
        description,
        fields: [
          {
            name: "ID",
            value: String(card.user_id),
            inline: true,
          },
          {
            name: "氏名",
            value: card.display_name ?? "未登録",
            inline: true,
          },
          {
            name: "現在スタンプ数",
            value: `${String(card.current_count ?? 0)} / ${String(
              card.max_count ?? DEFAULT_MAX_COUNT
            )}`,
            inline: true,
          },
        ],
        image: {
          url: getPreviewImageUrl(card),
        },
      },
    ],
  };
}

function buildStaffEmbed(card, description = "", imageUrl = null) {
  const attendanceCount =
    card.monthly_attendance_count ??
    card.attendance_count ??
    card.current_count ??
    0;

  const maxCount = card.max_count ?? DEFAULT_STAFF_MAX_COUNT;

  const fields = [
    {
      name: "従業員コード",
      value: String(card.staff_code ?? "未設定"),
      inline: true,
    },
    {
      name: "現在の出勤数",
      value: `${String(attendanceCount)} / ${String(maxCount)}`,
      inline: true,
    },
  ];

  if (card.today_status) {
    fields.push({
      name: "本日の状態",
      value: String(card.today_status),
      inline: true,
    });
  }

  if (Number(card.today_worked_minutes || 0) > 0) {
    fields.push({
      name: "本日の勤務時間",
      value: formatMinutes(card.today_worked_minutes),
      inline: true,
    });
  }

  if (Number(card.today_bonus_eligible_minutes || 0) > 0) {
    fields.push({
      name: "本日の加算対象時間",
      value: formatMinutes(card.today_bonus_eligible_minutes),
      inline: true,
    });
  }

  if (Number(card.monthly_bonus_eligible_minutes || 0) > 0) {
    fields.push({
      name: "今月の加算対象時間",
      value: formatMinutes(card.monthly_bonus_eligible_minutes),
      inline: true,
    });
  }

  return {
    embeds: [
      {
        title: "-Bistro-Bambi 従業員カード",
        color: 0xa5bb73,
        description,
        fields,
        image: {
          url: imageUrl ?? getStaffPreviewImageUrl(card),
        },
      },
    ],
  };
}

function buildPanelPayload(card, description = "操作パネルです。") {
  return {
    ...buildMainEmbed(card, description),
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "+1",
            custom_id: `stamp:add:${card.user_id}`,
          },
          {
            type: 2,
            style: 4,
            label: "-1",
            custom_id: `stamp:remove:${card.user_id}`,
          },
          {
            type: 2,
            style: 1,
            label: "名前変更",
            custom_id: `stamp:name:${card.user_id}`,
          },
          {
            type: 2,
            style: 2,
            label: "ID検索",
            custom_id: `stamp:search:${card.user_id}`,
          },
        ],
      },
    ],
  };
}

function buildStaffPanelPayload(
  card,
  description = "操作パネルです。",
  imageUrl = null
) {
  return {
    ...buildStaffEmbed(card, description, imageUrl),
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "出勤",
            custom_id: `staff:clockin:${card.user_id}`,
          },
          {
            type: 2,
            style: 4,
            label: "退勤",
            custom_id: `staff:clockout:${card.user_id}`,
          },
          {
            type: 2,
            style: 1,
            label: "修正",
            custom_id: `staff:fix:${card.user_id}`,
          },
          {
            type: 2,
            style: 2,
            label: "従業員検索",
            custom_id: `staff:search:${card.user_id}`,
          },
        ],
      },
    ],
  };
}

async function verifyDiscordRequest(req, rawBody) {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_STAMP_PUBLIC_KEY;

  if (!signature || !timestamp || !publicKey) {
    return false;
  }

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, "hex"),
    Buffer.from(publicKey, "hex")
  );
}

async function sendDeferredResponse(interactionId, interactionToken) {
  const res = await fetch(
    `https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: 5,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord defer failed: ${text}`);
  }
}

async function editOriginalResponse(applicationId, interactionToken, payload) {
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord edit failed: ${text}`);
  }
}

async function fetchStaffCardImage(card) {
  const imageUrl = `${getFixedStaffCardUrl(card.user_id)}?discord=${Date.now()}`;

  const res = await fetch(imageUrl, {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `従業員カード画像の取得に失敗しました: ${res.status} ${text}`
    );
  }

  const contentType = res.headers.get("content-type") || "image/png";
  const arrayBuffer = await res.arrayBuffer();

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("従業員カード画像の取得に失敗しました。画像が空です。");
  }

  return {
    arrayBuffer,
    contentType,
  };
}

async function editOriginalResponseWithStaffImage(
  applicationId,
  interactionToken,
  card,
  payloadBuilder
) {
  const fileName = getStaffAttachmentFileName(card);
  const imageUrl = `attachment://${fileName}`;
  const payload = payloadBuilder(imageUrl);

  const image = await fetchStaffCardImage(card);

  const formData = new FormData();

  formData.append(
    "payload_json",
    JSON.stringify({
      ...payload,
      attachments: [
        {
          id: 0,
          filename: fileName,
        },
      ],
    })
  );

  formData.append(
    "files[0]",
    new Blob([image.arrayBuffer], {
      type: image.contentType,
    }),
    fileName
  );

  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord image edit failed: ${text}`);
  }
}

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("システム設定が不足しています。管理者に確認してください。");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function getStaffMonthlyAttendanceCount(supabase, userId) {
  const range = getCurrentWorkMonthRange();

  const { data, error } = await supabase
    .from("staff_attendance_events")
    .select("amount")
    .eq("user_id", Number(userId))
    .gte("work_date", range.firstDay)
    .lte("work_date", range.lastDay);

  if (error) {
    throw new Error(`月内出勤数の取得に失敗しました: ${error.message}`);
  }

  const total = (data || []).reduce((sum, row) => {
    return sum + Number(row.amount || 0);
  }, 0);

  return Math.max(0, total);
}

async function getStaffMonthlyBonusEligibleMinutes(supabase, userId) {
  const range = getCurrentWorkMonthRange();

  const { data, error } = await supabase
    .from("staff_work_sessions")
    .select("bonus_eligible_minutes")
    .eq("user_id", Number(userId))
    .gte("work_date", range.firstDay)
    .lte("work_date", range.lastDay);

  if (error) {
    throw new Error(`月内加算対象時間の取得に失敗しました: ${error.message}`);
  }

  return (data || []).reduce((sum, row) => {
    return sum + Number(row.bonus_eligible_minutes || 0);
  }, 0);
}

async function getTodayWorkSession(supabase, userId) {
  const workDate = getJstWorkDateString();

  const { data, error } = await supabase
    .from("staff_work_sessions")
    .select("*")
    .eq("user_id", Number(userId))
    .eq("work_date", workDate)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data || null;
}

function getTodayStatusLabel(session) {
  if (!session) {
    return "未出勤";
  }

  if (session.status === "open") {
    return "出勤中";
  }

  if (session.status === "closed") {
    return "退勤済み";
  }

  if (session.status === "fixed") {
    return "修正済み";
  }

  if (session.status === "needs_fix") {
    return "要修正";
  }

  return String(session.status || "不明");
}

async function attachStaffExtraStatus(supabase, card) {
  if (!card) return card;

  const monthlyAttendanceCount = await getStaffMonthlyAttendanceCount(
    supabase,
    card.user_id
  );

  const monthlyBonusEligibleMinutes =
    await getStaffMonthlyBonusEligibleMinutes(supabase, card.user_id);

  const todaySession = await getTodayWorkSession(supabase, card.user_id);

  return {
    ...card,
    monthly_attendance_count: monthlyAttendanceCount,
    monthly_bonus_eligible_minutes: monthlyBonusEligibleMinutes,
    today_status: getTodayStatusLabel(todaySession),
    today_worked_minutes: todaySession?.worked_minutes ?? 0,
    today_bonus_eligible_minutes: todaySession?.bonus_eligible_minutes ?? 0,
  };
}

async function syncStaffCardVisualCountToMonthly({
  supabase,
  card,
  monthlyAttendanceCount,
  actedBy,
  reason,
}) {
  const maxCount = Number(card.max_count ?? DEFAULT_STAFF_MAX_COUNT);
  const beforeCount = Number(card.current_count ?? 0);
  const nextVisualCount = Math.min(
    Math.max(Number(monthlyAttendanceCount || 0), 0),
    maxCount
  );

  if (beforeCount === nextVisualCount) {
    return;
  }

  const now = new Date().toISOString();
  const diff = nextVisualCount - beforeCount;

  const { error: historyError } = await supabase
    .from("stamp_histories")
    .insert({
      card_id: Number(card.card_id),
      action_type: diff >= 0 ? "add" : "remove",
      amount: diff,
      before_count: beforeCount,
      after_count: nextVisualCount,
      acted_by: actedBy ?? "discord_staff_bot",
      reason: reason ?? "Discord bot から従業員カード表示数を同期",
      acted_at: now,
    });

  if (historyError) {
    throw new Error(`従業員カード履歴の保存に失敗しました: ${historyError.message}`);
  }

  const { error: updateError } = await supabase
    .from("stamp_cards")
    .update({
      current_count: nextVisualCount,
      completed_at: nextVisualCount >= maxCount ? now : null,
      last_stamped_at: now,
      updated_at: now,
    })
    .eq("card_id", Number(card.card_id));

  if (updateError) {
    throw new Error(`従業員カード表示数の更新に失敗しました: ${updateError.message}`);
  }
}

async function hasArchivedStampCardByUserId(supabase, userId) {
  const { data, error } = await supabase
    .from("cards")
    .select(`
      card_id,
      status,
      card_types!inner(code),
      card_programs!inner(code)
    `)
    .eq("user_id", Number(userId))
    .eq("status", "archived")
    .eq("card_types.code", "stamp")
    .eq("card_programs.code", STAMP_PROGRAM_CODE)
    .limit(1);

  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

async function getStampCardOrThrow(supabase, userId) {
  const { data: card, error } = await supabase
    .from("v_stamp_cards_current")
    .select("*")
    .eq("user_id", userId)
    .eq("program_code", STAMP_PROGRAM_CODE)
    .eq("card_status", "active")
    .maybeSingle();

  if (error) {
    throw new Error("カード情報の取得に失敗しました。時間をおいてもう一度お試しください。");
  }

  if (!card) {
    const isArchived = await hasArchivedStampCardByUserId(supabase, userId);

    if (isArchived) {
      throw new Error("このスタンプカードは現在使用できません。");
    }

    throw new Error("スタンプカードが見つかりません。番号を確認してください。");
  }

  return card;
}

async function getStaffCardByUserIdOrThrow(supabase, userId) {
  const { data: card, error } = await supabase
    .from("v_staff_stamp_cards_current")
    .select("*")
    .eq("user_id", Number(userId))
    .eq("program_code", STAFF_PROGRAM_CODE)
    .eq("card_status", "active")
    .maybeSingle();

  if (error) {
    throw new Error("従業員カード情報の取得に失敗しました。時間をおいてもう一度お試しください。");
  }

  if (!card) {
    throw new Error("従業員カードが見つかりません。従業員コードを確認してください。");
  }

  return card;
}

async function getStaffCardWithStatusByUserIdOrThrow(supabase, userId) {
  const card = await getStaffCardByUserIdOrThrow(supabase, userId);
  return await attachStaffExtraStatus(supabase, card);
}

async function getStaffCardByCodeOrThrow(supabase, staffCode) {
  const normalizedCode = String(staffCode ?? "").trim();

  const { data: card, error } = await supabase
    .from("v_staff_stamp_cards_current")
    .select("*")
    .eq("staff_code", normalizedCode)
    .eq("program_code", STAFF_PROGRAM_CODE)
    .eq("card_status", "active")
    .maybeSingle();

  if (error) {
    throw new Error("従業員カード情報の取得に失敗しました。時間をおいてもう一度お試しください。");
  }

  if (!card) {
    throw new Error("従業員カードが見つかりません。従業員コードを確認してください。");
  }

  return card;
}

async function getStaffCardWithStatusByCodeOrThrow(supabase, staffCode) {
  const card = await getStaffCardByCodeOrThrow(supabase, staffCode);
  return await attachStaffExtraStatus(supabase, card);
}

async function assertActiveStaffEmployeeByUserId(supabase, userId) {
  const { data: profile, error } = await supabase
    .from("employee_profiles")
    .select("user_id, staff_code, employee_name, employment_status")
    .eq("user_id", Number(userId))
    .maybeSingle();

  if (error) {
    throw new Error("従業員状態の確認に失敗しました。時間をおいてもう一度お試しください。");
  }

  if (!profile) {
    throw new Error("従業員プロフィールが見つかりません。管理画面で確認してください。");
  }

  if (profile.employment_status !== "active") {
    throw new Error("あなたはDiscordから出勤・退勤操作できません。店長に確認してください。");
  }

  return profile;
}

async function syncCard(req, userId) {
  const origin = new URL(req.url).origin;
  const syncRes = await fetch(`${origin}/api/sync-card/${userId}`, {
    method: "POST",
  });
  const syncJson = await syncRes.json();

  if (!syncRes.ok || !syncJson.ok) {
    throw new Error("カード画像の更新に失敗しました。時間をおいてもう一度お試しください。");
  }
}

async function syncStaffCard(req, userId) {
  const origin = new URL(req.url).origin;
  const syncRes = await fetch(`${origin}/api/sync-staff-card/${userId}`, {
    method: "POST",
  });
  const syncJson = await syncRes.json();

  if (!syncRes.ok || !syncJson.ok) {
    throw new Error("従業員カード画像の更新に失敗しました。時間をおいてもう一度お試しください。");
  }
}

async function updateDisplayNameIfNeeded(supabase, userId, name) {
  if (typeof name !== "string") return;

  const trimmedName = name.trim();

  const { error } = await supabase
    .from("users")
    .update({
      display_name: trimmedName === "" ? "未登録" : trimmedName,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error("氏名の更新に失敗しました。時間をおいてもう一度お試しください。");
  }
}

async function processStampAction({ req, userId, action, name, actedBy }) {
  const supabase = createSupabaseClient();
  const card = await getStampCardOrThrow(supabase, userId);

  if (!["add", "remove"].includes(action)) {
    throw new Error("操作内容が正しくありません。もう一度お試しください。");
  }

  if (typeof name === "string") {
    await updateDisplayNameIfNeeded(supabase, userId, name);
  }

  const diff = action === "add" ? 1 : -1;

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "increment_stamp_card",
    {
      p_card_id: card.card_id,
      p_amount: diff,
      p_acted_by: actedBy ?? "discord_bot",
      p_reason:
        action === "add"
          ? "Discord bot からスタンプ追加"
          : "Discord bot からスタンプ減算",
    }
  );

  if (rpcError || !rpcResult || rpcResult.length === 0) {
    throw new Error("スタンプの更新に失敗しました。時間をおいてもう一度お試しください。");
  }

  await syncCard(req, userId);

  return await getStampCardOrThrow(supabase, userId);
}

async function processStaffClockIn({ req, userId, actedBy }) {
  const supabase = createSupabaseClient();

  await assertActiveStaffEmployeeByUserId(supabase, userId);

  const baseCard = await getStaffCardByUserIdOrThrow(supabase, userId);

  const { error } = await supabase.rpc("staff_clock_in", {
    p_user_id: Number(userId),
    p_acted_by: actedBy ?? "discord_staff_bot",
    p_source: "discord",
    p_note: "Discordから出勤",
  });

  if (error) {
    throw new Error(error.message);
  }

  const monthlyAttendanceCount = await getStaffMonthlyAttendanceCount(
    supabase,
    userId
  );

  await syncStaffCardVisualCountToMonthly({
    supabase,
    card: baseCard,
    monthlyAttendanceCount,
    actedBy,
    reason: "Discordから出勤",
  });

  await syncStaffCard(req, userId);
  await sleep(800);

  return await getStaffCardWithStatusByUserIdOrThrow(supabase, userId);
}

async function processStaffClockOut({ req, userId, actedBy }) {
  const supabase = createSupabaseClient();

  await assertActiveStaffEmployeeByUserId(supabase, userId);

  const { error } = await supabase.rpc("staff_clock_out", {
    p_user_id: Number(userId),
    p_acted_by: actedBy ?? "discord_staff_bot",
    p_source: "discord",
    p_note: "Discordから退勤",
  });

  if (error) {
    throw new Error(error.message);
  }

  await sleep(300);

  return await getStaffCardWithStatusByUserIdOrThrow(supabase, userId);
}

async function processStaffFix({
  req,
  userId,
  workDate,
  clockInTime,
  clockOutTime,
  reason,
  actedBy,
}) {
  const supabase = createSupabaseClient();

  await assertActiveStaffEmployeeByUserId(supabase, userId);

  const beforeCard = await getStaffCardByUserIdOrThrow(supabase, userId);

  const { error } = await supabase.rpc("staff_fix_work_session", {
    p_user_id: Number(userId),
    p_work_date: workDate,
    p_clock_in_time: clockInTime || null,
    p_clock_out_time: clockOutTime || null,
    p_reason: reason || "Discordから勤務時間修正",
    p_acted_by: actedBy ?? "discord_staff_bot",
    p_source: "discord",
  });

  if (error) {
    throw new Error(error.message);
  }

  const monthlyAttendanceCount = await getStaffMonthlyAttendanceCount(
    supabase,
    userId
  );

  await syncStaffCardVisualCountToMonthly({
    supabase,
    card: beforeCard,
    monthlyAttendanceCount,
    actedBy,
    reason: "Discordから勤務時間修正",
  });

  await syncStaffCard(req, userId);
  await sleep(800);

  return await getStaffCardWithStatusByUserIdOrThrow(supabase, userId);
}

async function createCard({ req, name, actedBy }) {
  const supabase = createSupabaseClient();
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const displayName = trimmedName === "" ? "未登録" : trimmedName;
  const now = new Date().toISOString();

  const { data: newUser, error: createUserError } = await supabase
    .from("users")
    .insert({
      display_name: displayName,
      status: "active",
      updated_at: now,
    })
    .select("user_id")
    .maybeSingle();

  if (createUserError || !newUser) {
    throw new Error("新しいカードの発行に失敗しました。時間をおいてもう一度お試しください。");
  }

  const { data: createdCardRows, error: createCardError } = await supabase.rpc(
    "create_stamp_card_for_user",
    {
      p_user_id: newUser.user_id,
      p_program_code: STAMP_PROGRAM_CODE,
      p_max_count: DEFAULT_MAX_COUNT,
      p_note: `Discord bot から新規発行 (${actedBy ?? "discord_bot"})`,
    }
  );

  if (createCardError || !createdCardRows || createdCardRows.length === 0) {
    throw new Error("カード本体の作成に失敗しました。時間をおいてもう一度お試しください。");
  }

  await syncCard(req, newUser.user_id);

  return await getStampCardOrThrow(supabase, newUser.user_id);
}

async function createStaffCard({ req, staffCode, name, actedBy }) {
  const supabase = createSupabaseClient();
  const normalizedCode = String(staffCode ?? "").trim();
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const displayName = trimmedName === "" ? "未登録" : trimmedName;
  const now = new Date().toISOString();

  if (!normalizedCode) {
    throw new Error("従業員コードを確認してください。");
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("employee_profiles")
    .select("employee_id")
    .eq("staff_code", normalizedCode)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error("従業員コードの確認に失敗しました。時間をおいてもう一度お試しください。");
  }

  if (existingProfile) {
    throw new Error("その従業員コードはすでに使用されています。");
  }

  const { data: newUser, error: createUserError } = await supabase
    .from("users")
    .insert({
      display_name: displayName,
      status: "active",
      updated_at: now,
    })
    .select("user_id")
    .maybeSingle();

  if (createUserError || !newUser) {
    throw new Error("従業員ユーザーの作成に失敗しました。時間をおいてもう一度お試しください。");
  }

  const { error: createProfileError } = await supabase
    .from("employee_profiles")
    .insert({
      user_id: newUser.user_id,
      staff_code: normalizedCode,
      employee_name: trimmedName === "" ? null : trimmedName,
      employment_status: "active",
    });

  if (createProfileError) {
    throw new Error("従業員プロフィールの作成に失敗しました。時間をおいてもう一度お試しください。");
  }

  const { data: createdCardRows, error: createCardError } = await supabase.rpc(
    "create_stamp_card_for_user",
    {
      p_user_id: newUser.user_id,
      p_program_code: STAFF_PROGRAM_CODE,
      p_max_count: DEFAULT_STAFF_MAX_COUNT,
      p_note: `Discord bot から従業員カード新規発行 (${actedBy ?? "discord_staff_bot"})`,
    }
  );

  if (createCardError || !createdCardRows || createdCardRows.length === 0) {
    throw new Error("従業員カード本体の作成に失敗しました。時間をおいてもう一度お試しください。");
  }

  await syncStaffCard(req, newUser.user_id);
  await sleep(800);

  return await getStaffCardWithStatusByCodeOrThrow(supabase, normalizedCode);
}

async function processNameUpdate({ req, userId, name }) {
  const supabase = createSupabaseClient();
  const trimmedName = typeof name === "string" ? name.trim() : "";

  const { error } = await supabase
    .from("users")
    .update({
      display_name: trimmedName === "" ? "未登録" : trimmedName,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error("氏名の更新に失敗しました。時間をおいてもう一度お試しください。");
  }

  await syncCard(req, userId);

  return await getStampCardOrThrow(supabase, userId);
}

function createStaffFixModal(userId) {
  const defaultWorkDate = getJstWorkDateString();

  return {
    type: 9,
    data: {
      custom_id: `staff_fix_modal:${userId}`,
      title: "勤務時間修正",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "work_date_input",
              label: "対象日",
              style: 1,
              min_length: 10,
              max_length: 10,
              required: true,
              value: defaultWorkDate,
              placeholder: "例: 2026-09-27",
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "clock_in_time_input",
              label: "出勤時刻",
              style: 1,
              min_length: 0,
              max_length: 5,
              required: false,
              placeholder: "例: 21:00 ※日付またぎは25:00/26:00",
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "clock_out_time_input",
              label: "退勤時刻",
              style: 1,
              min_length: 0,
              max_length: 5,
              required: false,
              placeholder: "例: 23:30 / 25:30 ※日付またぎは25:00/26:00",
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "reason_input",
              label: "理由",
              style: 1,
              min_length: 0,
              max_length: 50,
              required: false,
              placeholder: "例: 押し忘れ",
            },
          ],
        },
      ],
    },
  };
}

function getModalInputValue(body, customId) {
  const rows = body.data?.components ?? [];

  for (const row of rows) {
    const input = row?.components?.[0];
    if (input?.custom_id === customId) {
      return input?.value ?? "";
    }
  }

  return "";
}

function normalizeWorkDate(value) {
  const text = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("対象日は YYYY-MM-DD 形式で入力してください。例: 2026-09-27");
  }

  return text;
}

function normalizeTimeOrNull(value, label) {
  const text = String(value ?? "").trim();

  if (!text) return null;

  if (!/^\d{1,2}:[0-5]\d$/.test(text)) {
    throw new Error(`${label}は HH:MM 形式で入力してください。例: 21:00`);
  }

  return text;
}

export async function POST(req) {
  const rawBody = await req.text();

  const isValid = await verifyDiscordRequest(req, rawBody);
  if (!isValid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  if (body.type === 1) {
    return Response.json({ type: 1 });
  }

  if (body.type === 3) {
    const customId = body.data?.custom_id ?? "";

    if (customId.startsWith("stamp:name:")) {
      const userId = customId.split(":")[2];

      return Response.json({
        type: 9,
        data: {
          custom_id: `name_modal:${userId}`,
          title: "氏名変更",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "name_input",
                  label: "氏名",
                  style: 1,
                  min_length: 0,
                  max_length: 20,
                  required: false,
                  placeholder: "空欄で未登録に戻せます",
                },
              ],
            },
          ],
        },
      });
    }

    if (customId.startsWith("stamp:search:")) {
      return Response.json({
        type: 9,
        data: {
          custom_id: "search_id_modal",
          title: "ID検索",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "search_id_input",
                  label: "検索したいカードID",
                  style: 1,
                  min_length: 1,
                  max_length: 10,
                  required: true,
                  placeholder: "例: 12",
                },
              ],
            },
          ],
        },
      });
    }

    if (customId.startsWith("staff:search:")) {
      return Response.json({
        type: 9,
        data: {
          custom_id: "staff_search_modal",
          title: "従業員検索",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "staff_code_input",
                  label: "検索したい従業員コード",
                  style: 1,
                  min_length: 1,
                  max_length: 20,
                  required: true,
                  placeholder: "例: Bambi01",
                },
              ],
            },
          ],
        },
      });
    }

    if (customId.startsWith("staff:fix:")) {
      const userId = customId.split(":")[2];
      return Response.json(createStaffFixModal(userId));
    }

    const interactionId = body.id;
    const interactionToken = body.token;
    const applicationId = body.application_id;
    const operatorName = getOperatorName(body);

    try {
      await sendDeferredResponse(interactionId, interactionToken);

      const [prefix, action, userIdRaw] = customId.split(":");
      const userId = Number(userIdRaw);

      if (prefix === "stamp") {
        if (!Number.isFinite(userId)) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "操作内容を読み取れませんでした。もう一度お試しください。",
            components: [],
          });
          return new Response(null, { status: 202 });
        }

        const updatedCard = await processStampAction({
          req,
          userId,
          action,
          actedBy: operatorName,
        });

        const actionMessage =
          action === "add"
            ? `${operatorName} さんがスタンプを追加しました。`
            : `${operatorName} さんがスタンプを減らしました。`;

        await editOriginalResponse(
          applicationId,
          interactionToken,
          buildPanelPayload(updatedCard, actionMessage)
        );

        return new Response(null, { status: 202 });
      }

      if (prefix === "staff") {
        if (!Number.isFinite(userId)) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "操作内容を読み取れませんでした。もう一度お試しください。",
            components: [],
          });
          return new Response(null, { status: 202 });
        }

        let updatedCard;
        let actionMessage;

        if (action === "clockin" || action === "add") {
          updatedCard = await processStaffClockIn({
            req,
            userId,
            actedBy: operatorName,
          });
          actionMessage = `${operatorName} さんが出勤しました。`;
        } else if (action === "clockout" || action === "remove") {
          updatedCard = await processStaffClockOut({
            req,
            userId,
            actedBy: operatorName,
          });
          actionMessage = `${operatorName} さんが退勤しました。`;
        } else {
          throw new Error("操作内容を読み取れませんでした。もう一度お試しください。");
        }

        await editOriginalResponseWithStaffImage(
          applicationId,
          interactionToken,
          updatedCard,
          (imageUrl) => buildStaffPanelPayload(updatedCard, actionMessage, imageUrl)
        );

        return new Response(null, { status: 202 });
      }

      await editOriginalResponse(applicationId, interactionToken, {
        content: "操作内容を読み取れませんでした。もう一度お試しください。",
        components: [],
      });
      return new Response(null, { status: 202 });
    } catch (error) {
      try {
        await editOriginalResponse(applicationId, interactionToken, {
          content:
            error instanceof Error
              ? error.message
              : "エラーが発生しました。もう一度お試しください。",
          components: [],
        });
      } catch {
        // ignore
      }

      return new Response(null, { status: 202 });
    }
  }

  if (body.type === 5) {
    const interactionId = body.id;
    const interactionToken = body.token;
    const applicationId = body.application_id;
    const operatorName = getOperatorName(body);

    try {
      await sendDeferredResponse(interactionId, interactionToken);

      const customId = body.data?.custom_id ?? "";

      if (customId === "search_id_modal") {
        const rawSearchId = getModalInputValue(body, "search_id_input");
        const userId = Number(String(rawSearchId).trim());

        if (!Number.isFinite(userId)) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "カード番号を確認してください。",
          });
          return new Response(null, { status: 202 });
        }

        const supabase = createSupabaseClient();
        const card = await getStampCardOrThrow(supabase, userId);

        await editOriginalResponse(
          applicationId,
          interactionToken,
          buildPanelPayload(card, "カード情報を表示しました。")
        );

        return new Response(null, { status: 202 });
      }

      if (customId === "staff_search_modal") {
        const rawStaffCode = getModalInputValue(body, "staff_code_input");
        const staffCode = String(rawStaffCode).trim();

        if (!staffCode) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "従業員コードを確認してください。",
          });
          return new Response(null, { status: 202 });
        }

        const supabase = createSupabaseClient();
        const card = await getStaffCardWithStatusByCodeOrThrow(
          supabase,
          staffCode
        );

        await editOriginalResponseWithStaffImage(
          applicationId,
          interactionToken,
          card,
          (imageUrl) =>
            buildStaffPanelPayload(card, "従業員カードを表示しました。", imageUrl)
        );

        return new Response(null, { status: 202 });
      }

      if (customId.startsWith("staff_fix_modal:")) {
        const userId = Number(customId.split(":")[1]);

        if (!Number.isFinite(userId)) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "従業員情報を読み取れませんでした。もう一度お試しください。",
          });
          return new Response(null, { status: 202 });
        }

        const workDate = normalizeWorkDate(
          getModalInputValue(body, "work_date_input")
        );
        const clockInTime = normalizeTimeOrNull(
          getModalInputValue(body, "clock_in_time_input"),
          "出勤時刻"
        );
        const clockOutTime = normalizeTimeOrNull(
          getModalInputValue(body, "clock_out_time_input"),
          "退勤時刻"
        );
        const reason =
          String(getModalInputValue(body, "reason_input") ?? "").trim() ||
          "Discordから勤務時間修正";

        if (!clockInTime && !clockOutTime) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "出勤時刻または退勤時刻を入力してください。",
          });
          return new Response(null, { status: 202 });
        }

        const updatedCard = await processStaffFix({
          req,
          userId,
          workDate,
          clockInTime,
          clockOutTime,
          reason,
          actedBy: operatorName,
        });

        await editOriginalResponseWithStaffImage(
          applicationId,
          interactionToken,
          updatedCard,
          (imageUrl) =>
            buildStaffPanelPayload(
              updatedCard,
              `${operatorName} さんが勤務時間を修正しました。`,
              imageUrl
            )
        );

        return new Response(null, { status: 202 });
      }

      const [prefix, userIdRaw] = customId.split(":");
      const userId = Number(userIdRaw);

      if (prefix !== "name_modal" || !Number.isFinite(userId)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "入力内容を読み取れませんでした。もう一度お試しください。",
        });
        return new Response(null, { status: 202 });
      }

      const newName = getModalInputValue(body, "name_input");

      const result = await processNameUpdate({
        req,
        userId,
        name: newName,
      });

      await editOriginalResponse(
        applicationId,
        interactionToken,
        buildPanelPayload(result, "氏名を更新しました。")
      );

      return new Response(null, { status: 202 });
    } catch (error) {
      try {
        await editOriginalResponse(applicationId, interactionToken, {
          content:
            error instanceof Error
              ? error.message
              : "エラーが発生しました。もう一度お試しください。",
        });
      } catch {
        // ignore
      }

      return new Response(null, { status: 202 });
    }
  }

  if (body.type !== 2) {
    return new Response("Unhandled interaction type", { status: 400 });
  }

  const commandName = body.data?.name;
  const interactionId = body.id;
  const interactionToken = body.token;
  const applicationId = body.application_id;
  const operatorName = getOperatorName(body);

  try {
    await sendDeferredResponse(interactionId, interactionToken);

    if (commandName === "stamp") {
      const options = body.data?.options ?? [];
      const userId = Number(getOptionValue(options, "id"));
      const action = getOptionValue(options, "action");
      const name = getOptionValue(options, "name");

      if (!Number.isFinite(userId)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "カード番号を確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      if (!["add", "remove"].includes(action)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "操作内容を確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      const result = await processStampAction({
        req,
        userId,
        action,
        name,
        actedBy: operatorName,
      });

      const actionMessage =
        action === "add"
          ? `${operatorName} さんがスタンプを追加しました。`
          : `${operatorName} さんがスタンプを減らしました。`;

      await editOriginalResponse(applicationId, interactionToken, {
        content: actionMessage,
        ...buildMainEmbed(result, actionMessage),
      });

      return new Response(null, { status: 202 });
    }

    if (commandName === "panel") {
      const options = body.data?.options ?? [];
      const userId = Number(getOptionValue(options, "id"));

      if (!Number.isFinite(userId)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "カード番号を確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      const supabase = createSupabaseClient();
      const card = await getStampCardOrThrow(supabase, userId);

      await editOriginalResponse(
        applicationId,
        interactionToken,
        buildPanelPayload(card, "操作パネルを表示しました。")
      );

      return new Response(null, { status: 202 });
    }

    if (commandName === "create") {
      const options = body.data?.options ?? [];
      const name = getOptionValue(options, "name");

      const newCard = await createCard({
        req,
        name,
        actedBy: operatorName,
      });

      await editOriginalResponse(
        applicationId,
        interactionToken,
        buildPanelPayload(
          newCard,
          `${operatorName} さんが新しいスタンプカードを発行しました。名前変更ボタンから氏名登録もできます。`
        )
      );

      return new Response(null, { status: 202 });
    }

    if (commandName === "staff") {
      const options = body.data?.options ?? [];
      const staffCode = String(getOptionValue(options, "code") ?? "").trim();
      const action = getOptionValue(options, "action");

      if (!staffCode) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "従業員コードを確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      const supabase = createSupabaseClient();
      const targetCard = await getStaffCardByCodeOrThrow(supabase, staffCode);

      let result;
      let actionMessage;

      if (action === "clockin" || action === "add") {
        result = await processStaffClockIn({
          req,
          userId: targetCard.user_id,
          actedBy: operatorName,
        });
        actionMessage = `${operatorName} さんが出勤しました。`;
      } else if (action === "clockout" || action === "remove") {
        result = await processStaffClockOut({
          req,
          userId: targetCard.user_id,
          actedBy: operatorName,
        });
        actionMessage = `${operatorName} さんが退勤しました。`;
      } else {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "操作内容を確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      await editOriginalResponseWithStaffImage(
        applicationId,
        interactionToken,
        result,
        (imageUrl) => ({
          content: actionMessage,
          ...buildStaffEmbed(result, actionMessage, imageUrl),
        })
      );

      return new Response(null, { status: 202 });
    }

    if (commandName === "staffpanel") {
      const options = body.data?.options ?? [];
      const staffCode = String(getOptionValue(options, "code") ?? "").trim();

      if (!staffCode) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "従業員コードを確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      const supabase = createSupabaseClient();
      const card = await getStaffCardWithStatusByCodeOrThrow(
        supabase,
        staffCode
      );

      await editOriginalResponseWithStaffImage(
        applicationId,
        interactionToken,
        card,
        (imageUrl) =>
          buildStaffPanelPayload(card, "操作パネルを表示しました。", imageUrl)
      );

      return new Response(null, { status: 202 });
    }

    if (commandName === "staffcreate") {
      const options = body.data?.options ?? [];
      const staffCode = String(getOptionValue(options, "code") ?? "").trim();
      const name = getOptionValue(options, "name");

      if (!staffCode) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "従業員コードを確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      const newCard = await createStaffCard({
        req,
        staffCode,
        name,
        actedBy: operatorName,
      });

      await editOriginalResponseWithStaffImage(
        applicationId,
        interactionToken,
        newCard,
        (imageUrl) =>
          buildStaffPanelPayload(
            newCard,
            `${operatorName} さんが新しい従業員カードを発行しました。`,
            imageUrl
          )
      );

      return new Response(null, { status: 202 });
    }

    await editOriginalResponse(applicationId, interactionToken, {
      content: "このコマンドにはまだ対応していません。",
    });
    return new Response(null, { status: 202 });
  } catch (error) {
    try {
      await editOriginalResponse(applicationId, interactionToken, {
        content:
          error instanceof Error
            ? error.message
            : "エラーが発生しました。もう一度お試しください。",
      });
    } catch {
      // ignore
    }

    return new Response(null, { status: 202 });
  }
}