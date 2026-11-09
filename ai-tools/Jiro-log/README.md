# Jirō Log

写真からはじめる、身内向けのラーメン手帳。React / TypeScript / Vite / Supabase。
[設計書](DESIGN.md)の **Phase 0・1** を実装しています。

## 起動

Node.js 22.12以上（24でも確認済み）。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

http://127.0.0.1:5173/ai-tools/Jiro-log/ を開きます。
環境変数が空の場合はプレビューになります。画像選択・圧縮と画面遷移を試せますが、データは保存・送信しません。サンプルの食事ログは生成しません。

```sh
npm test
npm run build
npm run preview
```

## Supabaseの初期設定

1. Supabaseプロジェクトを作成。
2. SQL Editorで `supabase/migrations/202609080001_phase1.sql` を一度実行。members / shops / visits / photos、RLS、非公開 `jiro-photos` バケットを作ります。既存テーブル・同名バケットのないプロジェクトを対象にしています。CLIのmigration管理を使う場合は同ファイルを `supabase db push` で適用します。
3. `.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` を設定し開発サーバーを再起動。Secret Key / service_role は置かないでください。
4. Authでメール＋パスワード認証を有効にし、Dashboardから確認済みユーザーを作成します。Phase 1はパスワードでのログインのみ実装し、招待メールからのパスワード設定・パスワード再設定画面は未実装です。
5. SQL Editorで対応するAuth UUIDを `members` に登録します。

```sql
insert into public.members(user_id, display_name, role)
values ('AUTHのユーザーUUID', '表示名', 'admin');
-- 他の利用者は role = 'member' で追加。
```

6. Authの新規登録（Allow new users to sign up）とAnonymous Sign-inを無効化。
7. ログインして写真だけの保存 → 再読み込み → メモ追記を確認。

membersがない・無効化されているアカウントは利用できません。相互閲覧、本人のみ更新・削除、adminによる管理をRLSで制御します。一般メンバーの店舗操作は追加のみです。メンバー管理画面は未実装なのでDashboard / SQL Editorで管理してください。

## 実装済み

- `/ai-tools/Jiro-log/` base path、Hash Router、スマートフォン向けUI
- セッション保持・更新、membersの有効性確認、新規登録のないログイン画面
- 写真撮影／ライブラリ選択、長辺1600px・WebP圧縮（JPEGフォールバック）
- 写真または日時のみで下書き作成。メモ追記、直近100件の一覧・下書き絞り込み・店舗／メモ検索
- UUID固定の未送信キュー。送信前にIndexedDBへ退避、起動・画面復帰・オンライン復帰・手動操作で再送
- 途中失敗はキューに残し、再送時に既存行を上書きしない。画像パス固定でアップロードを再試行
- ユーザーごとにキューを分離。ログアウト時も未送信分は残し、同じアカウントでのみ再送
- private Storageから認証付きで画像取得。ログアウト・画面離脱でBlob URLを解放
- manifest、PNGアイコン、アプリシェルのみのService Workerキャッシュ。入力中に更新のための強制リロードはしない
- PostgreSQLエンジン（PGlite）によるRLSとStorage policyのテスト、IndexedDB再送テスト

## 今回の範囲と制限

Phase 2以降の店舗編集UI、注文・コール・食後評価、completed判定、複製・削除UI、分析、CSV/JSON出力、写真バックアップは未実装です。orders / outcomes等のテーブルもPhase 2で追加します。現時点では全ログが下書きになります。

IndexedDBは未送信分だけを保持し、正式な保存先はSupabaseです。初回起動／新規ログインはオンライン接続が必要です。ログイン復元時にメンバー確認ができない場合はアクセスを開放せず、接続してから再試行します。完全なオフライン閲覧・新規入力には対応していません。ログイン済みで開いた画面からの保存失敗は退避できます。メモ更新に失敗した場合は入力を画面に保持して再試行できますが、メモ編集の永続キューはPhase 3の拡張対象です。

未送信写真がある間は、Safariのサイトデータを消さないでください。別の端末からは送信済みデータだけを表示します。最大30MBの入力画像、圧縮後5MB以下。0.3〜0.8MBは目標であり画像内容により変わります。HEIC等をブラウザがデコードできない場合はJPEG/PNGへの変更を案内します。EXIF向きはブラウザの画像デコードを利用し、Canvasでメタデータを除去します。

一覧は直近100件に限定しています（表示数もその範囲）。詳細も同じ取得範囲に含まれる記録が対象です。ページング、専用詳細取得、軽量サムネイルはPhase 2以降で追加します。

実Supabaseへのログイン／アップロード、iPhone実機のEXIF／HEIC／ホーム画面起動、ネットワーク遮断下の実サービス連携は、プロジェクト設定後に受け入れ確認が必要です。自動テストはSupabase管理のauth/storageスキーマを最小限模倣し、実PostgreSQLのRLSを評価します。Storage HTTP API自体は模擬していません。

## 既存サイトを保った公開

2026-09-08にGitHub APIで確認した現在の設定：

- リポジトリ：`nyanmodel/nyanmodel.github.io`
- Pages：**legacy / master ブランチ / ルート**
- 独自ドメイン：`nyanmodel.com`（ルートCNAME）
- 既存の `.github/workflows` はなし

現在のブランチ公開方式では、Reactのソースをpushするだけでは動きません。**今回、Pages設定や既存サイトのファイルは変更していません。**

公開時は `docs/github-pages.yml` をリポジトリ直下の `.github/workflows/pages.yml` に配置し、Settings → Pages → Sourceを **GitHub Actions** に切り替えます。Repository variablesに上記2つの公開環境変数を設定します。ワークフローは既存サイト全体（CNAMEを含む）を成果物にコピーし、`ai-tools/Jiro-log/` だけをViteのdistで置き換える構成です。Jirō Logのdistだけをサイト全体としてデプロイしないでください。

独自ドメインでのパスは `https://nyanmodel.com/ai-tools/Jiro-log/` になります。設計書のgithub.io URLからは既存ドメイン設定に従います。PagesのHTTPSを有効化して運用してください。カメラ・PWAにはHTTPS（開発時はlocalhost）が必要です。

## 次の開発へ

- 行型：`src/types/database.ts`（Phase 1で利用する列）。DB接続後はSupabase CLIの `gen types typescript` で全DB型を生成し、クライアントの型付けを強化。
- ドメイン型：`src/types/domain.ts`。変換と通信は `src/features/visits/api.ts`。
- 認証：`src/features/auth/AuthProvider.tsx`。画面：`src/app/App.tsx`。
- 未送信キュー：`src/lib/offlineQueue.ts`。圧縮：`src/lib/image.ts`。
- 次はPhase 2のテーブルとフォームをfeature単位で追加し、completed条件を確定。

参照：[Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)、[Vite PWA](https://vite-pwa-org.netlify.app/guide/)。
