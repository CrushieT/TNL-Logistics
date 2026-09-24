import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../../theme';
import { shipmentApi } from '../services/shipmentApi';

export function ClientPicker({ onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [clients, setClients] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const data = await shipmentApi.listClients(search.trim(), page, controller.signal);
        if (controller.signal.aborted) return;
        const activeClients = (data.content || []).filter((client) => client.active === true);
        setClients((previous) => page === 0 ? activeClients : [
          ...previous, ...activeClients.filter((client) => !previous.some((entry) => entry.clientId === client.clientId)),
        ]);
        setHasMore(!data.last);
      } catch (requestError) {
        if (!controller.signal.aborted) setError('Unable to load clients. Check your connection and retry.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, page, attempt]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={typography.h2}>Select billing client</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close client selection" onPress={onClose} style={styles.button}>
            <Text style={styles.action}>Close</Text>
          </Pressable>
        </View>
        <TextInput
          accessibilityLabel="Search clients by name or client ID"
          placeholder="Search name or client ID"
          placeholderTextColor={colors.inkFaint}
          style={styles.search}
          value={search}
          onChangeText={(value) => {
            setSearch(value); setPage(0); setClients([]); setHasMore(false); setIsLoading(true); setError('');
          }}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <FlatList
          data={clients}
          keyExtractor={(client) => client.clientId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => onSelect(item)} style={styles.client}>
              <Text style={styles.code}>{item.clientId}</Text>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.address}>{item.address}</Text>
            </Pressable>
          )}
          ListEmptyComponent={!isLoading && !error ? <Text style={styles.empty}>No active clients found. Close this list and choose New to create one.</Text> : null}
          ListFooterComponent={
            <View style={styles.footer}>
              {isLoading ? <ActivityIndicator accessibilityLabel="Loading clients" color={colors.ink} /> : null}
              {error ? <>
                <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
                <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAttempt((value) => value + 1)}><Text style={styles.action}>Retry clients</Text></Pressable>
              </> : null}
              {!isLoading && !error && hasMore ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setIsLoading(true); setPage((value) => value + 1); }}><Text style={styles.action}>Load more clients</Text></Pressable> : null}
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderBottomWidth: 1, borderColor: colors.border },
  button: { minHeight: 44, padding: spacing.md, justifyContent: 'center', alignItems: 'center' },
  action: { fontSize: 14, fontWeight: '700', color: colors.ink },
  search: { margin: spacing.lg, padding: spacing.md, minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, fontSize: 16, color: colors.ink },
  list: { paddingHorizontal: spacing.lg },
  client: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm },
  code: { ...typography.mono, marginBottom: spacing.xs },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
  address: { ...typography.bodySmall, marginTop: spacing.xs },
  empty: { ...typography.body, paddingVertical: spacing.xl },
  footer: { paddingVertical: spacing.lg },
  error: { ...typography.body, color: colors.danger },
});
