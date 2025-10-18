<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

明専トランプ（Old Maid）のバックエンドAPI。NestJS + Supabase + WebSocketで構築されています。

## NestJSモジュールシステム

このプロジェクトはNestJSのモジュールシステムを活用し、依存性注入(DI)とクリーンアーキテクチャを実現しています。

### モジュール階層

```
AppModule (ルート)
│
├── ConfigModule.forRoot() (グローバル)
├── ScheduleModule.forRoot() (グローバル)
│
├── RepositoriesModule
│   └── DatabaseModule
│       └── ConfigModule.forFeature(supabaseConfig)
│
├── AuthModule
│   └── RepositoriesModule (共有)
│
├── SocialModule
│   └── RepositoriesModule (共有)
│
└── GameModule
    ├── RepositoriesModule (共有)
    ├── AuthModule (共有)
    └── SocialModule (共有)
```

### モジュールの役割

#### **DatabaseModule** (最下層)
- Supabaseクライアントの初期化と提供
- `SupabaseService`をエクスポート

#### **RepositoriesModule** (データアクセス層)
- リポジトリパターンの実装
- インターフェースと実装の分離（依存性の逆転）
- エクスポート:
  - `IRoomRepository`
  - `IGameStateRepository`
  - `IUserProfileRepository`
  - `IChatRoomRepository`
  - `IChatMessageRepository`

#### **機能モジュール**
- **AuthModule**: 認証・認可機能
- **SocialModule**: チャット機能（WebSocket）
- **GameModule**: ゲームロジック（WebSocket）

### 依存性注入 (DI) の仕組み

```typescript
// RepositoriesModuleで定義
{
  provide: 'IRoomRepository',      // インターフェース（抽象）
  useClass: SupabaseRoomRepository // 実装（具象）
}

// サービスで使用
constructor(
  @Inject('IRoomRepository')
  private roomRepository: IRoomRepository,
) {}
```

**利点**:
- テスト時にモックへ簡単に差し替え可能
- 実装を変更しても呼び出し側は影響を受けない
- インターフェースに依存することで疎結合を実現

### シングルトンパターン

NestJSは同じモジュールを複数箇所でインポートしても**インスタンスは1つだけ**作成します。

```typescript
// AppModuleとGameModuleの両方でSocialModuleをインポート
// → SocialModuleのインスタンスは1つだけ（メモリ効率が良い）
```

### forRoot() vs forFeature()

#### `forRoot()` - グローバル初期化
```typescript
// AppModuleで1回だけ呼ぶ
ScheduleModule.forRoot()
ConfigModule.forRoot({ isGlobal: true })
```
- アプリケーション全体で共有される設定
- ルートモジュールでのみ使用

#### `forFeature()` - 機能ごとの設定
```typescript
// 各機能モジュールで必要に応じて呼ぶ
ConfigModule.forFeature(supabaseConfig)
```
- モジュール固有の設定を追加
- 複数のモジュールで異なる設定を持てる

### このアーキテクチャの利点

1. **モジュール性**: 機能ごとに分離され、理解・変更が容易
2. **再利用性**: 同じモジュールを複数箇所で使用可能
3. **テスト容易性**: DIによりモックへの差し替えが簡単
4. **依存関係の明確化**: `imports`を見れば依存関係が一目瞭然
5. **スケーラビリティ**: 大規模アプリケーションでも破綻しない設計

## ドキュメント

- **[Supabaseマイグレーションガイド](./SUPABASE_MIGRATION.md)** - Supabase移行の全体概要とトラブルシューティング
- **[Supabase運用操作手順書](./SUPABASE_OPERATIONS.md)** - 日常運用での具体的な操作手順
- **[デプロイメントガイド](./DEPLOYMENT.md)** - 本番環境へのデプロイ手順

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
