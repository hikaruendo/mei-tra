'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UserProfile, UserPreferences } from '@/types/user.types';
import { supabase } from '@/lib/supabase';
import {
  optimizeImage,
  validateImageFile,
  cleanupPreviewUrl,
  formatFileSize
} from '@/lib/utils/imageOptimizer';
import styles from './ProfileEditForm.module.scss';

interface ProfileEditFormProps {
  profile: UserProfile;
  onSave: (updatedProfile: UserProfile) => void;
  onCancel: () => void;
}

interface FormData {
  username: string;
  displayName: string;
  preferences: UserPreferences;
}

interface DatabaseUserProfileResponse {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  games_played: number;
  games_won: number;
  total_score: number;
  preferences: UserPreferences;
}

export function ProfileEditForm({ profile, onSave, onCancel }: ProfileEditFormProps) {
  const { user, refreshUserProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    username: profile.username,
    displayName: profile.displayName,
    preferences: { ...profile.preferences },
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    original?: number;
    optimized?: number;
    message?: string;
  }>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith('preferences.')) {
      const prefKey = name.split('.')[1] as keyof UserPreferences;
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [prefKey]: type === 'checkbox' ? checked : value,
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name.startsWith('preferences.')) {
      const prefKey = name.split('.')[1] as keyof UserPreferences;
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [prefKey]: value,
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAvatarSelect = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress({ message: '画像を処理中...' });

    try {
      // バリデーション
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        setError(validation.error || '無効なファイルです');
        return;
      }

      setUploadProgress({
        original: file.size,
        message: '画像を最適化中...'
      });

      // 画像を最適化
      const optimized = await optimizeImage(file);

      setUploadProgress({
        original: optimized.originalSize,
        optimized: optimized.optimizedSize,
        message: '最適化完了',
      });

      // 前のプレビューをクリーンアップ
      if (avatarPreview) {
        cleanupPreviewUrl(avatarPreview);
      }

      setAvatarFile(optimized.file);
      setAvatarPreview(optimized.preview);
    } catch (error) {
      setError(error instanceof Error ? error.message : '画像の処理に失敗しました');
    } finally {
      setIsUploading(false);
    }
  }, [avatarPreview]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleAvatarSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleAvatarSelect(file);
    }
  }, [handleAvatarSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;

    const formData = new FormData();
    formData.append('avatar', avatarFile);

    const response = await fetch(`/api/user-profile/${user.id}/avatar`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'アバターのアップロードに失敗しました');
    }

    const result = await response.json();
    return result.avatarUrl;
  };

  const updateProfile = async (): Promise<DatabaseUserProfileResponse> => {
    if (!user) throw new Error('ユーザーが見つかりません');

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        username: formData.username,
        display_name: formData.displayName,
        preferences: formData.preferences,
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data as DatabaseUserProfileResponse;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // バリデーション
      if (!formData.username.trim()) {
        setError('ユーザー名を入力してください');
        return;
      }
      if (!formData.displayName.trim()) {
        setError('表示名を入力してください');
        return;
      }

      let avatarUrl = profile.avatarUrl;

      // アバター画像をアップロード（あれば）
      if (avatarFile) {
        avatarUrl = await uploadAvatar() || undefined;
      }

      // プロフィールを更新
      const updatedProfile = await updateProfile();

      // アバターURLを統合
      const finalProfile: UserProfile = {
        id: updatedProfile.id,
        username: updatedProfile.username,
        displayName: updatedProfile.display_name,
        avatarUrl,
        createdAt: new Date(updatedProfile.created_at),
        updatedAt: new Date(updatedProfile.updated_at),
        lastSeenAt: new Date(updatedProfile.last_seen_at),
        gamesPlayed: updatedProfile.games_played,
        gamesWon: updatedProfile.games_won,
        totalScore: updatedProfile.total_score,
        preferences: updatedProfile.preferences,
      };

      onSave(finalProfile);

      // Refresh user profile in AuthContext to update avatar in header
      await refreshUserProfile();
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const currentAvatarUrl = avatarPreview || profile.avatarUrl;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>プロフィール画像</h3>

        <div className={styles.avatarSection}>
          <div className={styles.avatarContainer}>
            {currentAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentAvatarUrl}
                alt="プロフィール画像"
                className={styles.avatarImage}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                <span className={styles.avatarText}>
                  {formData.displayName?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            )}
            {isUploading && (
              <div className={styles.uploadingOverlay}>
                <div className={styles.spinner}></div>
              </div>
            )}
          </div>

          <div className={styles.avatarControls}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSaving}
              className={styles.uploadButton}
            >
              {isUploading ? '処理中...' : '画像を選択'}
            </button>

            <div
              className={styles.dropZone}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <p>ここに画像をドラッグ&ドロップ</p>
              <small>JPEG, PNG, WebP (最大2MB)</small>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileInputChange}
              className={styles.hiddenInput}
            />
          </div>

          {uploadProgress.original && (
            <div className={styles.uploadProgress}>
              <p>{uploadProgress.message}</p>
              {uploadProgress.optimized && (
                <p className={styles.sizeInfo}>
                  {formatFileSize(uploadProgress.original)} → {formatFileSize(uploadProgress.optimized)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>基本情報</h3>

        <div className={styles.inputGroup}>
          <label htmlFor="username" className={styles.label}>
            ユーザー名
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            disabled={isSaving}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="displayName" className={styles.label}>
            表示名
          </label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={formData.displayName}
            onChange={handleInputChange}
            disabled={isSaving}
            className={styles.input}
            required
          />
        </div>
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>設定</h3>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="preferences.notifications"
              checked={formData.preferences.notifications}
              onChange={handleInputChange}
              disabled={isSaving}
              className={styles.checkbox}
            />
            <span className={styles.checkboxText}>通知を受け取る</span>
          </label>
        </div>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="preferences.sound"
              checked={formData.preferences.sound}
              onChange={handleInputChange}
              disabled={isSaving}
              className={styles.checkbox}
            />
            <span className={styles.checkboxText}>効果音を有効にする</span>
          </label>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="theme" className={styles.label}>
            テーマ
          </label>
          <select
            id="theme"
            name="preferences.theme"
            value={formData.preferences.theme}
            onChange={handleSelectChange}
            disabled={isSaving}
            className={styles.select}
          >
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className={styles.cancelButton}
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className={styles.saveButton}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
}