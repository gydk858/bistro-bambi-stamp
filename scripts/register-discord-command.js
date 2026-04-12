const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!applicationId || !botToken) {
  throw new Error("DISCORD_APPLICATION_ID または DISCORD_BOT_TOKEN が未設定です。");
}

const commands = [
  {
    name: "stamp",
    description: "スタンプカードを更新します",
    options: [
      {
        type: 4,
        name: "id",
        description: "カード番号",
        required: true,
      },
      {
        type: 3,
        name: "action",
        description: "add か remove",
        required: true,
        choices: [
          { name: "add", value: "add" },
          { name: "remove", value: "remove" },
        ],
      },
      {
        type: 3,
        name: "name",
        description: "名前を同時に登録・更新する場合のみ入力",
        required: false,
      },
    ],
  },
  {
    name: "panel",
    description: "スタンプカード操作パネルを表示します",
    options: [
      {
        type: 4,
        name: "id",
        description: "カード番号",
        required: true,
      },
    ],
  },
  {
    name: "create",
    description: "新しいスタンプカードを発行します",
    options: [
      {
        type: 3,
        name: "name",
        description: "作成と同時に名前を登録する場合のみ入力",
        required: false,
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
      },
      body: JSON.stringify(commands),
    }
  );

  const json = await res.json();

  if (!res.ok) {
    console.error(json);
    throw new Error("コマンド登録に失敗しました。");
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