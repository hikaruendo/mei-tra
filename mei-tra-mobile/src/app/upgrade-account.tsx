import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
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
import { t } from '@/i18n';
import { useLocale } from '@/context/LocaleContext';

export default function UpgradeAccountScreen() {
  // Re-render this screen when the app language changes; t() is a bare
  // function and cannot trigger that on its own.
  useLocale();
  const router = useRouter();
  const { user, loading, upgradeAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loading && !user) {
    return <Redirect href="/sign-in" />;
  }

  // An upgrade that needs no email confirmation clears isAnonymous the moment
  // it lands, so keep the screen mounted while one is in flight or its result
  // is on screen — otherwise the redirect swallows the confirmation.
  if (!loading && user && !user.isAnonymous && !submitting && !message) {
    return <Redirect href="/rooms" />;
  }

  const isInvalid = !email.trim() || password.length < 8;

  const handleSubmit = async () => {
    if (submitting || isInvalid) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await upgradeAccount(email, password);

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage(
        result.emailConfirmationRequired
          ? t('upgrade.confirmEmailSent')
          : t('upgrade.completed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <BrandHeader subtitle={t('auth.brandTagline')} />

        <View style={styles.card}>
          <Text style={styles.title}>{t('upgrade.title')}</Text>

          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : (
            <>
              <Text style={styles.description}>
                {t('upgrade.description')}
              </Text>

              <TextInput
                accessibilityLabel={t('auth.email')}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder={t('auth.email')}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={email}
              />

              <TextInput
                accessibilityLabel={t('auth.password')}
                autoCapitalize="none"
                autoComplete="new-password"
                onChangeText={setPassword}
                placeholder={t('auth.passwordMin8')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.input}
                value={password}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                disabled={isInvalid}
                loading={submitting}
                onPress={handleSubmit}
              >
                {t('upgrade.submit')}
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            disabled={submitting}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/rooms');
              }
            }}
          >
            {t('upgrade.back')}
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
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
