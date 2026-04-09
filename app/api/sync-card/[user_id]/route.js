import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      .select("user_id, stamp_count")
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

    const { error: updateError } = await supabase.storage
      .from("stamp-images")
      .update(targetPath, sourceFile, {
        cacheControl: "60",
        contentType: "image/png",
        upsert: true,
      });

    if (updateError) {
      const { error: uploadError } = await supabase.storage
        .from("stamp-images")
        .upload(targetPath, sourceFile, {
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