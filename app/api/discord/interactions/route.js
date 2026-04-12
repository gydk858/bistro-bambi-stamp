import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

async function editOriginalResponse(applicationId, interactionToken, content) {
  const res = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord edit failed: ${text}`);
  }
}

export async function POST(req) {
  const rawBody = await req.text();

  const isValid = await verifyDiscordRequest(req, rawBody);
  if (!isValid) {
    return new Response("Invalid request signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // PING
  if (body.type === 1) {
    return Response.json({ type: 1 });
  }

  // Slash Command
  if (body.type !== 2) {
    return new Response("Unhandled interaction type", { status: 400 });
  }

  const commandName = body.data?.name;
  if (commandName !== "stamp") {
    return Response.json({
      type: 4,
      data: {
        content: "未対応のコマンドです。",
      },
    });
  }

  const interactionId = body.id;
  const interactionToken = body.token;
  const applicationId = body.application_id;

  try {
    // まず 3 秒以内に defer を返す
    await sendDeferredResponse(interactionId, interactionToken);

    const options = body.data?.options ?? [];
    const userId = Number(getOptionValue(options, "id"));
    const action = getOptionValue(options, "action");
    const name = getOptionValue(options, "name");

    if (!Number.isFinite(userId)) {
      await editOriginalResponse(
        applicationId,
        interactionToken,
        "ID が不正です。"
      );
      return new Response(null, { status: 202 });
    }

    if (!["add", "remove"].includes(action)) {
      await editOriginalResponse(
        applicationId,
        interactionToken,
        "action は add か remove を指定してください。"
      );
      return new Response(null, { status: 202 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      await editOriginalResponse(
        applicationId,
        interactionToken,
        "Supabase の環境変数が不足しています。"
      );
      return new Response(null, { status: 202 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("user_id, name, stamp_count")
      .eq("user_id", userId)
      .maybeSingle();

    if (userError) {
      await editOriginalResponse(
        applicationId,
        interactionToken,
        `DBエラー: ${userError.message}`
      );
      return new Response(null, { status: 202 });
    }

    if (!user) {
      await editOriginalResponse(
        applicationId,
        interactionToken,
        `ID ${userId} のカードが見つかりません。`
      );
      return new Response(null, { status: 202 });
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
      await editOriginalResponse(
        applicationId,
        interactionToken,
        `更新に失敗しました: ${updateError?.message ?? "unknown error"}`
      );
      return new Response(null, { status: 202 });
    }

    const origin = new URL(req.url).origin;
    const syncRes = await fetch(`${origin}/api/sync-card/${userId}`, {
      method: "POST",
    });
    const syncJson = await syncRes.json();

    if (!syncRes.ok || !syncJson.ok) {
      await editOriginalResponse(
        applicationId,
        interactionToken,
        `画像更新に失敗しました: ${syncJson.error ?? "unknown error"}`
      );
      return new Response(null, { status: 202 });
    }

    const liveCardUrl =
      "https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live/" +
      `${userId}.png`;

    await editOriginalResponse(
      applicationId,
      interactionToken,
      `更新しました。
ID: ${updatedUser.user_id}
氏名: ${updatedUser.name ?? "未登録"}
スタンプ数: ${updatedUser.stamp_count}
カードURL: ${liveCardUrl}`
    );

    return new Response(null, { status: 202 });
  } catch (error) {
    try {
      await editOriginalResponse(
        applicationId,
        interactionToken,
        error instanceof Error
          ? `エラー: ${error.message}`
          : "不明なエラーが発生しました。"
      );
    } catch {
      // ignore
    }

    return new Response(null, { status: 202 });
  }
}