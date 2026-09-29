import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';

export function AppleSignInButton({ onPress, disabled }: {
  onPress: () => void;
  disabled: boolean;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false));
  }, []);
  if (!available) return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8}
      onPress={() => { if (!disabled) onPress(); }}
      style={{ height: 48, opacity: disabled ? 0.5 : 1 }}
    />
  );
}
