import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const WIDTH = 1200;
const HEIGHT = 1280;
const MAX_NAME_LENGTH = 12;

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
    .composite([{ input: textMask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function buildBoardSvg(cells) {
  const boardX = 70;
  const boardY = 180;
  const gap = 16;
  const cellSize = 188;
  const radius = 20;

  const cellRects = cells
    .map((cell) => {
      const col = Number(cell.col_index) - 1;
      const row = Number(cell.row_index) - 1;
      const x = boardX + col * (cellSize + gap);
      const y = boardY + row * (cellSize + gap);
      const number = String(cell.number ?? "");
      const isMarked = Boolean(cell.is_marked);
      const showNumber = !isMarked || !cell.image_path;

      return `
        <g>
          <rect
            x="${x}"
            y="${y}"
            width="${cellSize}"
            height="${cellSize}"
            rx="${radius}"
            ry="${radius}"
            fill="${isMarked ? "#fde8e1" : "#ffffff"}"
            stroke="#efc9bf"
            stroke-width="4"
          />
          ${
            isMarked
              ? `
            <rect
              x="${x + 16}"
              y="${y + 16}"
              width="${cellSize - 32}"
              height="${cellSize - 32}"
              rx="16"
              ry="16"
              fill="none"
              stroke="#d98b7b"
              stroke-width="7"
            />
          `
              : ""
          }
          ${
            showNumber
              ? `
            <text
              x="${x + cellSize / 2}"
              y="${y + cellSize / 2 + 18}"
              text-anchor="middle"
              font-size="54"
              font-weight="800"
              fill="#7a4b3a"
            >
              ${number}
            </text>
          `
              : ""
          }
        </g>
      `;
    })
    .join("");

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#fffaf8" />
      ${cellRects}
    </svg>
  `;
}

function getCellLayout(cell) {
  const boardX = 70;
  const boardY = 180;
  const gap = 16;
  const cellSize = 188;

  const col = Number(cell.col_index) - 1;
  const row = Number(cell.row_index) - 1;

  return {
    x: boardX + col * (cellSize + gap),
    y: boardY + row * (cellSize + gap),
    cellSize,
  };
}

function normalizeImageUrl(imagePath, supabaseUrl) {
  if (!imagePath) return null;

  const value = String(imagePath).trim();
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const normalized = value.replace(/^\/+/, "");

  return `${supabaseUrl}/storage/v1/object/public/stamp-images/${normalized}`;
}

async function fetchImageBuffer(imageUrl) {
  const res = await fetch(imageUrl, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function createFittedImage(buffer, size, fitMode = "contain") {
  const fit = fitMode === "cover" ? "cover" : "contain";

  const image = sharp(buffer).rotate();

  if (fit === "cover") {
    return await image
      .resize(size, size, {
        fit: "cover",
        position: "centre",
      })
      .png()
      .toBuffer();
  }

  return await image
    .resize(size, size, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
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
      .from("v_bingo_cards_current")
      .select("*")
      .eq("user_id", userId)
      .eq("program_code", "bingo_regular")
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
        { ok: false, error: `Bingo card not found: ${userId}` },
        { status: 404 }
      );
    }

    const { data: cells, error: cellsError } = await supabase
      .from("bingo_card_cells")
      .select("bingo_cell_id, cell_index, row_index, col_index, number, is_marked")
      .eq("card_id", card.card_id)
      .order("cell_index", { ascending: true });

    if (cellsError || !cells) {
      return Response.json(
        { ok: false, error: cellsError?.message || "Bingo cells not found" },
        { status: 500 }
      );
    }

    const markedNumbers = cells
      .filter((cell) => Boolean(cell.is_marked))
      .map((cell) => Number(cell.number))
      .filter((num) => Number.isFinite(num));

    let mappingByNumber = new Map();

    if (markedNumbers.length > 0) {
      const { data: program, error: programError } = await supabase
        .from("card_programs")
        .select("program_id")
        .eq("code", "bingo_regular")
        .maybeSingle();

      if (programError) {
        return Response.json(
          { ok: false, error: programError.message },
          { status: 500 }
        );
      }

      if (program?.program_id) {
        const { data: mappings, error: mappingsError } = await supabase
          .from("bingo_product_mappings")
          .select("bingo_number, image_path, image_fit")
          .eq("program_id", program.program_id)
          .eq("is_active", true)
          .in("bingo_number", markedNumbers);

        if (mappingsError) {
          return Response.json(
            { ok: false, error: mappingsError.message },
            { status: 500 }
          );
        }

        mappingByNumber = new Map(
          (mappings ?? []).map((mapping) => [Number(mapping.bingo_number), mapping])
        );
      }
    }

    const mergedCells = cells.map((cell) => {
      const mapping = mappingByNumber.get(Number(cell.number));
      return {
        ...cell,
        image_path: mapping?.image_path ?? null,
        image_fit: mapping?.image_fit ?? "contain",
      };
    });

    const baseSvg = buildBoardSvg(mergedCells);
    const baseImage = sharp(Buffer.from(baseSvg));

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

    const titleTextImage = await makeColoredTextImage({
      text: "BINGO CARD",
      font: "Rounded-X M+ 1p",
      fontfile: fontPath,
      width: 420,
      dpi: 180,
      color: textColor,
    });

    const titleShadowImage = await makeColoredTextImage({
      text: "BINGO CARD",
      font: "Rounded-X M+ 1p",
      fontfile: fontPath,
      width: 420,
      dpi: 180,
      color: shadowColor,
    });

    const composites = [
      { input: titleShadowImage, left: 73, top: 28 },
      { input: titleTextImage, left: 70, top: 25 },

      { input: nameShadowImage, left: 73, top: 85 },
      { input: nameTextImage, left: 70, top: 82 },

      { input: idShadowImage, left: 865, top: 40 },
      { input: idTextImage, left: 862, top: 37 },
    ];

    for (const cell of mergedCells) {
      if (!cell.is_marked || !cell.image_path) continue;

      try {
        const imageUrl = normalizeImageUrl(cell.image_path, supabaseUrl);
        if (!imageUrl) continue;

        const sourceBuffer = await fetchImageBuffer(imageUrl);
        const fittedBuffer = await createFittedImage(
          sourceBuffer,
          124,
          cell.image_fit
        );

        const { x, y, cellSize } = getCellLayout(cell);
        const imageSize = 124;
        const imageLeft = Math.round(x + (cellSize - imageSize) / 2);
        const imageTop = Math.round(y + (cellSize - imageSize) / 2);

        composites.push({
          input: fittedBuffer,
          left: imageLeft,
          top: imageTop,
        });
      } catch {
        // 画像取得に失敗した場合は、数字なし・画像なしのままにする
      }
    }

    const resultBuffer = await baseImage
      .composite(composites)
      .png()
      .toBuffer();

    const targetPath = `live-bingo/${userId}.png`;

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