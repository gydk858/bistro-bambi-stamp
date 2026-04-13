import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_NAME_LENGTH = 12;
const STAMP_PROGRAM_CODE = "stamp_regular";

function clampStampCount(value) {
  return Math.max(0, Math.min(10, Number(value ?? 0)));
}

async function makeColoredTextImage({
  text,
  font,
  fontfile,
  width,
  dpi,
  align = "left",
  color = "#000000",
}) {
  const textMask = await sharp({
    text: {
      text,
      font,
      fontfile,
      width,
      rgba: true,
      dpi,
      align,
    },
  })
    .png()
    .ensureAlpha()
    .toBuffer();

  const meta = await sharp(textMask).metadata();
  const w = meta.width ?? width;
  const h = meta.height ?? 60;

  const colorImage = await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();

  return await sharp(colorImage)
    .composite([
      {
        input: textMask,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
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

    const { data: card, error: cardError } = await supabase
      .from("v_stamp_cards_current")
      .select("*")
      .eq("user_id", userId)
      .eq("program_code", STAMP_PROGRAM_CODE)
      .eq("card_status", "active")
      .maybeSingle();

    if (cardError) {
      return Response.json(
        { ok: false, error: cardError.message },
        { status: 500 }
      );
    }

    if (!card) {
      return Response.json(
        { ok: false, error: `Stamp card not found: ${userId}` },
        { status: 404 }
      );
    }

    const stampCount = clampStampCount(card.current_count);
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
    const baseImage = sharp(sourceBuffer);

    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "rounded-x-mplus-1p-medium.ttf"
    );

    await readFile(fontPath);

    const displayNameRaw = card.display_name
      ? String(card.display_name)
      : "未登録";
    const displayName = `${displayNameRaw.slice(0, MAX_NAME_LENGTH)} 様`;
    const displayId = `No. ${String(card.user_id ?? userId)}`;

    const textColor = "#764735";
    const shadowColor = "#fff8f5";

    const nameTextImage = await makeColoredTextImage({
      text: displayName,
      font: "Rounded-X M+ 1p",
      fontfile: fontPath,
      width: 560,
      dpi: 170,
      color: textColor,
    });

    const nameShadowImage = await makeColoredTextImage({
      text: displayName,
      font: "Rounded-X M+ 1p",
      fontfile: fontPath,
      width: 560,
      dpi: 170,
      color: shadowColor,
    });

    const idTextImage = await makeColoredTextImage({
      text: displayId,
      font: "Rounded-X M+ 1p",
      fontfile: fontPath,
      width: 260,
      dpi: 170,
      align: "right",
      color: textColor,
    });

    const idShadowImage = await makeColoredTextImage({
      text: displayId,
      font: "Rounded-X M+ 1p",
      fontfile: fontPath,
      width: 260,
      dpi: 170,
      align: "right",
      color: shadowColor,
    });

    const resultBuffer = await baseImage
      .composite([
        { input: nameShadowImage, left: 87, top: 26 },
        { input: nameTextImage, left: 85, top: 24 },

        { input: idShadowImage, left: 917, top: 26 },
        { input: idTextImage, left: 915, top: 24 },
      ])
      .png()
      .toBuffer();

    const { error: uploadError } = await supabase.storage
      .from("stamp-images")
      .upload(targetPath, resultBuffer, {
        cacheControl: "1",
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
      cardId: card.card_id,
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