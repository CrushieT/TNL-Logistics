import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { colors } from '../../theme';

export function Keypad({ onKeyPress, onBackspace, disabled = false }) {
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'backspace'],
  ];

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, colIndex) => {
            if (key === '') {
              return <View key={colIndex} style={styles.keyPlaceholder} />;
            }

            if (key === 'backspace') {
              return (
                <TouchableOpacity
                  key={colIndex}
                  style={styles.key}
                  onPress={onBackspace}
                  disabled={disabled}
                  activeOpacity={0.6}
                >
                  <Icon source="backspace-outline" size={24} color={colors.ink} />
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={colIndex}
                style={styles.key}
                onPress={() => onKeyPress(key)}
                disabled={disabled}
                activeOpacity={0.6}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  key: {
    flex: 1,
    height: 64,
    marginHorizontal: 5,
    backgroundColor: colors.keypadBg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.keypadBorder,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  keyPlaceholder: {
    flex: 1,
    height: 64,
    marginHorizontal: 5,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  backspaceIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
});
