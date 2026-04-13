const applicationId = process.env.DISCORD_BINGO_APPLICATION_ID;
const botToken = process.env.DISCORD_BINGO_BOT_TOKEN;

if (!applicationId || !botToken) {
  throw new Error(
    "DISCORD_BINGO_APPLICATION_ID または DISCORD_BINGO_BOT_TOKEN が未設定です。"
  );
}

const commands = [
  {
    name: "bingo-create",
    description: "新しいビンゴカードを発行します",
    options: [
      {
        type: 3,
        name: "name",
        description: "作成と同時に名前を登録する場合のみ入力",
        required: false,
      },
    ],
  },
  {
    name: "bingo-panel",
    description: "ビンゴカード操作パネルを表示します",
    options: [
      {
        type: 4,
        name: "id",
        description: "カード番号",
        required: true,
      },
    ],
  },
];

async function main() {
  const res = await fetch(
    `https://discord.com/api/v10/applications/${applicationId}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
        "User-Agent": "BistroBambiBingoBot/1.0",
      },
      body: JSON.stringify(commands),
    }
  );

  const json = await res.json();

  if (!res.ok) {
    console.error(json);
    throw new Error("ビンゴコマンド登録に失敗しました。");
  }

  console.log(
    "登録成功:",
    Array.isArray(json) ? json.map((cmd) => cmd.name).join(", ") : json
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});