import type { ChomboViolationType } from '@meitra/contracts/game';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { confirmAction } from '@/lib/confirm-action';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';

const violationTypes: ChomboViolationType[] = [
  'negri-forget', 'wrong-suit', 'four-jack', 'last-tanzen',
];

const violationLabelKeys: Record<ChomboViolationType, string> = {
  'negri-forget': 'chomboReport.negriForget',
  'wrong-suit': 'chomboReport.wrongSuit',
  'four-jack': 'chomboReport.fourJack',
  'last-tanzen': 'chomboReport.lastTanzen',
};

/** A report is irreversible and moves the score, so submitting only proposes it. */
function confirmReport(
  playerName: string,
  violationLabel: string,
  onConfirm: () => void,
): void {
  confirmAction({
    title: t('chomboReport.confirmTitle'),
    message: t('chomboReport.confirmMessage', {
      name: playerName,
      violation: violationLabel,
    }),
    confirmLabel: t('chomboReport.confirm'),
    onConfirm,
  });
}

interface Props {
  players: { seatId: string; name: string }[];
  onReport: (seatId: string, type: ChomboViolationType) => void;
  /** Runs once the report is confirmed, so the sheet holding the form can close. */
  onReported?: () => void;
}

type OpenMenu = 'player' | 'violation' | null;

/** Same form as the web dock (ChomboReportPanel.tsx): pick a player, pick a violation, report. */
export function ChomboReportPanel({ players, onReport, onReported }: Props) {
  const [chosenSeatId, setChosenSeatId] = useState<string | null>(null);
  const [violationType, setViolationType] =
    useState<ChomboViolationType>('negri-forget');
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  // The chosen player can drop out of the list (their seat turns COM), so the
  // form falls back to the first player rather than reporting a stale seat.
  const target =
    players.find((player) => player.seatId === chosenSeatId) ?? players[0];

  if (!target) return null;

  const toggleMenu = (menu: Exclude<OpenMenu, null>) =>
    setOpenMenu((open) => (open === menu ? null : menu));

  return (
    <View accessibilityLabel={t('chomboReport.title')} style={styles.panel}>
      <Text style={styles.label}>{t('chomboReport.player')}</Text>
      <Dropdown
        label={t('chomboReport.player')}
        onChange={(seatId) => {
          setChosenSeatId(seatId);
          setOpenMenu(null);
        }}
        onToggle={() => toggleMenu('player')}
        open={openMenu === 'player'}
        options={players.map((player) => ({
          value: player.seatId,
          label: player.name,
        }))}
        testID="chombo-report-player"
        value={target.seatId}
      />

      <Text style={styles.label}>{t('chomboReport.violation')}</Text>
      <Dropdown
        label={t('chomboReport.violation')}
        onChange={(type) => {
          setViolationType(type);
          setOpenMenu(null);
        }}
        onToggle={() => toggleMenu('violation')}
        open={openMenu === 'violation'}
        options={violationTypes.map((type) => ({
          value: type,
          label: t(violationLabelKeys[type]),
        }))}
        testID="chombo-report-violation"
        value={violationType}
      />

      <Button
        onPress={() => {
          setOpenMenu(null);
          confirmReport(target.name, t(violationLabelKeys[violationType]), () => {
            onReport(target.seatId, violationType);
            onReported?.();
          });
        }}
        style={styles.submit}
        testID="chombo-report-submit"
      >
        {t('chomboReport.submit')}
      </Button>
    </View>
  );
}

interface DropdownProps<T extends string> {
  label: string;
  onChange: (value: T) => void;
  onToggle: () => void;
  open: boolean;
  options: { value: T; label: string }[];
  testID: string;
  value: T;
}

/**
 * React Native has no select, so this opens the options under the field, like
 * the web form's <select>. Inline, because a floating list would be clipped by
 * the sheet.
 */
function Dropdown<T extends string>({
  label,
  onChange,
  onToggle,
  open,
  options,
  testID,
  value,
}: DropdownProps<T>) {
  const selected = options.find((option) => option.value === value);

  return (
    <View>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.field,
          open && styles.fieldOpen,
          pressed && styles.pressed,
        ]}
        testID={testID}
      >
        <Text
          numberOfLines={1}
          style={styles.optionLabel}
          testID={`${testID}-value`}
        >
          {selected?.label}
        </Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View accessibilityRole="radiogroup" style={styles.menu}>
          {options.map((option, index) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: option.value === value }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.menuItem,
                index > 0 && styles.menuItemDivider,
                pressed && styles.pressed,
              ]}
              testID={`${testID}-${option.value}`}
            >
              <Text numberOfLines={1} style={styles.optionLabel}>
                {option.label}
              </Text>
              {option.value === value ? (
                <Text style={styles.check}>✓</Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  field: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  fieldOpen: {
    borderColor: colors.gold,
  },
  optionLabel: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 15,
  },
  check: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 13,
  },
  menu: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelStrong,
    overflow: 'hidden',
  },
  menuItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
  },
  menuItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  submit: {
    marginTop: 4,
  },
});
