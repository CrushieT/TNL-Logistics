import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors } from '../../theme';

export function ActionCard({ iconName, title, subtitle, onPress }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrapper}>
        <Icon source={iconName} size={24} color={colors.ink} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 124,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 16,
    margin: 6,
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
