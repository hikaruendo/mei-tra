# アバターアップロードシステム

明専トランプのアバター画像アップロード機能の技術仕様とインフラ構成を説明します。

---

## 🏗️ インフラスタック構成

```
┌─────────────────────────────────────────────────────────────┐
│                       クライアント                            │
│  ブラウザ (React/Next.js)                                     │
│  - Canvas API (クライアント側画像最適化)                      │
│  - File API                                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │ FormData (multipart/form-data)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Route (BFF Pattern)                │
│  /api/user-profile/[id]/avatar                              │
│  - リバースプロキシとして機能                                 │
│  - Authorizationヘッダーを転送                               │
└──────────────────┬──────────────────────────────────────────┘
                   │ FormData転送
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   NestJS Backend                            │
│  UserProfileController                                       │
│  - Multer (ファイルアップロード処理)                          │
│  - Sharp (サーバー側画像最適化)                               │
│  - Supabase Storage SDK                                      │
└──────────────────┬──────────────────────────────────────────┘
                   │ Storage API
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Storage                           │
│  Bucket: avatars                                            │
│  - オブジェクトストレージ (S3互換)                            │
│  - RLS (Row Level Security) ポリシー                         │
│  - Public URL生成                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 処理フロー詳細

### 1️⃣ クライアント側処理

**ファイル**: `mei-tra-frontend/lib/utils/imageOptimizer.ts`

#### 処理ステップ

```
1. ユーザーが画像選択 (input type="file" or Drag & Drop)
   ↓
2. validateImageFile()
   - ファイル形式チェック: JPEG/PNG/WebP
   - ファイルサイズチェック: 最大2MB
   ↓
3. optimizeImage() - Canvas APIで最適化
   - 128x128にリサイズ (アスペクト比保持)
   - WebP形式に変換
   - 品質: 80% (1回目)
   - 目標サイズ: 50KB以下
   ↓
4. サイズオーバーの場合は再試行
   - 品質: 60% (2回目)
   - それでも超える場合はエラー
   ↓
5. プレビュー表示 (Blob URL)
```

#### 最適化パラメータ

| 項目 | 値 |
|------|-----|
| 入力制限 | 最大2MB |
| リサイズ | 128x128px (アスペクト比保持) |
| 出力形式 | WebP |
| 品質 (1回目) | 80% |
| 品質 (2回目) | 60% |
| 目標サイズ | 50KB以下 |

#### コード例

```typescript
// バリデーション
const validation = validateImageFile(file);
if (!validation.isValid) {
  throw new Error(validation.error);
}

// 最適化
const optimized = await optimizeImage(file);
// → { file: File, preview: string, originalSize: number, optimizedSize: number }
```

---

### 2️⃣ Next.js API Route (BFF Pattern)

**ファイル**: `mei-tra-frontend/app/api/user-profile/[id]/avatar/route.ts`

#### 役割

- **Backend for Frontend (BFF)** パターン
- CORS問題の回避
- 認証トークンの安全な転送
- エラーハンドリングの統一

#### 処理フロー

```typescript
POST /api/user-profile/${userId}/avatar
  ↓
1. FormDataを受け取る
2. Authorizationヘッダーを確認
   - Bearer トークンが必要
3. バックエンドに転送:
   → http://localhost:3333/api/user-profile/${userId}/avatar (開発環境)
   → ${NEXT_PUBLIC_BACKEND_URL}/api/user-profile/${userId}/avatar (本番環境)
4. レスポンスをクライアントに返す
```

---

### 3️⃣ NestJS Backend処理

**ファイル**: `mei-tra-backend/src/controllers/user-profile.controller.ts`

#### エンドポイント

```typescript
@Post(':id/avatar')
@UseInterceptors(FileInterceptor('avatar'))
async uploadAvatar(@Param('id') id: string, @UploadedFile() file: Express.Multer.File)
```

#### 処理ステップ

```
1. Multerがファイルを受け取る
   - MaxFileSizeValidator: 2MB
   - FileTypeValidator: image/jpeg|jpg|png|webp
   ↓
2. Sharp で再最適化
   - 128x128にリサイズ (fit: 'cover', position: 'center')
   - WebP変換 (quality: 80, effort: 6)
   - 最大50KBチェック
   ↓
3. 古いアバター削除
   - 既存のavatar_urlからファイル名抽出
   - Supabase Storageから削除
   ↓
4. Supabase Storageにアップロード
   - ファイル名: `avatar-${userId}-${timestamp}.webp`
   - バケット: 'avatars'
   - contentType: 'image/webp'
   - cacheControl: '3600' (1時間キャッシュ)
   ↓
5. Public URLを取得
   - storage.from('avatars').getPublicUrl(fileName)
   ↓
6. user_profilesテーブル更新
   - UPDATE user_profiles SET avatar_url = ${publicUrl} WHERE id = ${userId}
```

#### Sharp最適化コード

```typescript
private async optimizeImage(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .resize(128, 128, {
      fit: 'cover',
      position: 'center',
    })
    .webp({
      quality: 80,
      effort: 6,
    })
    .toBuffer();
}
```

---

### 4️⃣ Supabase Storage

**バケット**: `avatars`

#### バケット設定

```sql
-- マイグレーション: 20260111100000_create_avatars_bucket.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                                                -- 公開バケット
  52428800,                                           -- 50MB制限
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);
```

#### RLS (Row Level Security) ポリシー

```sql
-- 読み取り: 誰でもOK (公開アクセス)
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- アップロード: 自分のフォルダのみ
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 更新: 自分のファイルのみ
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 削除: 自分のファイルのみ
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

#### ファイル構造

```
avatars/
└── avatar-{userId}-{timestamp}.webp

例:
avatars/avatar-e1b7ff9d-2ccc-49f3-bbab-003bc07d4924-1760768383743.webp
```

---

## 📊 データフロー図

```
┌──────────────┐
│   ユーザー    │
└──────┬───────┘
       │ 画像選択 (2MB以下)
       ▼
┌──────────────────────────────┐
│ クライアント側最適化          │
│ Canvas API                   │
│ ・128x128リサイズ            │
│ ・WebP変換 (quality: 80%)    │
│ ・目標: 50KB以下             │
└──────┬───────────────────────┘
       │ FormData POST
       ▼
┌──────────────────────────────┐
│ Next.js API Route (BFF)      │
│ /api/user-profile/:id/avatar │
│ ・認証トークン転送           │
└──────┬───────────────────────┘
       │ FormData転送
       ▼
┌──────────────────────────────┐
│ NestJS Backend               │
│ ・Multerでファイル受信       │
│ ・Sharp再最適化              │
│ ・古いアバター削除           │
└──────┬───────────────────────┘
       │ Storage API
       ▼
┌──────────────────────────────┐
│ Supabase Storage             │
│ avatars bucket               │
│ avatar-{id}-{ts}.webp        │
└──────┬───────────────────────┘
       │ Public URL
       ▼
┌──────────────────────────────┐
│ PostgreSQL                   │
│ user_profiles.avatar_url     │
│ UPDATE完了                   │
└──────┬───────────────────────┘
       │ レスポンス返却
       ▼
┌──────────────────────────────┐
│ フロントエンド               │
│ ・AuthContext更新            │
│ ・ヘッダーのアバター再表示   │
└──────────────────────────────┘
```

---

## 🎯 最適化ポイント

### 1. 二重最適化戦略

#### なぜ2回最適化するのか？

| 最適化箇所 | 技術 | 目的 |
|-----------|------|------|
| **クライアント側** | Canvas API | 通信量削減 (2MB → 50KB) |
| **サーバー側** | Sharp | 品質保証・規格統一 |

**メリット**:
- ✅ 通信量95%削減
- ✅ サーバー負荷軽減
- ✅ ユーザー体験向上 (アップロード高速化)
- ✅ 品質の統一性保証

---

### 2. ファイル命名規則

```
avatar-{userId}-{timestamp}.webp
```

**構成要素**:
- `avatar-`: プレフィックス (識別用)
- `{userId}`: ユーザーID (UUID)
- `{timestamp}`: Unixタイムスタンプ (ミリ秒)
- `.webp`: 拡張子

**メリット**:
- ✅ ユーザーIDで所有者識別
- ✅ タイムスタンプで上書き防止
- ✅ キャッシュバスティング効果
- ✅ 重複ファイル名回避

**例**:
```
avatar-e1b7ff9d-2ccc-49f3-bbab-003bc07d4924-1760768383743.webp
```

---

### 3. 古いアバター削除

```typescript
// アップロード前に古いファイルを削除
const existingProfile = await this.userProfileRepository.findById(id);

if (existingProfile?.avatarUrl) {
  await this.deleteOldAvatar(existingProfile.avatarUrl);
}
```

**メリット**:
- ✅ ストレージ容量節約
- ✅ ユーザーごとに1ファイルのみ保持
- ✅ 無駄なファイル蓄積防止

---

### 4. キャッシュ戦略

```typescript
// Supabase Storageアップロード時
{
  contentType: 'image/webp',
  cacheControl: '3600',  // 1時間キャッシュ
  upsert: false
}
```

**キャッシュレベル**:
1. **ブラウザキャッシュ**: 1時間
2. **CDNキャッシュ**: 1時間 (Supabase CDN)
3. **Blob URL キャッシュ**: クライアント側プレビュー

**メリット**:
- ✅ 帯域幅削減
- ✅ 表示速度向上
- ✅ サーバー負荷軽減

---

## 💰 コスト最適化

### ストレージ使用量

| 項目 | サイズ |
|------|--------|
| 1ユーザーあたり | 20-50KB (平均30KB) |
| 1000ユーザー | 約30MB |
| 10000ユーザー | 約300MB |

### 転送量削減

| シナリオ | Before | After | 削減率 |
|---------|--------|-------|--------|
| 1回のアップロード | 2MB | 50KB | **97.5%** |
| 1000回/月 | 2GB | 50MB | **97.5%** |

### Supabase料金 (参考)

- **Free Tier**: 1GB Storage, 2GB Bandwidth
- **Pro Plan**: 8GB Storage, 50GB Bandwidth
- **このシステム**: 10,000ユーザーでもFree Tierで運用可能 ✅

---

## 🔐 セキュリティ

### 1. 認証・認可

```typescript
// RLSポリシーでユーザーID検証
auth.uid()::text = (storage.foldername(name))[1]
```

- ✅ Supabase JWTトークンで認証
- ✅ 自分のファイルのみ操作可能
- ✅ 他人のアバター削除・上書き不可

---

### 2. ファイル検証

#### クライアント側

```typescript
// バリデーション
if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
  throw new Error('サポートされていないファイル形式');
}

if (file.size > 2 * 1024 * 1024) {
  throw new Error('ファイルサイズが大きすぎます');
}
```

#### サーバー側

```typescript
// Multerバリデーション
new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })
new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp)$/ })

// Sharp処理後のサイズチェック
if (optimizedBuffer.length > 50 * 1024) {
  throw new HttpException('Optimized image is still too large', 400);
}
```

---

### 3. XSS対策

- ✅ WebP形式のみ許可 (スクリプト埋め込み不可)
- ✅ Content-Type検証
- ✅ ファイル拡張子強制 (`.webp`)

---

## 🛠️ トラブルシューティング

### よくある問題

#### 1. アバターがアップロードできない

**原因**:
- ファイルサイズが2MBを超えている
- ファイル形式が対応外 (GIF, BMPなど)

**対処**:
```typescript
// エラーメッセージを確認
console.error(error.message);

// ファイル情報を確認
console.log({
  name: file.name,
  type: file.type,
  size: file.size
});
```

---

#### 2. アバターが表示されない

**原因**:
- Public URLが正しく生成されていない
- RLSポリシーでブロックされている

**確認方法**:
```sql
-- Supabase Dashboard > SQL Editor
SELECT id, avatar_url FROM user_profiles WHERE id = 'your-user-id';
```

**対処**:
```typescript
// AuthContext の refreshUserProfile() を呼び出す
await refreshUserProfile();
```

---

#### 3. 古いアバターが残る

**原因**:
- deleteOldAvatar() が失敗している
- ファイル名抽出ロジックの問題

**確認方法**:
```sql
-- Supabase Dashboard > Storage > avatars
-- 同じユーザーIDのファイルが複数存在するか確認
```

**対処**:
```typescript
// ログを確認
this.logger.warn('Failed to delete old avatar:', error);
```

---

## 📚 関連ファイル

### フロントエンド

| ファイル | 説明 |
|---------|------|
| `mei-tra-frontend/lib/utils/imageOptimizer.ts` | クライアント側最適化ロジック |
| `mei-tra-frontend/components/profile/ProfileEditForm.tsx` | アバター編集フォーム |
| `mei-tra-frontend/app/api/user-profile/[id]/avatar/route.ts` | Next.js API Route (BFF) |
| `mei-tra-frontend/contexts/AuthContext.tsx` | 認証コンテキスト・プロフィール更新 |

### バックエンド

| ファイル | 説明 |
|---------|------|
| `mei-tra-backend/src/controllers/user-profile.controller.ts` | アバターアップロードAPI |
| `mei-tra-backend/src/database/supabase.service.ts` | Supabase接続サービス |
| `mei-tra-backend/supabase/migrations/20260111100000_create_avatars_bucket.sql` | バケット作成マイグレーション |

---

## 🔄 今後の改善案

### 1. 画像形式の拡張

- **AVIF形式のサポート**: WebPよりさらに高圧縮
- **アニメーションGIFのサポート**: 1フレーム目を静止画に変換

### 2. 顔認識・自動クロップ

```typescript
// 将来的な実装案
import * as faceapi from 'face-api.js';

const detectFace = async (image: HTMLImageElement) => {
  const detection = await faceapi.detectSingleFace(image);
  if (detection) {
    // 顔を中心にクロップ
    return cropToFace(image, detection);
  }
};
```

### 3. CDN最適化

- **Cloudflare Images**: 動的リサイズ・変換
- **複数サイズ生成**: 32x32, 64x64, 128x128
- **WebP/AVIF自動変換**: ブラウザ対応に応じて最適形式

---

## 📖 参考資料

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [WebP Image Format](https://developers.google.com/speed/webp)
