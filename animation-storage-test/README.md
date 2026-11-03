# Supabase直接URLによるアニメーション確認

既存スタンプと同じSupabase Storageの公開オブジェクトURLで、前回と同じ4画像を比較します。
新規のテスト用バケットbambi-animation-testを使用します。既存バケット・カード・DBテーブル・アプリのソースは変更しません。

## 実行

1. ZIP内のanimation-storage-testフォルダを、既存アプリのルート（package.jsonと同じ階層）へコピーしてください。
2. アプリのルートでターミナルを開き、次を実行してください。

```bat
node --env-file=.env.local animation-storage-test/upload.mjs
```

例：C:\Users\gydk8\GTA5\stamp-card-app で実行します。
Node.js 20.12以降を使用してください。既存アプリの@supabase/supabase-jsを使うため、追加パッケージは不要です。
.env.localには既存のNEXT_PUBLIC_SUPABASE_URLとSUPABASE_SERVICE_ROLE_KEYが必要です。Vercelにのみ設定している場合は、同じ値をローカルの.env.localへ設定してください。秘密キーをチャットへ送ったりGitへコミットしたりする必要はありません。
この作業にgit push・Vercel再デプロイ・SQL実行は不要です。

## 実行内容

- テスト専用の公開バケットを、存在しない場合のみ作成します。
- 4画像を変換せずアップロードします。cacheControlは既存スタンプと同じ'0'です。
- 毎回新しいフォルダへ配置するため、既存画像は上書きしません。
- PNGとAPNGはimage/png、GIFはimage/gifで保存します。test.pngとtest.apngは内容・Content-Typeが同一で拡張子のみ異なります。
- ログイン情報を付けずに各URLを2回取得し、元のファイルと一致するか検証します。
- URLと検証結果は画面とurls-識別子.jsonに出力します。秘密キーは出力しません。
- 実行途中で失敗した場合、すでにアップロードした画像は残ります。再実行しても新しいフォルダになるため上書きしません。

## GTAでの確認順序

1. 出力されたstill.pngのSupabase URLで新しく印刷します。前回のVercel URLのアイテムは使いません。
2. 閉じてすぐ開く操作を3〜5回繰り返します。
3. 静止画が安定したら、test.gif、test.png、test.apngをそれぞれ別に印刷します。
4. 開いたまま5〜10秒待ち、数字1〜8とオレンジ色の丸が動くか確認します。
5. 各形式でも閉じてすぐ開く操作を3〜5回繰り返します。

報告用：
- still.png：連続表示できた／できなかった
- test.gif：動く／静止／読み込み失敗、連続表示できた／できなかった
- test.png：動く／静止／読み込み失敗、連続表示できた／できなかった
- test.apng：動く／静止／読み込み失敗、連続表示できた／できなかった

ローカルの直接取得成功はGTA内での成功を保証しません。静止画が失敗する場合はまず配信経路を調べ、形式の非対応と決めつけません。
キャッシュ設定を0にしても配信側・GTA側のキャッシュすべてを消去するわけではありません。
このテストは表示互換性を確認するためのものです。同じURLの画像差し替えや、名前・スタンプのアニメーション合成は別途検証が必要です。

## 後片付け

確認後に不要ならSupabaseのStorage画面でbambi-animation-test内の該当テストフォルダを削除できます。既存スタンプ用バケットは削除しないでください。

参考：Supabase公式Storageドキュメント
https://supabase.com/docs/guides/storage/uploads/standard-uploads
