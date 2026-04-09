import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      .select("user_id, stamp_count")
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

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("stamp-images")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return new Response(`Image not found: ${filePath}`, { status: 404 });
    }

    const arrayBuffer = await fileData.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="card.png"',
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("route error:", error);
    return new Response(
      `Failed to return image: ${error instanceof Error ? error.message : String(error)}`,
      { status: 500 }
    );
  }
}