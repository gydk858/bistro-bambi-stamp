import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 文字表示位置はここで調整できます
const NAME_X = 70;
const NAME_Y = 60;
const NAME_FONT_SIZE = 34;

const ID_X = 860;
const ID_Y = 60;
const ID_FONT_SIZE = 26;

// 表示名が長すぎると崩れるので必要に応じて調整
const MAX_NAME_LENGTH = 12;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req, context) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { ok: false, error: "Supabase env is missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id } = await context.params;
    const userId = Number(user_id);

    if (!Number.isFinite(userId)) {
      return Response.json(
        { ok: false, error: `Invalid user_id: ${user_id}` },
        { status: 400 }
      );
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("user_id, name, stamp_count")
      .eq("user_id", userId)
      .maybeSingle();

    if (userError) {
      return Response.json(
        { ok: false, error: userError.message },
        { status: 500 }
      );
    }

    if (!user) {
      return Response.json(
        { ok: false, error: `User not found: ${userId}` },
        { status: 404 }
      );
    }

    const stampCount = Math.max(0, Math.min(10, Number(user.stamp_count ?? 0)));
    const sourcePath = `cards/${stampCount}.png`;
    const targetPath = `live/${userId}.png`;

    const { data: sourceFile, error: downloadError } = await supabase.storage
      .from("stamp-images")
      .download(sourcePath);

    if (downloadError || !sourceFile) {
      return Response.json(
        { ok: false, error: `Source image not found: ${sourcePath}` },
        { status: 404 }
      );
    }

    const sourceBuffer = Buffer.from(await sourceFile.arrayBuffer());

    const image = sharp(sourceBuffer);
    const metadata = await image.metadata();

    const width = metadata.width ?? 1075;
    const height = metadata.height ?? 650;

    const displayNameRaw = user.name ? String(user.name) : "未登録";
    const displayName = escapeXml(displayNameRaw.slice(0, MAX_NAME_LENGTH));
    const displayId = escapeXml(String(user.user_id ?? userId));

    const overlaySvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .name {
            font-size: ${NAME_FONT_SIZE}px;
            font-weight: 700;
            fill: #7b4b3a;
            font-family: sans-serif;
          }
          .id {
            font-size: ${ID_FONT_SIZE}px;
            font-weight: 700;
            fill: #7b4b3a;
            font-family: sans-serif;
          }
        </style>

        <text x="${NAME_X}" y="${NAME_Y}" class="name">${displayName}</text>
        <text x="${ID_X}" y="${ID_Y}" class="id">ID: ${displayId}</text>
      </svg>
    `;

    const resultBuffer = await image
      .composite([
        {
          input: Buffer.from(overlaySvg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    const { error: uploadError } = await supabase.storage
      .from("stamp-images")
      .upload(targetPath, resultBuffer, {
        cacheControl: "60",
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return Response.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("stamp-images")
      .getPublicUrl(targetPath);

    return Response.json({
      ok: true,
      userId,
      stampCount,
      imagePath: targetPath,
      imageUrl: publicUrlData.publicUrl,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}