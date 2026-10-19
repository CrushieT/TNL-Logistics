import React from 'react';
import { View, Text } from 'react-native';
import Button from './Button';
import { colors, spacing } from '../../theme';

export default function PreviewStatus({ resource, label = 'Data' }) {
  if (resource.isFresh) return null;
  const hasData = resource.data !== null;
  return <View style={{ padding: spacing.sm, marginBottom: spacing.sm }} accessibilityLiveRegion="polite">
    <Text style={{ color: colors.inkSoft }}>
      {resource.phase === 'error' ? `Unable to load ${label.toLowerCase()}.` : resource.phase === 'stale' ? `${label} may be stale.` : hasData ? `Refreshing ${label.toLowerCase()}.` : `Loading ${label.toLowerCase()}...`}
      {resource.timestamp && hasData ? ` Last updated ${new Date(resource.timestamp).toLocaleString()}.` : ''}
      {resource.error ? ` ${resource.error}` : ''}
    </Text>
    {['error', 'stale'].includes(resource.phase) ? <Button label="Retry" variant="secondary" onPress={() => resource.refresh(false)} /> : null}
  </View>;
}
