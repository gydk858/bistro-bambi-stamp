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
  return `${fixedUrl}?preview=${Date.now()}`;
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

function buildStaffEmbed(card, description = "") {
  return {
    embeds: [
      {
        title: "-Bistro-Bambi 従業員カード",
        color: 0xa5bb73,
        description,
        fields: [
          {
            name: "従業員コード",
            value: String(card.staff_code ?? "未設定"),
            inline: true,
          },
          {
            name: "現在の出勤数",
            value: `${String(card.current_count ?? 0)} / ${String(
              card.max_count ?? DEFAULT_STAFF_MAX_COUNT
            )}`,
            inline: true,
          },
        ],
        image: {
          url: getStaffPreviewImageUrl(card),
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

function buildStaffPanelPayload(card, description = "操作パネルです。") {
  return {
    ...buildStaffEmbed(card, description),
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "+1",
            custom_id: `staff:add:${card.user_id}`,
          },
          {
            type: 2,
            style: 4,
            label: "-1",
            custom_id: `staff:remove:${card.user_id}`,
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

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("システム設定が不足しています。管理者に確認してください。");
  }

  return createClient(supabaseUrl, serviceRoleKey);
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

async function recordStaffAttendanceEvent({
  supabase,
  userId,
  action,
  actedBy,
}) {
  if (!["add", "remove"].includes(action)) {
    throw new Error("出勤履歴の操作内容が正しくありません。");
  }

  const amount = action === "add" ? 1 : -1;
  const eventType = action === "add" ? "work" : "adjust_minus";
  const workDate = getJstWorkDateString();

  const { error } = await supabase.rpc("record_staff_attendance_event", {
    p_user_id: Number(userId),
    p_work_date: workDate,
    p_amount: amount,
    p_event_type: eventType,
    p_source: "discord",
    p_note:
      action === "add"
        ? "Discord から出勤数追加"
        : "Discord から出勤数減算",
    p_acted_by: actedBy ?? "discord_staff_bot",
  });

  if (error) {
    throw new Error(`出勤履歴の保存に失敗しました: ${error.message}`);
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

async function processStaffAction({ req, userId, action, actedBy }) {
  const supabase = createSupabaseClient();
  const card = await getStaffCardByUserIdOrThrow(supabase, userId);

  if (!["add", "remove"].includes(action)) {
    throw new Error("操作内容が正しくありません。もう一度お試しください。");
  }

  const diff = action === "add" ? 1 : -1;

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "increment_stamp_card",
    {
      p_card_id: card.card_id,
      p_amount: diff,
      p_acted_by: actedBy ?? "discord_staff_bot",
      p_reason:
        action === "add"
          ? "Discord bot から出勤数追加"
          : "Discord bot から出勤数減算",
    }
  );

  if (rpcError || !rpcResult || rpcResult.length === 0) {
    throw new Error("出勤数の更新に失敗しました。時間をおいてもう一度お試しください。");
  }

  await recordStaffAttendanceEvent({
    supabase,
    userId,
    action,
    actedBy,
  });

  await syncStaffCard(req, userId);

  return await getStaffCardByUserIdOrThrow(supabase, userId);
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

  return await getStaffCardByCodeOrThrow(supabase, normalizedCode);
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

        const updatedCard = await processStaffAction({
          req,
          userId,
          action,
          actedBy: operatorName,
        });

        const actionMessage =
          action === "add"
            ? `${operatorName} さんが出勤数を追加しました。`
            : `${operatorName} さんが出勤数を減らしました。`;

        await editOriginalResponse(
          applicationId,
          interactionToken,
          buildStaffPanelPayload(updatedCard, actionMessage)
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

    try {
      await sendDeferredResponse(interactionId, interactionToken);

      const customId = body.data?.custom_id ?? "";

      if (customId === "search_id_modal") {
        const rows = body.data?.components ?? [];
        const firstInput = rows?.[0]?.components?.[0];
        const rawSearchId = firstInput?.value ?? "";
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
        const rows = body.data?.components ?? [];
        const firstInput = rows?.[0]?.components?.[0];
        const rawStaffCode = firstInput?.value ?? "";
        const staffCode = String(rawStaffCode).trim();

        if (!staffCode) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "従業員コードを確認してください。",
          });
          return new Response(null, { status: 202 });
        }

        const supabase = createSupabaseClient();
        const card = await getStaffCardByCodeOrThrow(supabase, staffCode);

        await editOriginalResponse(
          applicationId,
          interactionToken,
          buildStaffPanelPayload(card, "従業員カードを表示しました。")
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

      const rows = body.data?.components ?? [];
      const firstInput = rows?.[0]?.components?.[0];
      const newName = firstInput?.value ?? "";

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

      if (!["add", "remove"].includes(action)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "操作内容を確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      const supabase = createSupabaseClient();
      const targetCard = await getStaffCardByCodeOrThrow(supabase, staffCode);

      const result = await processStaffAction({
        req,
        userId: targetCard.user_id,
        action,
        actedBy: operatorName,
      });

      const actionMessage =
        action === "add"
          ? `${operatorName} さんが出勤数を追加しました。`
          : `${operatorName} さんが出勤数を減らしました。`;

      await editOriginalResponse(applicationId, interactionToken, {
        content: actionMessage,
        ...buildStaffEmbed(result, actionMessage),
      });

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
      const card = await getStaffCardByCodeOrThrow(supabase, staffCode);

      await editOriginalResponse(
        applicationId,
        interactionToken,
        buildStaffPanelPayload(card, "操作パネルを表示しました。")
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

      await editOriginalResponse(
        applicationId,
        interactionToken,
        buildStaffPanelPayload(
          newCard,
          `${operatorName} さんが新しい従業員カードを発行しました。`
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