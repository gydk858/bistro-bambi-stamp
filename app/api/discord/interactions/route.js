import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

function getOptionValue(options, name) {
  if (!Array.isArray(options)) return undefined;
  return options.find((option) => option.name === name)?.value;
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

export async function POST(req) {
  const rawBody = await req.text();

  const isValid = await verifyDiscordRequest(req, rawBody);
  if (!isValid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Discord の PING 応答
  if (body.type === 1) {
    return json({ type: 1 });
  }

  // Slash Command 実行
  if (body.type === 2) {
    const commandName = body.data?.name;

    if (commandName !== "stamp") {
      return json({
        type: 4,
        data: {
          content: "未対応のコマンドです。",
        },
      });
    }

    try {
      const options = body.data?.options ?? [];
      const userId = Number(getOptionValue(options, "id"));
      const action = getOptionValue(options, "action");
      const name = getOptionValue(options, "name");

      if (!Number.isFinite(userId)) {
        return json({
          type: 4,
          data: {
            content: "ID が不正です。",
          },
        });
      }

      if (!["add", "remove"].includes(action)) {
        return json({
          type: 4,
          data: {
            content: "action は add か remove を指定してください。",
          },
        });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        return json({
          type: 4,
          data: {
            content: "Supabase の環境変数が不足しています。",
          },
        });
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey);

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("user_id, name, stamp_count")
        .eq("user_id", userId)
        .maybeSingle();

      if (userError) {
        return json({
          type: 4,
          data: {
            content: `DBエラー: ${userError.message}`,
          },
        });
      }

      if (!user) {
        return json({
          type: 4,
          data: {
            content: `ID ${userId} のカードが見つかりません。`,
          },
        });
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
        .select("user_id, name, stamp_count")
        .maybeSingle();

      if (updateError || !updatedUser) {
        return json({
          type: 4,
          data: {
            content: `更新に失敗しました: ${updateError?.message ?? "unknown error"}`,
          },
        });
      }

      const origin = new URL(req.url).origin;
      const syncRes = await fetch(`${origin}/api/sync-card/${userId}`, {
        method: "POST",
      });

      const syncJson = await syncRes.json();

      if (!syncRes.ok || !syncJson.ok) {
        return json({
          type: 4,
          data: {
            content: `画像更新に失敗しました: ${syncJson.error ?? "unknown error"}`,
          },
        });
      }

      const liveCardUrl =
        "https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live/" +
        `${userId}.png`;

      return json({
        type: 4,
        data: {
          content:
            `更新しました。\n` +
            `ID: ${updatedUser.user_id}\n` +
            `氏名: ${updatedUser.name ?? "未登録"}\n` +
            `スタンプ数: ${updatedUser.stamp_count}\n` +
            `カードURL: ${liveCardUrl}`,
        },
      });
    } catch (error) {
      return json({
        type: 4,
        data: {
          content:
            error instanceof Error
              ? `エラー: ${error.message}`
              : "不明なエラーが発生しました。",
        },
      });
    }
  }

  return new Response("Unhandled interaction type", { status: 400 });
}