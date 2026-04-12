import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVE_CARD_BASE =
  "https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live";

function getOptionValue(options, name) {
  if (!Array.isArray(options)) return undefined;
  return options.find((option) => option.name === name)?.value;
}

function getFixedCardUrl(userId) {
  return `${LIVE_CARD_BASE}/${userId}.png`;
}

function getPreviewImageUrl(user) {
  const fixedUrl = getFixedCardUrl(user.user_id);
  const version = user.updated_at
    ? new Date(user.updated_at).getTime()
    : Date.now();

  return `${fixedUrl}?v=${version}`;
}

function buildMainEmbed(user, extraDescription = "") {
  const fixedCardUrl = getFixedCardUrl(user.user_id);
  const previewImageUrl = getPreviewImageUrl(user);

  return {
    embeds: [
      {
        title: "🌸 -Bistro-Bambi スタンプカード",
        color: 0xe9a8b5,
        description: extraDescription || "カード情報です。",
        fields: [
          {
            name: "ID",
            value: String(user.user_id),
            inline: true,
          },
          {
            name: "氏名",
            value: user.name ?? "未登録",
            inline: true,
          },
          {
            name: "スタンプ数",
            value: `${user.stamp_count}`,
            inline: true,
          },
          {
            name: "カードURL",
            value: fixedCardUrl,
            inline: false,
          },
        ],
        image: {
          url: previewImageUrl,
        },
      },
    ],
  };
}

function buildPanelPayload(user, extraDescription = "") {
  return {
    ...buildMainEmbed(user, extraDescription),
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "+1",
            custom_id: `confirm:add:${user.user_id}`,
          },
          {
            type: 2,
            style: 4,
            label: "-1",
            custom_id: `confirm:remove:${user.user_id}`,
          },
          {
            type: 2,
            style: 1,
            label: "名前変更",
            custom_id: `stamp:name:${user.user_id}`,
          },
        ],
      },
    ],
  };
}

function buildConfirmPayload(user, action) {
  const actionLabel = action === "add" ? "スタンプを +1" : "スタンプを -1";
  const actionText = action === "add" ? "追加" : "減算";

  return {
    ...buildMainEmbed(
      user,
      `**確認:** このカードのスタンプを${actionText}しますか？`
    ),
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "はい",
            custom_id: `apply:${action}:${user.user_id}`,
          },
          {
            type: 2,
            style: 2,
            label: "いいえ",
            custom_id: `cancel:${user.user_id}`,
          },
        ],
      },
    ],
    content: `確認中: ${actionLabel}`,
  };
}

async function verifyDiscordRequest(req, rawBody) {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

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

async function getUserOrThrow(supabase, userId) {
  const { data: user, error } = await supabase
    .from("users")
    .select("user_id, name, stamp_count, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`DBエラー: ${error.message}`);
  }

  if (!user) {
    throw new Error(`ID ${userId} のカードが見つかりません。`);
  }

  return user;
}

async function syncCard(req, userId) {
  const origin = new URL(req.url).origin;
  const syncRes = await fetch(`${origin}/api/sync-card/${userId}`, {
    method: "POST",
  });
  const syncJson = await syncRes.json();

  if (!syncRes.ok || !syncJson.ok) {
    throw new Error(
      `画像更新に失敗しました: ${syncJson.error ?? "unknown error"}`
    );
  }
}

async function processStampAction({ req, userId, action, name }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase の環境変数が不足しています。");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const user = await getUserOrThrow(supabase, userId);

  if (!["add", "remove"].includes(action)) {
    throw new Error("action は add / remove のみ対応です。");
  }

  const diff = action === "add" ? 1 : -1;
  const nextStampCount = Math.max(
    0,
    Math.min(10, Number(user.stamp_count ?? 0) + diff)
  );

  const updatePayload = {
    stamp_count: nextStampCount,
    updated_at: new Date().toISOString(),
  };

  if (typeof name === "string") {
    const trimmedName = name.trim();
    updatePayload.name = trimmedName === "" ? null : trimmedName;
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("user_id", userId)
    .select("user_id, name, stamp_count, updated_at")
    .maybeSingle();

  if (updateError || !updatedUser) {
    throw new Error(
      `更新に失敗しました: ${updateError?.message ?? "unknown error"}`
    );
  }

  await syncCard(req, userId);

  return updatedUser;
}

async function processNameUpdate({ req, userId, name }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase の環境変数が不足しています。");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const trimmedName = typeof name === "string" ? name.trim() : "";

  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update({
      name: trimmedName === "" ? null : trimmedName,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("user_id, name, stamp_count, updated_at")
    .maybeSingle();

  if (updateError || !updatedUser) {
    throw new Error(
      `氏名更新に失敗しました: ${updateError?.message ?? "unknown error"}`
    );
  }

  await syncCard(req, userId);

  return updatedUser;
}

async function createCard({ req, name }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase の環境変数が不足しています。");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const trimmedName = typeof name === "string" ? name.trim() : "";

  const { data: newUser, error: createError } = await supabase
    .from("users")
    .insert({
      name: trimmedName === "" ? null : trimmedName,
      stamp_count: 0,
      updated_at: new Date().toISOString(),
    })
    .select("user_id, name, stamp_count, updated_at")
    .maybeSingle();

  if (createError || !newUser) {
    throw new Error(
      `新規カード発行に失敗しました: ${createError?.message ?? "unknown error"}`
    );
  }

  await syncCard(req, newUser.user_id);

  return newUser;
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

  // ボタン押下
  if (body.type === 3) {
    const customId = body.data?.custom_id ?? "";

    // 名前変更ボタン -> modal を即返す
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

    // +1 / -1 確認画面は即返す
    if (customId.startsWith("confirm:")) {
      const [, action, userIdRaw] = customId.split(":");
      const userId = Number(userIdRaw);

      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const user = await getUserOrThrow(supabase, userId);

        return Response.json({
          type: 7,
          data: buildConfirmPayload(user, action),
        });
      } catch (error) {
        return Response.json({
          type: 7,
          data: {
            content:
              error instanceof Error
                ? `エラー: ${error.message}`
                : "不明なエラーが発生しました。",
            components: [],
          },
        });
      }
    }

    // いいえ -> 元パネルに戻す
    if (customId.startsWith("cancel:")) {
      const userId = Number(customId.split(":")[1]);

      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const user = await getUserOrThrow(supabase, userId);

        return Response.json({
          type: 7,
          data: buildPanelPayload(user, "操作をキャンセルしました。"),
        });
      } catch (error) {
        return Response.json({
          type: 7,
          data: {
            content:
              error instanceof Error
                ? `エラー: ${error.message}`
                : "不明なエラーが発生しました。",
            components: [],
          },
        });
      }
    }

    const interactionId = body.id;
    const interactionToken = body.token;
    const applicationId = body.application_id;

    try {
      await sendDeferredResponse(interactionId, interactionToken);

      // はい -> 実行
      if (customId.startsWith("apply:")) {
        const [, action, userIdRaw] = customId.split(":");
        const userId = Number(userIdRaw);

        if (!Number.isFinite(userId)) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "不正なボタンです。",
            components: [],
          });
          return new Response(null, { status: 202 });
        }

        const updatedUser = await processStampAction({
          req,
          userId,
          action,
        });

        const actionText = action === "add" ? "スタンプを追加しました。" : "スタンプを減らしました。";

        await editOriginalResponse(
          applicationId,
          interactionToken,
          buildPanelPayload(updatedUser, actionText)
        );

        return new Response(null, { status: 202 });
      }

      await editOriginalResponse(applicationId, interactionToken, {
        content: "不正なボタンです。",
        components: [],
      });

      return new Response(null, { status: 202 });
    } catch (error) {
      try {
        await editOriginalResponse(applicationId, interactionToken, {
          content:
            error instanceof Error
              ? `エラー: ${error.message}`
              : "不明なエラーが発生しました。",
          components: [],
        });
      } catch {
        // ignore
      }

      return new Response(null, { status: 202 });
    }
  }

  // Modal 送信
  if (body.type === 5) {
    const interactionId = body.id;
    const interactionToken = body.token;
    const applicationId = body.application_id;

    try {
      await sendDeferredResponse(interactionId, interactionToken);

      const customId = body.data?.custom_id ?? "";
      const [prefix, userIdRaw] = customId.split(":");
      const userId = Number(userIdRaw);

      if (prefix !== "name_modal" || !Number.isFinite(userId)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "不正な入力です。",
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
              ? `エラー: ${error.message}`
              : "不明なエラーが発生しました。",
        });
      } catch {
        // ignore
      }

      return new Response(null, { status: 202 });
    }
  }

  // Slash Command
  if (body.type !== 2) {
    return new Response("Unhandled interaction type", { status: 400 });
  }

  const commandName = body.data?.name;
  const interactionId = body.id;
  const interactionToken = body.token;
  const applicationId = body.application_id;

  try {
    await sendDeferredResponse(interactionId, interactionToken);

    if (commandName === "stamp") {
      const options = body.data?.options ?? [];
      const userId = Number(getOptionValue(options, "id"));
      const action = getOptionValue(options, "action");
      const name = getOptionValue(options, "name");

      if (!Number.isFinite(userId)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "ID が不正です。",
        });
        return new Response(null, { status: 202 });
      }

      if (!["add", "remove"].includes(action)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "action は add か remove を指定してください。",
        });
        return new Response(null, { status: 202 });
      }

      const result = await processStampAction({
        req,
        userId,
        action,
        name,
      });

      const actionText = action === "add" ? "スタンプを追加しました。" : "スタンプを減らしました。";

      await editOriginalResponse(applicationId, interactionToken, {
        content: actionText,
        ...buildMainEmbed(result, actionText),
      });

      return new Response(null, { status: 202 });
    }

    if (commandName === "panel") {
      const options = body.data?.options ?? [];
      const userId = Number(getOptionValue(options, "id"));

      if (!Number.isFinite(userId)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "ID が不正です。",
        });
        return new Response(null, { status: 202 });
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const user = await getUserOrThrow(supabase, userId);

      await editOriginalResponse(
        applicationId,
        interactionToken,
        buildPanelPayload(user, "操作パネルを表示しました。")
      );

      return new Response(null, { status: 202 });
    }

    if (commandName === "create") {
      const options = body.data?.options ?? [];
      const name = getOptionValue(options, "name");

      const newUser = await createCard({
        req,
        name,
      });

      await editOriginalResponse(
        applicationId,
        interactionToken,
        buildPanelPayload(newUser, "新しいカードを発行しました。")
      );

      return new Response(null, { status: 202 });
    }

    await editOriginalResponse(applicationId, interactionToken, {
      content: "未対応のコマンドです。",
    });
    return new Response(null, { status: 202 });
  } catch (error) {
    try {
      await editOriginalResponse(applicationId, interactionToken, {
        content:
          error instanceof Error
            ? `エラー: ${error.message}`
            : "不明なエラーが発生しました。",
      });
    } catch {
      // ignore
    }

    return new Response(null, { status: 202 });
  }
}