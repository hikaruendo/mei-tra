# 🏗️ 明専トランプ (Mei-Tra) - システムアーキテクチャ

このドキュメントでは、フロントエンドからバックエンド、データベースまでの全体アーキテクチャを説明します。

## 🔗 全体の依存関係の方向 (Clean Architecture)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         外側 (Infrastructure)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         Frontend (Presentation Layer)                         │  │
│  │         ・Pages, Components, Hooks                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │    WebSocket/REST Client (Communication Layer)               │  │
│  │    ・Socket.IO Client, HTTP Client                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │    Gateways/Controllers (Infrastructure/Presentation Layer)  │  │
│  │    ・GameGateway, SocialGateway, UserProfileController       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           Use Cases (Application Layer)                       │  │
│  │           ・JoinRoomUseCase, PlayCardUseCase                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │             Services (Domain Layer)                           │  │
│  │             ・RoomService, CardService, ChatService           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │      Repository Interfaces (Domain Layer)                    │  │
│  │      ・IRoomRepository, IChatRoomRepository                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                ▲                                     │
│                                │  依存性の逆転                       │
│                                │  (Dependency Inversion)             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Repository Implementations (Infrastructure Layer)           │  │
│  │  ・SupabaseRoomRepository, SupabaseChatRoomRepository        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                ▼                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         Database (External Services Layer)                    │  │
│  │         ・Supabase PostgreSQL                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│                         内側 (Domain)                                │
└─────────────────────────────────────────────────────────────────────┘

依存の方向: 外側 → 内側
内側の層は外側を知らない (Clean Architectureの原則)
```

## 📊 システム全体構成

```
┌─────────────────────────────────────────────────────────────────────┐
│              🌐 Frontend (Presentation Layer)                        │
│                    Next.js / Vercel でホスティング                     │
└─────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│          🔌 WebSocket/REST (Communication Layer)                     │
│            Socket.IO Client / Axios - リアルタイム双方向通信           │
└─────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│     🚀 Backend (Infrastructure/Application/Domain Layers)            │
│         NestJS / Fly.io でホスティング                                │
└─────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│         🗄️ Database (External Services Layer)                        │
│  Supabase PostgreSQL (開発: Local Docker / 本番: Cloud Supabase)     │
└─────────────────────────────────────────────────────────────────────┘
```

## 🎨 Frontend Layer 詳細 (Next.js App Router)

### Presentation Layer (プレゼンテーション層)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          📱 Presentation Layer                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Pages (app/[locale]/page.tsx)                                  │    │
│  │  - ルーティング                                                   │    │
│  │  - SSR/SSG                                                       │    │
│  │  - 国際化 (i18n)                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Components (components/)                                        │    │
│  │  ├─ organisms/  (複合コンポーネント)                             │    │
│  │  ├─ molecules/  (中間コンポーネント)                             │    │
│  │  ├─ GameTable/  (ゲームテーブル表示)                            │    │
│  │  ├─ PlayerHand/ (手札表示)                                       │    │
│  │  ├─ ScoreBoard/ (スコア表示)                                     │    │
│  │  └─ social/     (チャット UI)                                   │    │
│  │                                                                  │    │
│  │  スタイリング: SCSS Modules (.module.scss)                      │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

**責任範囲**:
- UI表示とユーザー入力の受け付け
- SCSS Modulesによるスタイリング
- Atomic Designパターン (organisms/molecules)

### State Management Layer (状態管理層)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        🔄 State Management Layer                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Custom Hooks (hooks/)                                           │    │
│  │  ├─ useSocket.ts      (Socket.IO接続管理)                        │    │
│  │  ├─ useGame.ts        (ゲーム状態管理)                           │    │
│  │  ├─ useRoom.ts        (ルーム状態管理)                           │    │
│  │  ├─ useSocialSocket.ts (チャットSocket管理)                      │    │
│  │  └─ useAuth.ts        (認証状態管理)                             │    │
│  │                                                                  │    │
│  │  役割: ビジネスロジック + Socket イベント購読                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Context Providers (contexts/)                                   │    │
│  │  ├─ AuthContext.tsx        (Supabase認証グローバル状態)         │    │
│  │  └─ SocialSocketContext.tsx (チャット用Socket共有)              │    │
│  │                                                                  │    │
│  │  役割: グローバル状態共有                                         │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

**責任範囲**:
- アプリケーション状態の管理 (React state)
- WebSocketイベントの購読とハンドリング
- グローバル状態の共有 (Context API)

### Communication Layer (通信層)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      🔌 Communication Layer                              │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Socket.IO Client (app/socket.ts)                                │    │
│  │  ├─ getSocket()     (シングルトン Socket 取得)                   │    │
│  │  ├─ reconnectSocket() (再接続処理)                               │    │
│  │  └─ disconnectSocket() (切断処理)                                │    │
│  │                                                                  │    │
│  │  2つのネームスペース:                                             │    │
│  │  ・/ (GameGateway)     - ゲームロジック                          │    │
│  │  ・/social (SocialGateway) - チャット                            │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  REST API Client (app/api/)                                      │    │
│  │  └─ /api/user-profile/{id}/avatar (アバター画像アップロード)    │    │
│  │                                                                  │    │
│  │  使用例: 大容量バイナリデータの送信                               │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

**責任範囲**:
- WebSocketクライアント管理 (Socket.IO)
- REST APIクライアント (大容量データ用)
- 再接続ロジック

## 🚀 Backend Layer 詳細 (NestJS + Clean Architecture)

### Infrastructure/Presentation Layer (インフラ/プレゼンテーション層)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    🌐 Infrastructure/Presentation Layer                    │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  WebSocket Gateways (*.gateway.ts)                                │    │
│  │  ┌─────────────────────────┬──────────────────────────────────┐  │    │
│  │  │  GameGateway            │  SocialGateway                    │  │    │
│  │  │  namespace: /           │  namespace: /social               │  │    │
│  │  ├─────────────────────────┼──────────────────────────────────┤  │    │
│  │  │ ・create-room           │ ・chat:join-room                  │  │    │
│  │  │ ・join-room             │ ・chat:leave-room                 │  │    │
│  │  │ ・start-game            │ ・chat:post-message               │  │    │
│  │  │ ・declare-blow          │ ・chat:typing                     │  │    │
│  │  │ ・play-card             │ ・chat:list-messages              │  │    │
│  │  │ ・reconnection 処理     │                                   │  │    │
│  │  └─────────────────────────┴──────────────────────────────────┘  │    │
│  │                                                                    │    │
│  │  役割: プロトコル処理 (WebSocket イベント→Use Cases へ委譲)       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  REST Controllers (*.controller.ts)                               │    │
│  │  └─ UserProfileController                                         │    │
│  │     ├─ POST /:id/avatar (画像アップロード + Sharp.js 最適化)     │    │
│  │     └─ GET  /:id (プロフィール取得)                              │    │
│  │                                                                    │    │
│  │  役割: REST API エンドポイント (大容量バイナリ専用)               │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

**責任範囲**:
- WebSocketプロトコル処理 (Socket.IOイベント受信)
- REST HTTPプロトコル処理
- Use Casesへの処理委譲
- クライアントへのレスポンス送信

### Application Layer (アプリケーション層 - Use Cases)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        💼 Application Layer (Use Cases)                    │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Use Cases (use-cases/*.use-case.ts)                              │    │
│  │  ├─ JoinRoomUseCase         (ルーム参加ロジック)                  │    │
│  │  ├─ CreateRoomUseCase       (ルーム作成ロジック)                  │    │
│  │  ├─ StartGameUseCase        (ゲーム開始ロジック)                  │    │
│  │  ├─ DeclareBlowUseCase      (Blow宣言ロジック)                    │    │
│  │  ├─ PlayCardUseCase         (カードプレイロジック)                │    │
│  │  └─ ...                                                            │    │
│  │                                                                    │    │
│  │  特徴:                                                             │    │
│  │  ・@Injectable() でNestJS DIに登録                                 │    │
│  │  ・複数Serviceを組み合わせた処理フロー                            │    │
│  │  ・アプリケーション固有のビジネスルール                            │    │
│  │  ・入力検証 + ユーザー正規化 + イベント発火準備                   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

**責任範囲**:
- アプリケーション固有のビジネスルール
- 複数のDomain Servicesの調整
- 入力検証とデータ変換
- Gateway向けイベントの準備

**例: JoinRoomUseCase**
```typescript
@Injectable()
export class JoinRoomUseCase implements IJoinRoomUseCase {
  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
  ) {}

  async execute(request: JoinRoomRequest): Promise<JoinRoomResponse> {
    // 1. ユーザー正規化 (認証済みユーザー vs ゲストユーザー)
    const normalizedUser = this.normalizeUser(user, authenticatedUser);

    // 2. ルーム参加処理
    const joinSucceeded = await this.roomService.joinRoom(roomId, normalizedUser);

    // 3. ゲーム再開判定
    const resumePayload = await this.buildResumePayloadIfNeeded(roomId, room);

    return { success: true, data: { room, resumePayload } };
  }
}
```

### Domain Layer (ドメイン層 - Services)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          🧠 Domain Layer (Services)                        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Domain Services (services/*.service.ts)                           │    │
│  │  ├─ GameStateService     (ゲーム状態管理)                         │    │
│  │  ├─ RoomService          (ルーム管理)                             │    │
│  │  ├─ CardService          (カード配布・管理)                       │    │
│  │  ├─ BlowService          (Blowフェーズロジック)                   │    │
│  │  ├─ PlayService          (Playフェーズロジック)                   │    │
│  │  ├─ ScoreService         (スコア計算)                             │    │
│  │  ├─ ChatService          (チャットロジック)                       │    │
│  │  ├─ ChatCleanupService   (期限切れメッセージ削除)                 │    │
│  │  └─ AuthService          (認証・認可)                             │    │
│  │                                                                    │    │
│  │  役割: ドメインロジック (ゲームルール、ビジネスルール)             │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

**責任範囲**:
- ビジネスルール (ゲームルール)
- ドメインエンティティの操作
- 純粋な計算ロジック
- インフラストラクチャに依存しない

### Infrastructure Layer - Data Access (インフラ層 - データアクセス)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                 📦 Infrastructure Layer (Repositories)                     │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Repository Interfaces (repositories/interfaces/)                 │    │
│  │  ├─ IRoomRepository           (ルームデータアクセス)              │    │
│  │  ├─ IGameStateRepository      (ゲーム状態永続化)                  │    │
│  │  ├─ IUserProfileRepository    (ユーザープロフィール)              │    │
│  │  ├─ IChatRoomRepository       (チャットルーム)                    │    │
│  │  └─ IChatMessageRepository    (チャットメッセージ)                │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Repository Implementations (repositories/implementations/)       │    │
│  │  ├─ SupabaseRoomRepository                                        │    │
│  │  ├─ SupabaseGameStateRepository                                   │    │
│  │  ├─ SupabaseUserProfileRepository                                 │    │
│  │  ├─ SupabaseChatRoomRepository                                    │    │
│  │  └─ SupabaseChatMessageRepository                                 │    │
│  │                                                                    │    │
│  │  特徴: インターフェースと実装の分離 (依存性逆転の原則)            │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Database Module (database/)                                       │    │
│  │  └─ SupabaseService (Supabaseクライアント初期化)                  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

**責任範囲**:
- データ永続化
- データベースクエリ
- 外部サービスとの連携
- インフラストラクチャの詳細をカプセル化

**依存性逆転の例**:
```typescript
// Domain層はインターフェースに依存
class RoomService {
  constructor(
    @Inject('IRoomRepository')
    private roomRepository: IRoomRepository  // インターフェース
  ) {}
}

// Infrastructure層で実装を提供
@Module({
  providers: [
    {
      provide: 'IRoomRepository',
      useClass: SupabaseRoomRepository  // 実装
    }
  ]
})
```

### External Services Layer (外部サービス層)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                       🗄️ External Services Layer                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Supabase PostgreSQL                                               │    │
│  │  ├─ rooms                  (ルーム情報)                            │    │
│  │  ├─ room_players           (ルーム参加プレイヤー)                  │    │
│  │  ├─ game_states            (ゲーム状態)                            │    │
│  │  ├─ game_history           (ゲーム履歴)                            │    │
│  │  ├─ chat_rooms             (チャットルーム)                        │    │
│  │  ├─ chat_messages          (チャットメッセージ)                    │    │
│  │  └─ user_profiles          (ユーザープロフィール)                  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```

## 🔗 依存関係の方向 (Clean Architecture 準拠)

```
外側 (Infrastructure) ────────→ 内側 (Domain)
  ↑                                  ↑
  │                                  │
  │        依存性の逆転               │
  │     (Dependency Inversion)       │
  │                                  │

Gateways/Controllers
  │
  └─→ Use Cases
        │
        └─→ Services (Domain Logic)
              │
              └─→ Repository Interfaces ←┐
                                         │ 実装
                Repository Implementations ──→ Database
```

### 重要な原則

1. **依存性の方向**: 内側の層は外側を知らない
   - Domain層はInfrastructure層を知らない
   - Services層はGateways/Controllersを知らない

2. **依存性逆転の原則** (Dependency Inversion Principle)
   - 上位モジュール (Services) は下位モジュール (Repositories) に依存しない
   - どちらも抽象 (Interface) に依存する

3. **テスト容易性**
   - インターフェースを使うことでモックへの差し替えが簡単
   ```typescript
   Test.createTestingModule({
     providers: [
       RoomService,
       { provide: 'IRoomRepository', useValue: mockRepository }
     ]
   })
   ```

## 📡 データフロー例: カードをプレイする

```
Frontend                     Backend                          Database
───────                      ───────                          ────────

1. useGame.playCard('H-A')
     │
     ├─→ socket.emit('play-card', {...})
                                │
                                ▼
                           2. GameGateway.handlePlayCard()
                                │
                                ├─→ 3. PlayCardUseCase.execute()
                                        │
                                        ├─→ 4. PlayService.playCard()
                                        │     (ゲームルール検証)
                                        │
                                        ├─→ 5. RoomService.getRoomGameState()
                                        │     │
                                        │     └─→ GameStateRepository.findByRoomId()
                                        │           │
                                        │           └─→ Supabase SELECT
                                        │
                                        └─→ 6. GameStateRepository.update()
                                                  │
                                                  └─→ Supabase UPDATE

                                ▼
                           7. server.to(roomId).emit('card-played', {...})
     │
     ◀──────────────────────────┘

8. useGame: 'card-played' イベント受信
     │
     └─→ setCurrentField() でReact状態更新
           │
           └─→ UI再レンダリング
```

### フロー詳細

1. **Frontend**: ユーザーがカードをクリック → `useGame.playCard()` 呼び出し
2. **WebSocket送信**: Socket.IOで `play-card` イベント送信
3. **Gateway**: `GameGateway.handlePlayCard()` がイベント受信
4. **Use Case**: `PlayCardUseCase.execute()` に委譲
5. **Domain Service**: `PlayService.playCard()` でゲームルール検証
6. **Repository**: `GameStateRepository` でデータベース読み書き
7. **Database**: Supabaseに永続化
8. **WebSocket配信**: `server.to(roomId).emit()` でルーム内全員に配信
9. **Frontend更新**: `useGame` でイベント受信 → React状態更新 → UI再レンダリング

## 🏗️ NestJS Module 構成

```
AppModule (ルート)
│
├── ConfigModule.forRoot()      (グローバル設定)
├── ScheduleModule.forRoot()    (スケジューラー - チャット削除)
├── SentryModule.forRoot()      (エラー監視)
│
├── RepositoriesModule          (データアクセス層)
│   └── DatabaseModule          (Supabase初期化)
│
├── AuthModule                  (認証・認可)
│   └── RepositoriesModule      (共有)
│
├── SocialModule                (チャット機能)
│   └── RepositoriesModule      (共有)
│
└── GameModule                  (ゲームロジック)
    ├── RepositoriesModule      (共有)
    ├── AuthModule              (共有)
    └── SocialModule            (ゲームルーム作成時にチャットルームも作成)
```

### モジュールの特性

1. **シングルトンパターン**
   - 同じModuleを複数箇所でimportしても、インスタンスは1つだけ
   - 例: `RepositoriesModule` は `AuthModule`, `SocialModule`, `GameModule` で共有

2. **依存性注入 (DI)**
   - NestJSがインターフェーストークンから実装クラスを自動解決
   ```typescript
   @Module({
     providers: [
       { provide: 'IRoomRepository', useClass: SupabaseRoomRepository }
     ],
     exports: ['IRoomRepository']
   })
   ```

3. **forRoot() vs forFeature()**
   - `forRoot()`: AppModuleで1回だけ呼ぶ (グローバル設定)
   - `forFeature()`: 各機能モジュールで呼ぶ (モジュール固有設定)

## 🎯 層ごとの責任範囲まとめ

| 層 | 責任 | 例 | 依存先 |
|---|---|---|---|
| **Presentation (Frontend)** | UI表示、ユーザー入力 | React Components, Pages | State Management |
| **State Management** | 状態管理、Socket購読 | useGame, useSocket | Communication |
| **Communication** | 通信プロトコル | Socket.IO Client, Axios | Backend |
| **Infrastructure (Backend)** | プロトコル処理 | GameGateway, SocialGateway | Use Cases |
| **Application** | アプリケーションロジック | JoinRoomUseCase, PlayCardUseCase | Services |
| **Domain** | ビジネスルール | GameStateService, CardService | Repositories |
| **Infrastructure (Data)** | データ永続化 | SupabaseRoomRepository | Database |
| **External** | 外部サービス | Supabase PostgreSQL | - |

## 🔄 REST vs WebSocket の使い分け

### WebSocketを使う場合 (Socket.IO)

**適用例**:
- ゲーム操作 (GameGateway)
- チャットメッセージ (SocialGateway)
- リアルタイム通知

**理由**:
- リアルタイム双方向通信が必要
- 小さいデータの頻繁なやり取り (テキストメッセージ)
- サーバープッシュ通知が必要
- 接続維持が必要 (プレゼンス、タイピング通知)
- 複数クライアントへのブロードキャスト

### RESTを使う場合 (HTTP API)

**適用例**:
- アバター画像アップロード (UserProfileController)

**理由**:
- 大容量バイナリデータ (最大2MB画像)
- 単発操作
- Multipart Form Dataのサポート必要
- 複雑な処理 (Sharp.js画像最適化: 128x128 WebP変換、最大50KB)

## 📚 関連ドキュメント

- [CLAUDE.md](./CLAUDE.md) - プロジェクト全体の概要と開発ガイドライン
- [mei-tra-backend/README.md](./mei-tra-backend/README.md) - NestJSモジュールシステムの詳細
- [database/schema.sql](./mei-tra-backend/database/schema.sql) - データベーススキーマ定義

## 🎓 設計思想

このプロジェクトは以下の原則に基づいて設計されています:

1. **Clean Architecture**: 層の分離と依存性の方向管理
2. **SOLID原則**: 特に依存性逆転の原則 (DIP) とインターフェース分離の原則 (ISP)
3. **ドメイン駆動設計 (DDD)**: ビジネスロジックをDomain層に集約
4. **依存性注入 (DI)**: NestJSのDIコンテナでテスト容易性を確保
5. **Repository Pattern**: データアクセスの抽象化
6. **Use Case Pattern**: アプリケーション固有のロジックをカプセル化
