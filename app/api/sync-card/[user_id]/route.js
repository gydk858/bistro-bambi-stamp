import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_NAME_LENGTH = 12;

function clampStampCount(value) {
  return Math.max(0, Math.min(10, Number(value ?? 0)));
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

    const stampCount = clampStampCount(user.stamp_count);
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
      "NotoSansJP-Regular.ttf"
    );

    await readFile(fontPath);

    const displayNameRaw = user.name ? String(user.name) : "未登録";
    const displayName = `${displayNameRaw.slice(0, MAX_NAME_LENGTH)} 様`;
    const displayId = `No. ${String(user.user_id ?? userId)}`;

    const commonNameTextOptions = {
      text: displayName,
      font: "Noto Sans JP",
      fontfile: fontPath,
      width: 540,
      rgba: true,
      dpi: 170,
    };

    const commonIdTextOptions = {
      text: displayId,
      font: "Noto Sans JP",
      fontfile: fontPath,
      width: 240,
      rgba: true,
      dpi: 170,
      align: "right",
    };

    const nameTextImage = await sharp({
      text: commonNameTextOptions,
    })
      .png()
      .tint("#8a5e4c")
      .toBuffer();

    const nameShadowImage = await sharp({
      text: commonNameTextOptions,
    })
      .png()
      .tint("#fffdfb")
      .toBuffer();

    const idTextImage = await sharp({
      text: commonIdTextOptions,
    })
      .png()
      .tint("#9a6d59")
      .toBuffer();

    const idShadowImage = await sharp({
      text: commonIdTextOptions,
    })
      .png()
      .tint("#fffdfb")
      .toBuffer();

    const resultBuffer = await baseImage
      .composite([
        // 名前: 少し右へ
        { input: nameShadowImage, left: 76, top: 25 },
        { input: nameTextImage, left: 75, top: 24 },

        // ID: もっと右へ
        { input: idShadowImage, left: 805, top: 25 },
        { input: idTextImage, left: 804, top: 24 },
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