import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

export function PinIndicator({ length = 4, value = '' }) {
  const dots = Array.from({ length }, (_, i) => i);

  return (
    <View style={styles.container}>
      {dots.map((index) => {
        const isFilled = index < value.length;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              isFilled ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginHorizontal: 8,
  },
  dotEmpty: {
    backgroundColor: colors.pinDotEmpty,
  },
  dotFilled: {
    backgroundColor: colors.pinDotFilled,
  },
});
