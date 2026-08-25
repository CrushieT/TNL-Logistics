import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import Toast from '../components/common/Toast';
import { ShipmentForm, ShipmentResultView, PrintLabelsModal, registerShipment } from '../features/shipments';
import { listClients, createClient } from '../features/clients';
import { colors, fonts, spacing, radius } from '../theme';

export default function RegisterShipmentScreen() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load clients from backend GET /api/v1/clients
  useEffect(() => {
    let isMounted = true;
    listClients()
      .then((data) => {
        if (isMounted) {
          if (data && data.length > 0) {
            setClients(data);
          } else {
            setClients([{ id: 'CL-001', code: 'CL-001', name: 'Northbridge Trading' }]);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Could not load clients from server:', err?.message);
          setClients([{ id: 'CL-001', code: 'CL-001', name: 'Northbridge Trading' }]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = useCallback(async (payload) => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      let finalClientId = payload.clientId;
      let finalClientName = '';

      // If user selected "+ New" and entered a new client, register the client first
      if (payload.newClient) {
        const createdClient = await createClient(payload.newClient);
        finalClientId = createdClient.id;
        finalClientName = createdClient.name;

        // Permanently add the newly registered client to state for dropdown reusability
        setClients((prev) => [...prev, createdClient]);
      } else {
        const clientRecord = clients.find((c) => c.id === payload.clientId);
        finalClientName = clientRecord?.name || 'Northbridge Trading';
      }

      const response = await registerShipment({
        ...payload,
        clientId: finalClientId,
        clientName: finalClientName,
      });

      // Successful backend registration
      setResult(response);
      setToastVisible(true);
    } catch (err) {
      console.error('Shipment registration failed:', err);

      // Extract accurate server or network error message
      let msg = 'Failed to register shipment.';
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.response?.data?.errors) {
        const errList = Object.values(err.response.data.errors).join(', ');
        msg = `Validation Error: ${errList}`;
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        msg = 'Unable to connect to the backend server (http://localhost:8080). Please ensure the Spring Boot server is running.';
      } else if (err.response?.status === 403) {
        msg = 'Access denied. You do not have permission to register shipments.';
      } else if (err.message) {
        msg = err.message;
      }

      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }, [clients]);

  if (result) {
    return (
      <AppShell>
        <ShipmentResultView
          shipment={result}
          onRegisterAnother={() => {
            setResult(null);
            setErrorMessage(null);
          }}
          onViewShipment={() => router.push(`/shipments/${result.shipmentId}`)}
          onPreviewLabels={() => setModalVisible(true)}
        />
        <PrintLabelsModal
          visible={modalVisible}
          shipment={result}
          onClose={() => setModalVisible(false)}
          onPrint={() => setModalVisible(false)}
        />
        <Toast
          visible={toastVisible}
          message={`✓ Shipment ${result.shipmentId} registered · ${result.units.length} QR codes generated`}
          onDismiss={() => setToastVisible(false)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Scenario 1 · Encode & Identify" title="Register Shipment" />

      {/* Error Alert Banner */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <View style={styles.errorTextCol}>
            <Text style={styles.errorTitle}>Registration Error</Text>
            <Text style={styles.errorBody}>{errorMessage}</Text>
          </View>
          <TouchableOpacity onPress={() => setErrorMessage(null)} style={styles.errorCloseBtn}>
            <Text style={styles.errorCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ShipmentForm
        clients={clients}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  errorTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  errorTitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  errorBody: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 16,
  },
  errorCloseBtn: {
    padding: 4,
  },
  errorCloseText: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '700',
  },
});
