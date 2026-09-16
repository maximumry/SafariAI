# Komorebi — Safari AI

読む、その先へ。Safariのページ右側に開く、日本語のAIアシスタントです。

Apple Intelligenceによるオンデバイス処理と、OpenAI・Claude・Gemini・OpenAI互換APIを選べます。

このMacには `/Applications/Komorebi.app` としてインストールし、Safariで有効化済みです。ページ上の要約が実際に動くことを確認しました。クラウド接続はAPIキーとモデルIDの登録後に利用できます。

## 最初に使う

1. 同梱の `Komorebi.app` を開きます。継続利用する場合はアプリケーションフォルダに移動してください。
2. Safariの「設定 → 機能拡張」で **Komorebi** を有効にします。
3. 通常のWebページを開き、ツールバーのKomorebiをクリックします。サイトへのアクセス確認が出たら、そのページに許可します。
4. パネル右上の歯車からAI接続を設定します。Apple IntelligenceはAPIキー不要です。
5. クラウドを使う場合は、接続先・利用可能なモデルID・そのサービスのAPIキーを保存します。「保存済みの接続をテスト」で確認し、パネルのモデル選択で切り替えてください。

### この開発用ビルドがSafariに表示されない場合

同梱アプリはこのMac用のローカル署名（ad hoc）です。Developer ID署名・公証・App Store配布は行っていません。

Safariの「設定 → 詳細」でWebデベロッパ用の機能を表示し、「設定 → デベロッパ」の **署名されていない機能拡張を許可** を有効にすると開発用拡張を読み込めます。Safariのバージョンによっては「開発」メニュー内にあります。Macの認証を求められる場合はご自身で行ってください。Safari再起動後に再設定が必要な場合があります。

継続的に利用する場合は、Xcodeプロジェクトのアプリ・拡張の両ターゲットで、自分のTeamと自動署名を設定してビルドしてください。

Apple公式: [Safari Web Extensionを実行する](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)

## できること

- ページ要約、選択部分の解説、学習用の確認問題、自由な質問
- 本文／選択範囲のみ／ページ情報なし、の切替
- 参照するページ情報の確認、抽出内容の更新
- タブ内の会話、回答と会話全体のコピー、会話消去
- 見出し・箇条書き・太字・コードの安全なMarkdown表示
- ライト／ダーク表示、キーボード操作、読み上げ用のラベル
- 日本語の認証エラー、利用上限、タイムアウト案内

Safari本体のサイドバーではなく、ページ上に重ねて表示するパネルです。ページの横幅やスタイルを変更しません。閉じると同じページの会話は保持されます。ページの再読み込みや通常の画面遷移では消えます。モデル変更時も会話は消去します。

## クラウド設定

| 接続先 | 実装するAPI | 設定するもの |
|---|---|---|
| OpenAI | `/v1/responses` | APIキー、モデルID |
| Claude | `/v1/messages` | Anthropic APIキー、モデルID |
| Gemini | `/v1beta/openai/chat/completions` | Gemini APIキー、モデルID |
| OpenAI互換 | ベースURL + `/chat/completions` | HTTPSベースURL、APIキー、モデルID |

モデルIDはご自身のAPIアカウントで利用可能なものを入力してください。固定されたモデル一覧は持たず、モデルの追加や変更に対応できます。OpenAI互換のすべてのサービス・モデルのオプション差分までは保証しません。HTTPやローカルの認証なしAPIは現バージョンの対象外です。

API利用は各社との契約・料金に従います。接続テストも短いAI生成リクエストを送ります。APIキーはこのチャットに送らず、アプリの設定画面に入力してください。

## データの扱い

- 初期状態はオンデバイス。自動的にクラウドへフォールバックしません。
- `activeTab` によるユーザー操作時のページアクセスです。全サイトへの恒常的な読み取り権限は要求しません。
- キーはネイティブ拡張からmacOSキーチェーンに保存。Webページ・パネル・設定の読み戻し・ログにはキーを渡しません。
- API通信はSwiftから直接行い、HTTPSのみ許可します。HTTPリダイレクトには追従しません。カスタム接続先を変えた場合、キーを別の接続先へ引き継ぎません。
- ページ本文・質問・回答・APIキーをアプリのログに記録しません。テレメトリーはありません。
- URLのクエリ、フラグメント、埋め込み認証情報を除去します。フォーム、入力欄、非表示要素などは本文抽出から除外します。表示された本文に含まれる個人情報を完全に判定・除去する機能ではありません。
- 「ページを送らない」は現在のページ情報の送信を除外します。直近の会話には以前のページに基づく回答が含まれる可能性があります。履歴も除外するには「会話を消去」を使ってください。
- クラウドには質問、指定したページ情報、直近最大8メッセージを送ります。OpenAIは `store:false`。各サービス側の保持・学習ポリシーは各社の契約に従います。
- 会話はパネルのメモリだけに保持。コピー操作を除き、会話ファイルやブラウザの永続ストレージには保存しません。
- ページを信頼できない資料としてモデルに渡し、回答からHTML・スクリプト・外部画像を実行しません。モデルに外部操作ツールは与えていません。

## 制限

- Apple Intelligenceは対応Mac、macOS 26以降、有効化とモデル準備が必要です。
- Foundation Modelsの文脈容量に合わせ、本文・選択範囲・会話を短くして渡します。長い文書全体の網羅的分析にはクラウドや選択範囲を利用してください。
- 抽出は先頭最大24,000文字。クラウド側でもUTF-8バイト数を制限します。末尾が重要な場合は選択してください。
- 参照情報のプレビューは抽出時の内容です。ネイティブ側でさらに抜粋した場合は回答後に表示します。
- HTMLの可視テキストが対象です。PDF、画像の文字、動画、閉じたShadow DOM、別フレームの本文は読み取りません。
- Safariの内部ページ・一部の保護ページ・厳しいサイトポリシーのページでは開けない場合があります。
- 応答は完成後にまとめて表示します。ストリーミング、生成中断、永続履歴、画像入力は未実装です。
- 最低OSの設定はmacOS 14（クラウド）。実機検証環境はmacOS 27 / Apple Silicon / Xcode 27です。古いOSは未検証です。

## 開発

`Komorebi/Komorebi.xcodeproj` をXcodeで開きます。拡張のフロントエンドにパッケージ依存はありません。

```sh
./scripts/build.sh --open
./scripts/test.sh
```

`DEVELOPER_DIR` でXcodeの場所、`KOMOREBI_BUILD_DIR` でビルド場所を上書きできます。Finderの同期メタデータが署名を妨げる場合があるため、既定では一時ディレクトリでビルドします。

ブラウザテストはPlaywright 1.55.0とGoogle Chromeを使います。`Extension` を `127.0.0.1:8765` で配信し、`node tests/browser.test.cjs` を実行します。Safari実機テストとは別のUI・抽出ロジックのテストです。

```text
Extension/                      HTML・CSS・JavaScript
Komorebi/Komorebi/               Macの起動案内アプリ
Komorebi/Komorebi Extension/
  SafariWebExtensionHandler.swift   Native Messagingの入口
  Native/Models.swift              型・検証・プロンプトの容量制御
  Native/SettingsStore.swift       設定・キーチェーン
  Native/CloudClient.swift         4種類のクラウド接続
  Native/AIService.swift           オンデバイス／クラウドの切替
```

## 参照仕様

- [Apple: Native Messaging](https://developer.apple.com/documentation/safariservices/messaging-between-the-app-and-javascript-in-a-safari-web-extension)
- [Apple: Foundation Modelsの文脈容量](https://developer.apple.com/documentation/foundationmodels/managing-the-context-window)
- [OpenAI: テキスト生成](https://developers.openai.com/api/docs/guides/text)
- [Anthropic: Messages API](https://platform.claude.com/docs/en/api/messages/create)
- [Google: OpenAI互換API](https://ai.google.dev/gemini-api/docs/openai)
