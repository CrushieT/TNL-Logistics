import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../theme';
import { useOfflineSync } from '../../features/offline-sync/context/OfflineSyncContext';
import { acknowledgeOfflineQueueRow } from '../../features/offline-sync/services/offlineQueueStore';
import { useAuth } from '../../features/auth/context/AuthContext';

export default function OfflineQueueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { rows, isOnline, syncNow, refresh, isNativeOfflineSupported } = useOfflineSync();
  const acknowledge = async (row) => { await acknowledgeOfflineQueueRow(user.userId, row.clientEventId); await refresh(); };
  return <SafeAreaView style={styles.safeArea} edges={['top']}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>BACK</Text></TouchableOpacity><Text style={styles.title}>OFFLINE SCAN QUEUE</Text><View style={styles.spacer} /></View>
    <View style={styles.summary}><Text style={styles.summaryText}>{isNativeOfflineSupported ? (isOnline ? 'ONLINE - READY TO SYNC' : 'OFFLINE - SCANS SAVE ON DEVICE') : 'OFFLINE SCANNING IS AVAILABLE ON MOBILE ONLY'}</Text><TouchableOpacity disabled={!isOnline} onPress={() => void syncNow()}><Text style={styles.retry}>SYNC NOW</Text></TouchableOpacity></View>
    <FlatList data={rows} keyExtractor={(item) => item.clientEventId} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No offline scans are waiting.</Text>}
      renderItem={({ item }) => <View style={styles.card}><Text style={styles.tracking}>{item.trackingId}</Text><Text style={styles.detail}>{item.targetStatus}{item.vehicleId ? ` | ${item.vehicleId}` : ''}</Text><Text style={styles.detail}>{item.queueStatus}{item.lastOutcomeCode ? ` | ${item.lastOutcomeCode}` : ''}</Text>{['STALE', 'CONFLICT', 'REJECTED', 'BLOCKED'].includes(item.queueStatus) && <TouchableOpacity onPress={() => void acknowledge(item)}><Text style={styles.acknowledge}>ACKNOWLEDGE</Text></TouchableOpacity>}</View>} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safeArea:{flex:1,backgroundColor:colors.canvas},header:{height:56,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:colors.border},back:{fontWeight:'700',color:colors.accent,fontSize:12},title:{fontWeight:'800',color:colors.ink,fontSize:14},spacer:{width:36},summary:{padding:16,backgroundColor:colors.surface,flexDirection:'row',justifyContent:'space-between'},summaryText:{fontSize:11,fontWeight:'700',color:colors.inkSoft,flex:1},retry:{fontSize:12,fontWeight:'800',color:colors.accent},list:{padding:16,gap:10},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,padding:14,borderRadius:4},tracking:{fontFamily:'monospace',fontWeight:'800',color:colors.ink},detail:{fontSize:12,color:colors.inkSoft,marginTop:4},acknowledge:{fontSize:12,fontWeight:'800',color:colors.accent,marginTop:10},empty:{textAlign:'center',color:colors.inkSoft,paddingTop:48} });
