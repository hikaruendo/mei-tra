/**
 * 画像最適化ユーティリティ
 * クライアントサイドでの画像処理とバリデーション
 */

export interface OptimizedImage {
  file: File;
  preview: string;
  originalSize: number;
  optimizedSize: number;
}

export interface ImageOptimizationOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  maxFileSize: number; // bytes
  allowedTypes: string[];
}

const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 128,
  maxHeight: 128,
  quality: 0.8,
  maxFileSize: 50 * 1024, // 50KB
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
};

/**
 * ファイルが有効な画像かどうかをチェック
 */
export function validateImageFile(
  file: File,
  options: Partial<ImageOptimizationOptions> = {}
): { isValid: boolean; error?: string } {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!opts.allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'サポートされていないファイル形式です。JPEG、PNG、WebPのみ対応しています。',
    };
  }

  if (file.size > 2 * 1024 * 1024) { // 2MB limit for input
    return {
      isValid: false,
      error: 'ファイルサイズが大きすぎます。2MB以下のファイルを選択してください。',
    };
  }

  return { isValid: true };
}

/**
 * 画像を最適化してリサイズ
 */
export async function optimizeImage(
  file: File,
  options: Partial<ImageOptimizationOptions> = {}
): Promise<OptimizedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ファイルバリデーション
  const validation = validateImageFile(file, opts);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // アスペクト比を保持してリサイズ計算
        const { width, height } = calculateDimensions(
          img.width,
          img.height,
          opts.maxWidth,
          opts.maxHeight
        );

        canvas.width = width;
        canvas.height = height;

        if (!ctx) {
          throw new Error('Canvas context could not be created');
        }

        // 高品質リサイズのための設定
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 画像を描画
        ctx.drawImage(img, 0, 0, width, height);

        // WebP形式でエクスポート
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('画像の最適化に失敗しました'));
              return;
            }

            // ファイルサイズチェック
            if (blob.size > opts.maxFileSize) {
              // 品質を下げて再試行
              canvas.toBlob(
                (retryBlob) => {
                  if (!retryBlob) {
                    reject(new Error('画像の最適化に失敗しました'));
                    return;
                  }

                  if (retryBlob.size > opts.maxFileSize) {
                    reject(
                      new Error(
                        `最適化後も画像サイズが大きすぎます（${Math.round(retryBlob.size / 1024)}KB）。より小さな画像を選択してください。`
                      )
                    );
                    return;
                  }

                  const optimizedFile = new File(
                    [retryBlob],
                    `optimized-${file.name.split('.')[0]}.webp`,
                    { type: 'image/webp' }
                  );

                  resolve({
                    file: optimizedFile,
                    preview: URL.createObjectURL(retryBlob),
                    originalSize: file.size,
                    optimizedSize: retryBlob.size,
                  });
                },
                'image/webp',
                0.6 // Lower quality for retry
              );
              return;
            }

            const optimizedFile = new File(
              [blob],
              `optimized-${file.name.split('.')[0]}.webp`,
              { type: 'image/webp' }
            );

            resolve({
              file: optimizedFile,
              preview: URL.createObjectURL(blob),
              originalSize: file.size,
              optimizedSize: blob.size,
            });
          },
          'image/webp',
          opts.quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'));
    };

    // ファイルを読み込み
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * アスペクト比を保持しながら最大サイズ内に収まるよう計算
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;

  let width = maxWidth;
  let height = maxHeight;

  if (originalWidth > originalHeight) {
    // 横長の場合
    height = width / aspectRatio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
  } else {
    // 縦長または正方形の場合
    width = height * aspectRatio;
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * プレビューURLをクリーンアップ
 */
export function cleanupPreviewUrl(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * ファイルサイズを人間が読みやすい形式で返す
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}