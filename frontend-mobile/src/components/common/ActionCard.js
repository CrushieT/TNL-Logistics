import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors } from '../../theme';
import { PressableScale } from './PressableScale';

export function ActionCard({
  iconName,
  title,
  subtitle,
  onPress,
  badge,
  style,
  contentStyle,
}) {
  return (
    <PressableScale
      style={[styles.cardWrapper, style]}
      contentStyle={[styles.card, contentStyle]}
      onPress={onPress}
      activeScale={0.97}
    >
      <View style={styles.topRow}>
        <View style={styles.iconWrapper}>
          <Icon source={iconName} size={24} color={colors.ink} />
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
    margin: 6,
  },
  card: {
    flex: 1,
    minHeight: 124,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrapper: {
    marginBottom: 0,
  },
  badge: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: colors.inkFaint,
    lineHeight: 15,
  },
});

