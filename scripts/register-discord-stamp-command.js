const applicationId = process.env.DISCORD_STAMP_APPLICATION_ID;
const botToken = process.env.DISCORD_STAMP_BOT_TOKEN;

if (!applicationId || !botToken) {
  throw new Error(
    "DISCORD_STAMP_APPLICATION_ID または DISCORD_STAMP_BOT_TOKEN が未設定です。"
  );
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
  {
    name: "staff",
    description: "従業員カードの出勤数を更新します",
    options: [
      {
        type: 3,
        name: "code",
        description: "従業員コード（例: Bambi01）",
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
    ],
  },
  {
    name: "staffpanel",
    description: "従業員カード操作パネルを表示します",
    options: [
      {
        type: 3,
        name: "code",
        description: "従業員コード（例: Bambi01）",
        required: true,
      },
    ],
  },
  {
    name: "staffcreate",
    description: "新しい従業員カードを発行します",
    options: [
      {
        type: 3,
        name: "code",
        description: "従業員コード（例: Bambi01）",
        required: true,
      },
      {
        type: 3,
        name: "name",
        description: "作成と同時に氏名を登録する場合のみ入力",
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
        "User-Agent": "BistroBambiStampBot/1.0",
      },
      body: JSON.stringify(commands),
    }
  );

  const json = await res.json();

  if (!res.ok) {
    console.error(json);
    throw new Error("スタンプ / 従業員カード コマンド登録に失敗しました。");
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