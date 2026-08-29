import type { ReactNode } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { LiquidGlassSurface } from '@/components/ui/LiquidGlassSurface';
import { colors } from '@/theme/colors';

interface ModalSheetProps {
  children: ReactNode;
  closeLabel: string;
  contentStyle?: StyleProp<ViewStyle>;
  onClose: () => void;
  testID?: string;
  title: string;
  visible: boolean;
}

export function ModalSheet({
  children,
  closeLabel,
  contentStyle,
  onClose,
  testID,
  title,
  visible,
}: ModalSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.sheet} testID={testID}>
          <LiquidGlassSurface
            fallbackStyle={styles.headerFallback}
            style={styles.header}
          >
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <Button
              onPress={onClose}
              style={styles.close}
              testID="modal-sheet-close"
              variant="ghost"
            >
              {closeLabel}
            </Button>
          </LiquidGlassSurface>
          <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.modalOverlay,
  },
  sheet: {
    flex: 1,
    maxHeight: '82%',
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  header: {
    minHeight: 58,
    marginHorizontal: 10,
    marginBottom: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 20,
  },
  headerFallback: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong,
  },
  title: {
    flex: 1,
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
  },
  close: {
    minHeight: 44,
    paddingHorizontal: 12,
  },
  content: {
    flex: 1,
  },
});
