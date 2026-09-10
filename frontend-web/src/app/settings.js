import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import AppShell from '../components/layout/AppShell';
import PageHeader from '../components/layout/PageHeader';
import Toast from '../components/common/Toast';
import {
  getSystemSettings,
  updateSystemSettings,
  CompanyBrandingCard,
  CollectionWeightTrackingCard,
} from '../features/settings';
import { subscribeRealtimeEvents } from '../features/shipments';
import { colors, fonts, spacing, radius, type } from '../theme';

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [form, setForm] = useState({
    companyName: 'TNL Logistics',
    companyAddress: 'Manila Central Hub',
    companyContact: '0917-555-0000',
    billingEmail: 'billing@tnllogistics.ph',
    collectionDay: 'THURSDAY',
    volumetricDivisor: '5000',
    trackingPrefix: 'TRK',
    shipmentPrefix: 'SHP',
    trackingIdPrefixPreview: 'TRK-2026-',
    shipmentIdPrefixPreview: 'SHP-2026-',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await getSystemSettings();
      if (data) {
        setForm({
          companyName: data.companyName || '',
          companyAddress: data.companyAddress || '',
          companyContact: data.companyContact || '',
          billingEmail: data.billingEmail || '',
          collectionDay: data.collectionDay || 'THURSDAY',
          volumetricDivisor: String(data.volumetricDivisor || 5000),
          trackingPrefix: data.trackingPrefix || 'TRK',
          shipmentPrefix: data.shipmentPrefix || 'SHP',
          trackingIdPrefixPreview: data.trackingIdPrefixPreview || 'TRK-2026-',
          shipmentIdPrefixPreview: data.shipmentIdPrefixPreview || 'SHP-2026-',
        });
      }
    } catch (err) {
      console.warn('Failed to load system settings:', err?.message);
      setErrorMessage('Failed to load system settings from server. Displaying local configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Real-time SSE synchronization when settings are updated
  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (event.type === 'SETTINGS_UPDATED') {
        loadSettings();
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadSettings]);

  const handleChangeField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const validate = () => {
    const newErrors = {};

    if (!form.companyName.trim()) {
      newErrors.companyName = 'Business name is required';
    } else if (form.companyName.trim().length > 150) {
      newErrors.companyName = 'Business name must not exceed 150 characters';
    }

    if (!form.companyAddress.trim()) {
      newErrors.companyAddress = 'Hub address is required';
    } else if (form.companyAddress.trim().length > 255) {
      newErrors.companyAddress = 'Address must not exceed 255 characters';
    }

    if (!form.companyContact.trim()) {
      newErrors.companyContact = 'Contact number is required';
    } else if (form.companyContact.trim().length < 7) {
      newErrors.companyContact = 'Contact number must be at least 7 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.billingEmail.trim()) {
      newErrors.billingEmail = 'Billing email is required';
    } else if (!emailRegex.test(form.billingEmail.trim())) {
      newErrors.billingEmail = 'Please enter a valid billing email address';
    }

    const divisorNum = parseInt(form.volumetricDivisor, 10);
    if (!form.volumetricDivisor || isNaN(divisorNum)) {
      newErrors.volumetricDivisor = 'Volumetric divisor is required';
    } else if (divisorNum < 1000 || divisorNum > 10000) {
      newErrors.volumetricDivisor = 'Divisor must be between 1,000 and 10,000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const payload = {
        companyName: form.companyName.trim(),
        companyAddress: form.companyAddress.trim(),
        companyContact: form.companyContact.trim(),
        billingEmail: form.billingEmail.trim(),
        collectionDay: form.collectionDay,
        volumetricDivisor: parseInt(form.volumetricDivisor, 10),
      };

      const updated = await updateSystemSettings(payload);
      if (updated) {
        setForm((prev) => ({
          ...prev,
          companyName: updated.companyName,
          companyAddress: updated.companyAddress,
          companyContact: updated.companyContact,
          billingEmail: updated.billingEmail,
          collectionDay: updated.collectionDay,
          volumetricDivisor: String(updated.volumetricDivisor),
        }));
      }

      setSuccessMessage('Settings updated successfully.');
      setToastMessage('System settings saved.');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save system settings.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell activeNav="/settings">
      <ScrollView contentContainerStyle={styles.container}>
        <PageHeader eyebrow="CONFIGURATION" title="SETTINGS" />

        {/* Feedback Banners */}
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading system settings...</Text>
          </View>
        ) : (
          <View style={[styles.cardsGrid, !isDesktop && styles.cardsGridStacked]}>
            <CompanyBrandingCard
              form={form}
              errors={errors}
              onChangeField={handleChangeField}
            />

            <CollectionWeightTrackingCard
              form={form}
              errors={errors}
              onChangeField={handleChangeField}
              onSave={handleSave}
              saving={saving}
            />
          </View>
        )}
      </ScrollView>

      {toastMessage ? (
        <Toast
          message={toastMessage}
          type="success"
          onDismiss={() => setToastMessage(null)}
        />
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...type.body,
    color: colors.inkMuted,
    marginTop: spacing.md,
  },
  cardsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
  },
  cardsGridStacked: {
    flexDirection: 'column',
    gap: spacing.lg,
  },
  successBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: radius.xs,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
  },
  successText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#15803D',
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.xs,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '500',
  },
});
