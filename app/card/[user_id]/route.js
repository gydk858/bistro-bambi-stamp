import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// ここは実際の画像を見ながら微調整してください
const CARD_WIDTH = 1075;
const CARD_HEIGHT = 650;

// 名前表示位置
const NAME_LEFT = 120;
const NAME_TOP = 580;
const NAME_FONT_SIZE = 34;

// ID表示位置
const ID_LEFT = 820;
const ID_TOP = 580;
const ID_FONT_SIZE = 28;

export async function GET(req, context) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return new Response("NEXT_PUBLIC_SUPABASE_URL is missing", { status: 500 });
    }

    if (!serviceRoleKey) {
      return new Response("SUPABASE_SERVICE_ROLE_KEY is missing", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id } = await context.params;
    const userId = Number(user_id);

    if (!Number.isFinite(userId)) {
      return new Response(`Invalid user_id: ${user_id}`, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("user_id, name, stamp_count")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Supabase error:", error);
      return new Response(`Supabase error: ${error.message}`, { status: 500 });
    }

    if (!user) {
      return new Response(`User not found: ${userId}`, { status: 404 });
    }

    const stampCount = Math.max(0, Math.min(10, Number(user.stamp_count ?? 0)));
    const filePath = `cards/${stampCount}.png`;

    const { data: publicUrlData } = supabase.storage
      .from("stamp-images")
      .getPublicUrl(filePath);

    const baseImageUrl = publicUrlData?.publicUrl;

    if (!baseImageUrl) {
      return new Response(`Public URL not found: ${filePath}`, { status: 500 });
    }

    const displayName = user.name ?? "";
    const displayId = String(user.user_id ?? userId);

    return new ImageResponse(
      (
        <div
          style={{
            width: `${CARD_WIDTH}px`,
            height: `${CARD_HEIGHT}px`,
            display: "flex",
            position: "relative",
          }}
        >
          <img
            src={baseImageUrl}
            alt="stamp card"
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
            }}
          />

          <div
            style={{
              position: "absolute",
              left: `${NAME_LEFT}px`,
              top: `${NAME_TOP}px`,
              display: "flex",
              fontSize: `${NAME_FONT_SIZE}px`,
              fontWeight: 700,
              color: "#7b4b3a",
              letterSpacing: "1px",
              maxWidth: "520px",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {displayName}
          </div>

          <div
            style={{
              position: "absolute",
              left: `${ID_LEFT}px`,
              top: `${ID_TOP}px`,
              display: "flex",
              fontSize: `${ID_FONT_SIZE}px`,
              fontWeight: 700,
              color: "#7b4b3a",
              letterSpacing: "1px",
            }}
          >
            ID: {displayId}
          </div>
        </div>
      ),
      {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      }
    );
  } catch (error) {
    console.error("route error:", error);
    return new Response(
      `Failed to generate image: ${error instanceof Error ? error.message : String(error)}`,
      { status: 500 }
    );
  }
}