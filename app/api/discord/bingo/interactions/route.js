import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVE_BINGO_BASE =
  "https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live-bingo";
const BINGO_PROGRAM_CODE = "bingo_regular";

function getOptionValue(options, name) {
  if (!Array.isArray(options)) return undefined;
  return options.find((option) => option.name === name)?.value;
}

function getFixedCardUrl(userId) {
  return `${LIVE_BINGO_BASE}/${userId}.png`;
}

function getPreviewImageUrl(card) {
  const fixedUrl = getFixedCardUrl(card.user_id);
  return `${fixedUrl}?preview=${Date.now()}`;
}

function getOperatorName(body) {
  const nick = body?.member?.nick;
  const globalName = body?.user?.global_name ?? body?.member?.user?.global_name;
  const username = body?.user?.username ?? body?.member?.user?.username;

  return nick || globalName || username || "担当者";
}

function buildMainEmbed(card, description = "") {
  return {
    embeds: [
      {
        title: "-Bistro-Bambi ビンゴカード",
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
            name: "ビンゴ数",
            value: String(card.current_bingo_count ?? 0),
            inline: true,
          },
          {
            name: "カードURL",
            value: getFixedCardUrl(card.user_id),
            inline: false,
          },
        ],
        image: {
          url: getPreviewImageUrl(card),
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
            label: "番号を開く",
            custom_id: `bingo:open:${card.user_id}`,
          },
          {
            type: 2,
            style: 1,
            label: "名前変更",
            custom_id: `bingo:name:${card.user_id}`,
          },
          {
            type: 2,
            style: 2,
            label: "ID検索",
            custom_id: `bingo:search:${card.user_id}`,
          },
        ],
      },
    ],
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

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("システム設定が不足しています。管理者に確認してください。");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function getBingoCardOrThrow(supabase, userId) {
  const { data: card, error } = await supabase
    .from("v_bingo_cards_current")
    .select("*")
    .eq("user_id", userId)
    .eq("program_code", BINGO_PROGRAM_CODE)
    .eq("card_status", "active")
    .maybeSingle();

  if (error) {
    throw new Error("カード情報の取得に失敗しました。時間をおいてもう一度お試しください。");
  }

  if (!card) {
    throw new Error("カードが見つかりません。番号を確認してください。");
  }

  return card;
}

async function syncBingoCard(req, userId) {
  const origin = new URL(req.url).origin;
  const syncRes = await fetch(`${origin}/api/sync-bingo-card/${userId}`, {
    method: "POST",
  });
  const syncJson = await syncRes.json();

  if (!syncRes.ok || !syncJson.ok) {
    throw new Error("カード画像の更新に失敗しました。時間をおいてもう一度お試しください。");
  }
}

async function updateDisplayName(supabase, userId, name) {
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
}

async function processNameUpdate({ req, userId, name }) {
  const supabase = createSupabaseClient();

  await updateDisplayName(supabase, userId, name);
  await syncBingoCard(req, userId);

  return await getBingoCardOrThrow(supabase, userId);
}

async function processOpenNumber({ req, userId, number, actedBy }) {
  const supabase = createSupabaseClient();
  const card = await getBingoCardOrThrow(supabase, userId);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("開ける番号を確認してください。");
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "mark_bingo_number",
    {
      p_card_id: card.card_id,
      p_number: number,
      p_product_name: null,
      p_acted_by: actedBy ?? "discord_bot",
      p_note: "Discord bot から番号開放",
    }
  );

  if (rpcError || !rpcResult || rpcResult.length === 0) {
    throw new Error("番号の開放に失敗しました。時間をおいてもう一度お試しください。");
  }

  const result = rpcResult[0];

  await syncBingoCard(req, userId);

  const updatedCard = await getBingoCardOrThrow(supabase, userId);

  return {
    card: updatedCard,
    alreadyMarked: Boolean(result.already_marked),
  };
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
    "create_bingo_card_for_user",
    {
      p_user_id: newUser.user_id,
      p_program_code: BINGO_PROGRAM_CODE,
      p_grid_size: 5,
      p_has_free_center: false,
      p_note: `Discord bot から新規発行 (${actedBy ?? "discord_bot"})`,
    }
  );

  if (createCardError || !createdCardRows || createdCardRows.length === 0) {
    throw new Error("カード本体の作成に失敗しました。時間をおいてもう一度お試しください。");
  }

  await syncBingoCard(req, newUser.user_id);

  return await getBingoCardOrThrow(supabase, newUser.user_id);
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

    if (customId.startsWith("bingo:name:")) {
      const userId = customId.split(":")[2];

      return Response.json({
        type: 9,
        data: {
          custom_id: `bingo_name_modal:${userId}`,
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

    if (customId.startsWith("bingo:search:")) {
      return Response.json({
        type: 9,
        data: {
          custom_id: "bingo_search_id_modal",
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
                  placeholder: "例: 21",
                },
              ],
            },
          ],
        },
      });
    }

    if (customId.startsWith("bingo:open:")) {
      const userId = customId.split(":")[2];

      return Response.json({
        type: 9,
        data: {
          custom_id: `bingo_open_modal:${userId}`,
          title: "番号を開く",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: "open_number_input",
                  label: "開ける番号",
                  style: 1,
                  min_length: 1,
                  max_length: 2,
                  required: true,
                  placeholder: "例: 7",
                },
              ],
            },
          ],
        },
      });
    }

    return new Response("Unhandled component", { status: 400 });
  }

  if (body.type === 5) {
    const interactionId = body.id;
    const interactionToken = body.token;
    const applicationId = body.application_id;
    const operatorName = getOperatorName(body);

    try {
      await sendDeferredResponse(interactionId, interactionToken);

      const customId = body.data?.custom_id ?? "";

      if (customId === "bingo_search_id_modal") {
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
        const card = await getBingoCardOrThrow(supabase, userId);

        await editOriginalResponse(
          applicationId,
          interactionToken,
          buildPanelPayload(card, "カード情報を表示しました。")
        );

        return new Response(null, { status: 202 });
      }

      if (customId.startsWith("bingo_name_modal:")) {
        const userId = Number(customId.split(":")[1]);

        if (!Number.isFinite(userId)) {
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
      }

      if (customId.startsWith("bingo_open_modal:")) {
        const userId = Number(customId.split(":")[1]);

        if (!Number.isFinite(userId)) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "入力内容を読み取れませんでした。もう一度お試しください。",
          });
          return new Response(null, { status: 202 });
        }

        const rows = body.data?.components ?? [];
        const firstInput = rows?.[0]?.components?.[0];
        const rawNumber = firstInput?.value ?? "";
        const number = Number(String(rawNumber).trim());

        if (!Number.isFinite(number)) {
          await editOriginalResponse(applicationId, interactionToken, {
            content: "開ける番号を確認してください。",
          });
          return new Response(null, { status: 202 });
        }

        const result = await processOpenNumber({
          req,
          userId,
          number,
          actedBy: operatorName,
        });

        const description = result.alreadyMarked
          ? `${number}番はすでに開いています。`
          : `${operatorName} さんが ${number}番を開きました。`;

        await editOriginalResponse(
          applicationId,
          interactionToken,
          buildPanelPayload(result.card, description)
        );

        return new Response(null, { status: 202 });
      }

      await editOriginalResponse(applicationId, interactionToken, {
        content: "入力内容を読み取れませんでした。もう一度お試しください。",
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

    if (commandName === "bingo-panel") {
      const options = body.data?.options ?? [];
      const userId = Number(getOptionValue(options, "id"));

      if (!Number.isFinite(userId)) {
        await editOriginalResponse(applicationId, interactionToken, {
          content: "カード番号を確認してください。",
        });
        return new Response(null, { status: 202 });
      }

      const supabase = createSupabaseClient();
      const card = await getBingoCardOrThrow(supabase, userId);

      await editOriginalResponse(
        applicationId,
        interactionToken,
        buildPanelPayload(card, "操作パネルを表示しました。")
      );

      return new Response(null, { status: 202 });
    }

    if (commandName === "bingo-create") {
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
          `${operatorName} さんが新しいビンゴカードを発行しました。パネルから番号開放・氏名変更ができます。`
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