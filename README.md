# Bistro Bambi

Next.js / Supabase / Vercel の店舗・スタンプ・ハンティング管理アプリ。

更新と定期実行の設定は [docs/UPDATE-v3.md](docs/UPDATE-v3.md) を参照してください。

- `app`：画面とAPI
- `components`：共通画面部品
- `lib`：データアクセス、画像生成、共通配色
- `public`：フォントと画像
- `tools`：定期画像更新と旧テストファイルの整理
- `.github/workflows`：毎日19:50（日本時間）の画像更新

既存の `.env.local` と `scripts` はそのまま利用します。この更新パッケージには含まれません。
