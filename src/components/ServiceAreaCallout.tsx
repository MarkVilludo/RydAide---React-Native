import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppConfig } from '../api/appConfig';
import { useAppConfig } from '../hooks/useAppConfig';
import { colors, radii, spacing } from '../theme/tokens';

export type ServiceAreaMessage = {
  title: string;
  body: string;
  tone: 'info' | 'warn';
};

export function buildServiceAreaMessage(config: AppConfig | null | undefined): ServiceAreaMessage | null {
  if (!config) return null;
  const area = config.rollout.area_label?.trim();
  const note = config.rollout.note?.trim();
  const emergency = config.features.emergency_assistance;
  const directory = config.features.directory;

  if (!emergency && directory) {
    return {
      tone: 'info',
      title: area ? `Directory in ${area}` : 'Roadside HELP isn’t live in your area yet',
      body:
        note ??
        'You can browse mechanics and shops. Live emergency dispatch and “Get help now” may not be available until we expand.',
    };
  }

  if (!emergency && !directory) {
    return {
      tone: 'warn',
      title: 'RydAid is still rolling out',
      body: note ?? 'Some features aren’t available in your area yet. Contact support if you need help.',
    };
  }

  if (note) {
    return {
      tone: 'info',
      title: area ? `Service area · ${area}` : 'Service area',
      body: note,
    };
  }

  if (!emergency) {
    return {
      tone: 'info',
      title: area ? `${area} — directory mode` : 'Limited mode',
      body: 'Emergency roadside HELP is off on the server. You can still use directory features where enabled.',
    };
  }

  return null;
}

type Props = {
  compact?: boolean;
  /** When true, skip if the only content would duplicate a one-line “Live in …” label. */
  hideWhenOnlyArea?: boolean;
};

export function ServiceAreaCallout({ compact, hideWhenOnlyArea }: Props) {
  const { config } = useAppConfig();
  const message = buildServiceAreaMessage(config);
  if (!message) {
    if (hideWhenOnlyArea && config?.rollout.area_label && config.features.emergency_assistance) {
      return null;
    }
    return null;
  }
  if (hideWhenOnlyArea && !config?.rollout.note?.trim() && config?.features.emergency_assistance) {
    return null;
  }

  const boxStyle = message.tone === 'warn' ? styles.warnBox : styles.infoBox;
  const titleStyle = message.tone === 'warn' ? styles.warnTitle : styles.infoTitle;

  return (
    <View style={[boxStyle, compact && styles.compact]} accessibilityRole="summary">
      <Text style={titleStyle}>{message.title}</Text>
      <Text style={styles.body}>{message.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { marginVertical: spacing.sm },
  infoBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    gap: spacing.xs,
  },
  warnBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: colors.warnBorder,
    gap: spacing.xs,
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: colors.primaryInk },
  warnTitle: { fontSize: 14, fontWeight: '800', color: colors.warnInk },
  body: { fontSize: 13, lineHeight: 18, color: colors.muted },
});