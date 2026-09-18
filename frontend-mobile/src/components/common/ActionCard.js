import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors } from '../../theme';
import { PressableScale } from './PressableScale';

export function ActionCard({ iconName, title, subtitle, onPress }) {
  return (
    <PressableScale
      style={styles.cardWrapper}
      contentStyle={styles.card}
      onPress={onPress}
      activeScale={0.96}
    >
      <View style={styles.iconWrapper}>
        <Icon source={iconName} size={24} color={colors.ink} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
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
  iconWrapper: {
    marginBottom: 8,
  },
  iconText: {
    fontSize: 22,
    color: colors.ink,
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
