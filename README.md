# 工場稼働計測システム (Factory Operation Tracking System)

工場の機械稼働を「入力方式」で記録・集計するMVPシステムです。
写真ではなく、ボタン操作で稼働開始→停止（理由付き）→再開→終了を記録し、今日の稼働/停止時間を集計表示します。

## 技術スタック

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Frontend**: React + Vite + TypeScript
- **Container**: Docker Compose

## 主な機能

### イベントログ型稼働記録

- 稼働を「イベント」としてDBに保存
- イベントはサーバ時刻で記録（端末時刻は使用しない）
- 状態遷移ルールに従った厳密な状態管理
- **各イベントに作業者名を記録**（途中で作業者交代可能）

### 状態遷移ルール

```
初期 → START_RUN → RUNNING
RUNNING → STOP (reason_code必須) → STOPPED
STOPPED → RESUME → RUNNING
RUNNING/STOPPED → END → ENDED
```

- ENDED後はイベント追加不可（新しいセッションを作成）
- 不正な状態遷移はAPIで拒否

### 3つの画面

1. **機械一覧**: 登録された機械の一覧表示とクリックで詳細画面へ
2. **機械ページ（現場入力画面）**: 大きいボタンで開始/停止/再開/終了を記録
3. **ダッシュボード**: 全機械の稼働/停止時間と停止理由ランキング

## 起動方法

### 前提条件

- Docker および Docker Compose がインストールされていること
- ポート 5432 (PostgreSQL), 3000 (API), 5173 (Web) が空いていること

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd SEISAN
```

### 2. Docker Composeで起動

```bash
docker-compose up --build
```

初回起動時は以下が自動実行されます：

- PostgreSQLデータベース作成
- Prismaマイグレーション実行
- 初期データ（4台の機械）投入

### 3. アクセス

- **フロントエンド**: http://localhost:5173
- **API**: http://localhost:3000
- **ヘルスチェック**: http://localhost:3000/health

### 4. 停止

```bash
docker-compose down
```

データを完全に削除する場合：

```bash
docker-compose down -v
```

## 使い方

### 基本的な操作フロー

1. **機械一覧画面**で機械を選択
2. **機械ページ**で「▶ 開始」ボタンをクリック → 稼働開始
3. 停止する場合は「⏸ 停止」ボタンをクリック（停止理由を選択）
4. 再開する場合は「▶ 再開」ボタンをクリック
5. 作業完了時は「■ 終了」ボタンをクリック
6. **ダッシュボード**で全機械の稼働状況を確認

### 停止理由コード

- **段取り** (SETUP): 段取り作業
- **故障** (FAILURE): 機械故障
- **材料待ち** (MATERIAL): 材料が到着していない
- **品質検査** (QC): 品質検査中
- **その他** (OTHER): その他の理由

### 任意入力項目

- **作業者名**: イベントを記録した作業者の名前
- **メモ**: 自由記述（作業内容など）
- **数量**: 生産数量など

## データベース構成

### テーブル

#### machines（機械マスタ）

| カラム       | 型      | 説明           |
| ------------ | ------- | -------------- |
| id           | uuid    | 主キー         |
| machine_code | string  | 機械コード     |
| name         | string  | 機械名         |
| is_active    | boolean | 有効フラグ     |

#### work_sessions（作業セッション）

| カラム       | 型     | 説明                              |
| ------------ | ------ | --------------------------------- |
| id           | uuid   | 主キー                            |
| date         | date   | 作業日                            |
| shift        | string | シフト（オプション）              |
| machine_id   | uuid   | 機械ID（外部キー）                |
| product_code | string | 製品コード（オプション）          |
| process      | string | 工程（オプション）                |
| status       | enum   | 状態（RUNNING/STOPPED/ENDED）     |

ビジネスロジック制約:
- 同一machine_id + dateでアクティブなセッション（ENDED以外）は1つのみ
- 同じ日に複数のセッションを作成可能（終了後に新規セッション開始可）

#### events（イベントログ）

| カラム        | 型     | 説明                                        |
| ------------- | ------ | ------------------------------------------- |
| id            | uuid   | 主キー                                      |
| session_id    | uuid   | セッションID（外部キー）                    |
| machine_id    | uuid   | 機械ID（外部キー）                          |
| event_type    | enum   | イベント種別（START_RUN/STOP/RESUME/END）   |
| event_time    | timestamp | イベント発生時刻（サーバ時刻）            |
| reason_code   | enum   | 停止理由（STOP時のみ必須）                  |
| operator_name | string | 作業者名（オプション）                      |
| memo          | string | メモ（オプション）                          |
| qty           | int    | 数量（オプション）                          |

## API エンドポイント

### Machines

- `GET /api/machines` - 機械一覧取得
- `POST /api/machines` - 機械登録（初期セットアップ用）
- `GET /api/machines/:machineCode/status?date=YYYY-MM-DD` - 機械の状態取得

### Sessions

- `POST /api/sessions/start` - セッション開始

### Events

- `POST /api/events` - イベント登録（状態遷移チェック付き）

### Dashboard

- `GET /api/dashboard/today?date=YYYY-MM-DD` - ダッシュボードデータ取得

## 集計ロジック

### 稼働時間と停止時間の計算

- **RUN区間**: START_RUN/RESUME 〜 STOP/END
- **STOP区間**: STOP 〜 RESUME/END

イベント間の時刻差分を計算して集計します。

## MVP制約事項

このシステムはMVP（Minimum Viable Product）として以下の制約があります：

### 1. 日跨ぎ非対応

- **制約**: 同日内のイベントのみで集計
- **影響**: 0時を跨いで稼働している場合、正確な集計ができません
- **回避策**: 当日中にセッションを終了してください

### 2. 未完了セッションの集計

- **制約**: ENDイベントが記録されていない継続中の稼働は、最後のイベント時刻までの集計
- **影響**: 現在進行中の稼働区間は集計に含まれません
- **回避策**: 定期的にイベントを記録してください

### 3. イベント欠損時の動作

- **制約**: イベントが記録されていない時間帯は集計できません
- **影響**: 手動記録忘れがあると実態と乖離します
- **回避策**: 確実にイベントを記録する運用ルールを設けてください

### 4. 時刻修正不可

- **制約**: イベント時刻はサーバ時刻で自動記録され、手動修正できません
- **影響**: 記録忘れに後から気づいても修正できません
- **回避策**: リアルタイムで記録する運用を徹底してください

### 5. 既存セッション処理

- **制約**: `/api/sessions/start`で同日のアクティブセッションが存在する場合、既存セッションを返す（409エラーではない）
- **影響**: 重複セッション作成は防げますが、既存セッションが返されます
- **回避策**: 事前に状態確認APIで確認してください

### 6. レスポンシブ最小限

- **制約**: PC/タブレット/スマホで表示可能ですが、UIは最低限
- **影響**: 細かいデザイン調整は未実装
- **回避策**: 必要に応じてCSSをカスタマイズしてください

## 開発環境

### ローカル開発（Docker使用）

```bash
# 開発モード起動（ホットリロード有効）
docker-compose up

# ログ確認
docker-compose logs -f api
docker-compose logs -f web

# コンテナ再ビルド
docker-compose up --build
```

### データベース操作

```bash
# Prisma Studio起動（GUIでDB確認）
cd backend
npx prisma studio

# マイグレーション作成
npx prisma migrate dev --name <migration_name>

# シードデータ再投入
npx prisma db seed
```

## プロジェクト構成

```
SEISAN/
├── backend/              # バックエンド（API）
│   ├── prisma/
│   │   ├── schema.prisma # DBスキーマ定義
│   │   └── seed.ts       # 初期データ
│   ├── src/
│   │   ├── index.ts      # エントリーポイント
│   │   ├── lib/          # Prismaクライアント
│   │   ├── routes/       # APIルート
│   │   └── services/     # ビジネスロジック
│   ├── Dockerfile
│   └── package.json
├── frontend/             # フロントエンド
│   ├── src/
│   │   ├── main.tsx      # エントリーポイント
│   │   ├── App.tsx       # ルーティング
│   │   └── pages/        # 画面コンポーネント
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml    # Docker Compose設定
└── README.md             # このファイル
```

## トラブルシューティング

### ポートが使用中

```bash
# プロセスを確認
lsof -i :5432  # PostgreSQL
lsof -i :3000  # API
lsof -i :5173  # Web

# または別のポートを使用（docker-compose.ymlを編集）
```

### データベース接続エラー

```bash
# コンテナ再起動
docker-compose restart db api

# ログ確認
docker-compose logs db
```

### Prismaマイグレーションエラー

```bash
# データベースリセット（開発環境のみ）
docker-compose down -v
docker-compose up --build
```

## 今後の拡張案

- 日跨ぎ対応
- イベント時刻の手動修正機能
- 複数セッション対応（同日・同機械）
- レポート出力（CSV/PDF）
- リアルタイム更新（WebSocket）
- ユーザー認証
- 権限管理
- モバイルアプリ（PWA）

## ライセンス

MIT

## 開発者

Factory Operation Tracking System MVP
