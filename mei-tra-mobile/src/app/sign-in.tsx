import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme/colors';

export default function SignInScreen() {
  const router = useRouter();
  const {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
  } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    return <Redirect href="/rooms" />;
  }

  if (loading) {
    return (
      <Screen contentStyle={styles.loadingState}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
          ログイン状態を確認しています
        </Text>
      </Screen>
    );
  }

  const handleSubmit = async () => {
    if (submitting || isInvalid) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result =
        mode === 'signIn'
          ? await signIn(email, password)
          : await signUp(email, password, displayName);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.emailConfirmationRequired) {
        setMessage(
          '確認メールを送信しました。メール内のリンクから登録を完了してください。',
        );
        return;
      }

      router.replace('/rooms');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signInWithGoogle();

      if (result.error) {
        setError(result.error);
        return;
      }

      router.replace('/rooms');
    } finally {
      setSubmitting(false);
    }
  };

  const isInvalid =
    !email.trim() ||
    password.length < 6 ||
    (mode === 'signUp' && !displayName.trim());

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <BrandHeader subtitle="明専トランプを、いつでも。" />

        <View style={styles.card}>
          <Text style={styles.title}>
            {mode === 'signIn' ? 'ログイン' : 'アカウント作成'}
          </Text>

          <Button
            variant="secondary"
            onPress={handleGoogle}
            disabled={submitting}
          >
            Googleで続ける
          </Button>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>または</Text>
            <View style={styles.dividerLine} />
          </View>

          {mode === 'signUp' ? (
            <TextInput
            accessibilityLabel="表示名"
            autoCapitalize="none"
            autoCorrect={false}
              onChangeText={setDisplayName}
              placeholder="表示名"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={displayName}
            />
          ) : null}

          <TextInput
            accessibilityLabel="メールアドレス"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="メールアドレス"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={email}
          />

          <TextInput
            accessibilityLabel="パスワード"
            autoCapitalize="none"
            autoComplete={
              mode === 'signIn' ? 'current-password' : 'new-password'
            }
            onChangeText={setPassword}
            placeholder="パスワード（6文字以上）"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Button
            disabled={isInvalid}
            loading={submitting}
            onPress={handleSubmit}
          >
            {mode === 'signIn' ? 'ログイン' : '登録する'}
          </Button>

          <Button
            variant="ghost"
            disabled={submitting}
            onPress={() => {
              setMode((current) =>
                current === 'signIn' ? 'signUp' : 'signIn',
              );
              setError(null);
              setMessage(null);
            }}
          >
            {mode === 'signIn'
              ? '初めての方はこちら'
              : 'アカウントをお持ちの方'}
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 32,
    padding: 24,
  },
  card: {
    gap: 16,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
  },
  error: {
    // dangerText, not danger: `danger` is a fill colour and only reaches ~2.4:1
    // as text on the felt panel behind this card. See theme/palette.ts.
    color: colors.dangerText,
    fontSize: 15,
  },
  message: {
    color: colors.success,
    fontSize: 15,
  },
});
