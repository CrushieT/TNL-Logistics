import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusModal } from '../../../components/common/StatusModal';
import { BackButton } from '../../../components/common/BackButton';
import { colors, spacing, typography } from '../../../theme';
import { ClientPicker } from './ClientPicker';
import { RegistrationResult } from './RegistrationResult';
import { shipmentApi } from '../services/shipmentApi';
import {
  calculateRegistration, createRegistrationForm, createShipmentSubmitter,
  isUncertainWrite, mapRegistrationErrors, validateRegistration,
} from '../registration.mjs';

function FormField({ name, label, form, errors, onChange, isSubmitting, inputRefs, fieldRefs, ...props }) {
  return (
    <View ref={(node) => { fieldRefs.current[name] = node; }} collapsable={false} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={(node) => { inputRefs.current[name] = node; }}
        accessibilityLabel={label}
        accessibilityHint={errors[name] || undefined}
        value={form[name]}
        onChangeText={(value) => onChange(name, value)}
        editable={!isSubmitting}
        placeholderTextColor={colors.inkFaint}
        style={[styles.input, errors[name] && styles.inputError]}
        {...props}
      />
      {errors[name] ? <Text accessibilityRole="alert" style={styles.error}>{errors[name]}</Text> : null}
    </View>
  );
}

function formatMeasure(value, digits, suffix) {
  return value === null ? '—' : `${value.toFixed(digits)} ${suffix}`;
}

export function RegistrationScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { width, fontScale } = useWindowDimensions();
  const shouldStack = width < 360 || fontScale > 1.25;

  const [form, setForm] = useState(createRegistrationForm);
  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [result, setResult] = useState(null);

  const [divisor, setDivisor] = useState(null);
  const [ratePerKilo, setRatePerKilo] = useState(null);
  const [settingsState, setSettingsState] = useState('loading');
  const [settingsAttempt, setSettingsAttempt] = useState(0);

  const [dialog, setDialog] = useState(null);
  const [uncertainStage, setUncertainStage] = useState(null);

  const pendingQuantity = useRef(null);
  const unitToRemove = useRef(null);

  const isActive = useRef(true);
  const isSending = useRef(false);
  const canLeave = useRef(false);
  const pendingAction = useRef(null);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const fieldRefs = useRef({});
  const inputRefs = useRef({});
  const submitter = useRef(null);

  if (!submitter.current) submitter.current = createShipmentSubmitter(shipmentApi, () => isActive.current);

  const isDirty = !result && (
    form.clientId !== '' ||
    form.clientMode === 'NEW' ||
    form.recipientAddress !== '' ||
    form.recipientContact !== '' ||
    form.parcels.length > 1 ||
    Boolean(form.parcels[0]?.weightKg || form.parcels[0]?.lengthCm || form.parcels[0]?.widthCm || form.parcels[0]?.heightCm)
  );

  const totals = calculateRegistration(form, divisor, ratePerKilo);

  useEffect(() => {
    isActive.current = true;
    return () => { isActive.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSettingsState('loading');
    shipmentApi.getCalculationSettings(controller.signal).then((settings) => {
      if (controller.signal.aborted) return;
      if (!Number.isFinite(settings.volumetricDivisor) || settings.volumetricDivisor <= 0) {
        throw new Error('Missing divisor');
      }
      setDivisor(settings.volumetricDivisor);
      const rate = (settings.ratePerKilo !== null && settings.ratePerKilo !== undefined)
        ? Number(settings.ratePerKilo) : null;
      if (rate === null || !Number.isFinite(rate) || rate <= 0) {
        setRatePerKilo(null);
        setSettingsState('unconfigured');
      } else {
        setRatePerKilo(rate);
        setSettingsState('ready');
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setDivisor(null);
        setRatePerKilo(null);
        setSettingsState('error');
      }
    });
    return () => controller.abort();
  }, [settingsAttempt]);

  const navigateHome = () => {
    canLeave.current = true;
    router.replace('/(main)');
  };

  const requestBack = () => {
    if (isSending.current) return;
    if (isDirty) { pendingAction.current = null; setDialog('discard'); }
    else navigateHome();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (canLeave.current || !isActive.current || (!isDirty && !isSending.current)) return;
      event.preventDefault();
      if (!isSending.current) { pendingAction.current = event.data.action; setDialog('discard'); }
    });
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSending.current) return true;
      if (isDirty) { pendingAction.current = null; setDialog('discard'); return true; }
      return false;
    });
    return () => { unsubscribe(); subscription.remove(); };
  }, [isDirty, navigation]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !isDirty) return undefined;
    const preventUnload = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [isDirty]);

  function changeField(name, value) {
    const nextValue = (name === 'recipientContact' || name === 'newClientContact')
      ? value.replace(/[^0-9]/g, '')
      : value;
    setForm((previous) => ({ ...previous, [name]: nextValue }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  function handleQuantityChange(value) {
    const sanitized = value.replace(/[^0-9]/g, '');
    const newQty = parseInt(sanitized, 10);

    if (isNaN(newQty) || newQty < 1) {
      setForm((prev) => ({ ...prev, quantity: sanitized }));
      return;
    }

    const targetQty = Math.min(newQty, 1000);
    const currentLength = form.parcels.length;

    if (targetQty > currentLength) {
      const added = Array.from({ length: targetQty - currentLength }, (_, i) => ({
        id: `unit-${Date.now()}-${currentLength + i + 1}`,
        seq: currentLength + i + 1,
        weightKg: '',
        lengthCm: '',
        widthCm: '',
        heightCm: '',
      }));
      setForm((prev) => ({
        ...prev,
        quantity: String(targetQty),
        parcels: [...prev.parcels, ...added],
      }));
      setErrors((prev) => ({ ...prev, quantity: undefined }));
    } else if (targetQty < currentLength) {
      const discardedUnits = form.parcels.slice(targetQty);
      const isPopulated = discardedUnits.some(
        (u) => parseFloat(u.weightKg) > 0 || parseFloat(u.lengthCm) > 0 || parseFloat(u.widthCm) > 0 || parseFloat(u.heightCm) > 0
      );

      if (isPopulated) {
        pendingQuantity.current = targetQty;
        setDialog('discard_units');
      } else {
        setForm((prev) => ({
          ...prev,
          quantity: String(targetQty),
          parcels: prev.parcels.slice(0, targetQty),
        }));
        setErrors((prev) => ({ ...prev, quantity: undefined }));
      }
    } else {
      setForm((prev) => ({ ...prev, quantity: String(targetQty) }));
      setErrors((prev) => ({ ...prev, quantity: undefined }));
    }
  }

  function handleAddUnit() {
    if (form.parcels.length >= 1000) return;
    const nextSeq = form.parcels.length + 1;
    const newUnit = {
      id: `unit-${Date.now()}-${nextSeq}`,
      seq: nextSeq,
      weightKg: '',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
    };
    setForm((prev) => ({
      ...prev,
      quantity: String(nextSeq),
      parcels: [...prev.parcels, newUnit],
    }));
    setErrors((prev) => ({ ...prev, quantity: undefined }));
  }

  function handleRequestRemoveUnit(index) {
    if (form.parcels.length <= 1) return;
    const unit = form.parcels[index];
    const isPopulated = parseFloat(unit.weightKg) > 0 || parseFloat(unit.lengthCm) > 0 ||
      parseFloat(unit.widthCm) > 0 || parseFloat(unit.heightCm) > 0;

    if (isPopulated) {
      unitToRemove.current = index;
      setDialog('remove_unit');
    } else {
      performRemoveUnit(index);
    }
  }

  function performRemoveUnit(index) {
    const updated = form.parcels.filter((_, i) => i !== index).map((p, i) => ({ ...p, seq: i + 1 }));
    setForm((prev) => ({
      ...prev,
      quantity: String(updated.length),
      parcels: updated,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith('parcels[')) delete next[k];
      });
      return next;
    });
  }

  function updateParcelField(index, fieldName, value) {
    const sanitized = value.replace(/[^0-9.]/g, '');
    setForm((prev) => {
      const updated = [...prev.parcels];
      updated[index] = { ...updated[index], [fieldName]: sanitized };
      return { ...prev, parcels: updated };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`parcels[${index}].${fieldName}`];
      return next;
    });
  }

  function focusFirstError(fieldErrors) {
    const name = Object.keys(fieldErrors)[0];
    requestAnimationFrame(() => {
      if (!isActive.current) return;
      fieldRefs.current[name]?.measureLayout(contentRef.current, (_left, top) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, top - 16), animated: true });
      }, () => {});
      inputRefs.current[name]?.focus();
    });
  }

  async function handleSubmit(hasCheckedPreviousAttempt = false) {
    if (isSending.current) return;
    if (uncertainStage && !hasCheckedPreviousAttempt) { setDialog('retry'); return; }

    const validationErrors = validateRegistration(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) { focusFirstError(validationErrors); return; }

    isSending.current = true;
    setIsSubmitting(true);
    setErrorMessage('');
    setUncertainStage(null);
    Keyboard.dismiss();

    try {
      const guards = {
        expectedRatePerKilo: ratePerKilo,
        expectedVolumetricDivisor: divisor,
      };

      const shipment = await submitter.current(form, (client) => {
        setForm((previous) => ({ ...previous, clientMode: 'EXISTING', clientId: client.clientId, clientName: client.name }));
      }, guards);

      if (shipment && isActive.current) {
        setResult(shipment);
        setForm(createRegistrationForm());
      }
    } catch (error) {
      if (!isActive.current || error.response?.status === 401) return;

      if (error.response?.status === 409) {
        setSettingsAttempt((c) => c + 1);
        const code = error.response?.data?.code;
        if (code === 'RATE_PER_KILO_NOT_CONFIGURED') {
          setErrorMessage('Shipment registration is blocked because Rate per Kilo is not configured on the server. Please ask an administrator to set the rate in Settings.');
        } else {
          setErrorMessage('Rate or calculation settings were updated on the server. Totals have been refreshed. Please review and resubmit.');
        }
        return;
      }

      const fieldErrors = mapRegistrationErrors(error, true);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length) focusFirstError(fieldErrors);

      if (isUncertainWrite(error)) {
        setUncertainStage(error.registrationStage);
        setErrorMessage(error.registrationStage === 'client'
          ? 'We could not confirm whether the client was created. Check Existing clients before retrying to avoid a duplicate.'
          : 'We could not confirm whether the shipment was registered. Check the web shipment directory before retrying to avoid a duplicate shipment or payment.');
      } else {
        setErrorMessage(error.response?.status === 403 ? 'You do not have permission to register shipments.'
          : error.response?.data?.message || 'Registration failed. Review the details and try again.');
      }
    } finally {
      isSending.current = false;
      if (isActive.current) setIsSubmitting(false);
    }
  }

  const field = (name, label, props = {}) => (
    <FormField
      key={name}
      {...{ name, label, form, errors, isSubmitting, inputRefs, fieldRefs }}
      onChange={changeField}
      {...props}
    />
  );
  const rowStyle = [styles.row, shouldStack && styles.stacked];
  const numericProps = { keyboardType: 'decimal-pad', inputMode: 'decimal', maxLength: 9 };

  const derivedRecipientName = form.clientMode === 'EXISTING'
    ? (form.clientName || 'Select a billing client')
    : (form.newClientName || 'Enter client name');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <BackButton accessibilityLabel="Back to office home" disabled={isSubmitting} onPress={requestBack} />
        <Text accessibilityRole="header" style={styles.headerTitle}>{result ? 'SHIPMENT REGISTERED' : 'REGISTER SHIPMENT'}</Text>
      </View>
      {result ? <RegistrationResult
        shipment={result}
        onHome={navigateHome}
        onRegisterAnother={() => {
          submitter.current = createShipmentSubmitter(shipmentApi, () => isActive.current);
          setResult(null); setErrors({}); setErrorMessage(''); setUncertainStage(null);
        }}
      /> : <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View ref={contentRef} collapsable={false} style={styles.content}>
            <Text style={styles.intro}>Shipment and tracking numbers are assigned on registration.</Text>
            {errorMessage ? <Text accessibilityRole="alert" style={styles.errorBanner}>{errorMessage}</Text> : null}

            {/* 1. Client Card */}
            <View style={styles.panel}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Client / Billing Party</Text>
              <View style={styles.toggle}>
                {['EXISTING', 'NEW'].map((mode) => <Pressable
                  key={mode} accessibilityRole="button" accessibilityState={{ selected: form.clientMode === mode, disabled: isSubmitting }} disabled={isSubmitting}
                  onPress={() => { changeField('clientMode', mode); setErrors({}); }}
                  style={[styles.toggleButton, form.clientMode === mode && styles.toggleActive]}
                ><Text style={[styles.toggleText, form.clientMode === mode && styles.toggleActiveText]}>{mode === 'EXISTING' ? 'Existing' : '+ New'}</Text></Pressable>)}
              </View>
              {form.clientMode === 'EXISTING' ? <View ref={(node) => { fieldRefs.current.clientId = node; }} collapsable={false}>
                <Text style={styles.label}>SELECT CLIENT *</Text>
                <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => setIsPickerOpen(true)} style={[styles.clientButton, errors.clientId && styles.inputError]}>
                  <Text style={styles.clientText}>{form.clientId ? `${form.clientId} · ${form.clientName}` : 'Choose billing client'}</Text>
                  <Text style={styles.clientArrow}>⌄</Text>
                </Pressable>
                {errors.clientId ? <Text accessibilityRole="alert" style={styles.error}>{errors.clientId}</Text> : null}
                <Text style={styles.helper}>Shipments are billed together on the client’s statement of account.</Text>
              </View> : <>
                {field('newClientName', 'CLIENT / COMPANY NAME *', { placeholder: 'Company or client name', maxLength: 150 })}
                {field('newClientAddress', 'BILLING ADDRESS *', { placeholder: 'Street, city, province', multiline: true, maxLength: 255 })}
                {field('newClientContact', 'CONTACT NUMBER *', { keyboardType: 'phone-pad', inputMode: 'numeric', maxLength: 11, placeholder: '09XXXXXXXXX' })}
                {field('newClientEmail', 'EMAIL ADDRESS', { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false, maxLength: 150 })}
              </>}
            </View>

            {/* 2. Recipient Card (Derived Recipient Name, Editable Address & Contact) */}
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Recipient</Text>
              <View style={styles.derivedRecipientContainer}>
                <Text style={styles.label}>RECIPIENT / CONSIGNEE</Text>
                <View style={styles.derivedRecipientBox}>
                  <Text style={styles.derivedRecipientName}>{derivedRecipientName}</Text>
                  <Text style={styles.helper}>Automatically derived from billing client.</Text>
                </View>
              </View>
              {field('recipientAddress', 'COMPLETE ADDRESS *', { placeholder: 'Unit, street, barangay, city, province', multiline: true, maxLength: 255 })}
              {field('recipientContact', 'CONTACT NUMBER *', { keyboardType: 'phone-pad', inputMode: 'numeric', maxLength: 11, placeholder: '09XXXXXXXXX' })}
            </View>

            {/* 3. Parcel Details & Per-Unit Editor */}
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Parcel Details</Text>
              {field('description', 'DESCRIPTION', { placeholder: 'General Goods', maxLength: 255 })}
              {field('route', 'ROUTE', { placeholder: 'Manila to TNL Labo C.N.', maxLength: 150 })}

              <View style={styles.quantityRow}>
                <View style={styles.quantityFieldWrapper}>
                  <Text style={styles.label}>QUANTITY (PARCEL UNITS) *</Text>
                  <TextInput
                    accessibilityLabel="Quantity in parcel units"
                    value={form.quantity}
                    onChangeText={handleQuantityChange}
                    editable={!isSubmitting}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1"
                    placeholderTextColor={colors.inkFaint}
                    style={[styles.input, errors.quantity && styles.inputError]}
                  />
                  {errors.quantity ? <Text accessibilityRole="alert" style={styles.error}>{errors.quantity}</Text> : null}
                  <Text style={styles.helper}>1–1,000 units. One QR generated per unit.</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting || form.parcels.length >= 1000}
                  onPress={handleAddUnit}
                  style={styles.addUnitButton}
                >
                  <Text style={styles.addUnitButtonText}>+ Add Unit #{form.parcels.length + 1}</Text>
                </Pressable>
              </View>

              {/* Per-Unit Cards */}
              <View style={styles.unitsSection}>
                <Text style={styles.unitsHeaderTitle}>
                  PARCEL UNITS ({form.parcels.length} {form.parcels.length === 1 ? 'UNIT' : 'UNITS'}) · PER-UNIT MEASUREMENTS
                </Text>

                {form.parcels.map((parcel, index) => {
                  const l = parseFloat(parcel.lengthCm);
                  const w = parseFloat(parcel.widthCm);
                  const h = parseFloat(parcel.heightCm);
                  const hasDims = !isNaN(l) && l > 0 && !isNaN(w) && w > 0 && !isNaN(h) && h > 0;
                  const unitVol = hasDims ? (l * w * h) / 1000000 : null;

                  return (
                    <View key={parcel.id || `parcel-${index}`} style={styles.unitCard}>
                      <View style={styles.unitCardHeader}>
                        <View style={styles.unitBadge}>
                          <Text style={styles.unitBadgeText}>UNIT #{parcel.seq}</Text>
                        </View>
                        {unitVol !== null ? (
                          <Text style={styles.unitVolumeTag}>{formatMeasure(unitVol, 4, 'm³')}</Text>
                        ) : null}
                        {form.parcels.length > 1 ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove unit ${parcel.seq}`}
                            disabled={isSubmitting}
                            onPress={() => handleRequestRemoveUnit(index)}
                            style={styles.removeUnitBtn}
                          >
                            <Text style={styles.removeUnitBtnText}>✕ Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>

                      <View style={rowStyle}>
                        <View style={styles.unitFieldCol}>
                          <Text style={styles.label}>WEIGHT (KG) *</Text>
                          <TextInput
                            accessibilityLabel={`Unit ${parcel.seq} weight`}
                            value={parcel.weightKg}
                            onChangeText={(val) => updateParcelField(index, 'weightKg', val)}
                            editable={!isSubmitting}
                            placeholder="1.0"
                            placeholderTextColor={colors.inkFaint}
                            style={[styles.input, errors[`parcels[${index}].weightKg`] && styles.inputError]}
                            {...numericProps}
                          />
                          {errors[`parcels[${index}].weightKg`] ? (
                            <Text accessibilityRole="alert" style={styles.error}>{errors[`parcels[${index}].weightKg`]}</Text>
                          ) : null}
                        </View>

                        <View style={styles.unitFieldCol}>
                          <Text style={styles.label}>LENGTH (CM) *</Text>
                          <TextInput
                            accessibilityLabel={`Unit ${parcel.seq} length`}
                            value={parcel.lengthCm}
                            onChangeText={(val) => updateParcelField(index, 'lengthCm', val)}
                            editable={!isSubmitting}
                            placeholder="20"
                            placeholderTextColor={colors.inkFaint}
                            style={[styles.input, errors[`parcels[${index}].lengthCm`] && styles.inputError]}
                            {...numericProps}
                          />
                          {errors[`parcels[${index}].lengthCm`] ? (
                            <Text accessibilityRole="alert" style={styles.error}>{errors[`parcels[${index}].lengthCm`]}</Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={rowStyle}>
                        <View style={styles.unitFieldCol}>
                          <Text style={styles.label}>WIDTH (CM) *</Text>
                          <TextInput
                            accessibilityLabel={`Unit ${parcel.seq} width`}
                            value={parcel.widthCm}
                            onChangeText={(val) => updateParcelField(index, 'widthCm', val)}
                            editable={!isSubmitting}
                            placeholder="10"
                            placeholderTextColor={colors.inkFaint}
                            style={[styles.input, errors[`parcels[${index}].widthCm`] && styles.inputError]}
                            {...numericProps}
                          />
                          {errors[`parcels[${index}].widthCm`] ? (
                            <Text accessibilityRole="alert" style={styles.error}>{errors[`parcels[${index}].widthCm`]}</Text>
                          ) : null}
                        </View>

                        <View style={styles.unitFieldCol}>
                          <Text style={styles.label}>HEIGHT (CM) *</Text>
                          <TextInput
                            accessibilityLabel={`Unit ${parcel.seq} height`}
                            value={parcel.heightCm}
                            onChangeText={(val) => updateParcelField(index, 'heightCm', val)}
                            editable={!isSubmitting}
                            placeholder="15"
                            placeholderTextColor={colors.inkFaint}
                            style={[styles.input, errors[`parcels[${index}].heightCm`] && styles.inputError]}
                            {...numericProps}
                          />
                          {errors[`parcels[${index}].heightCm`] ? (
                            <Text accessibilityRole="alert" style={styles.error}>{errors[`parcels[${index}].heightCm`]}</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 4. Live Rating & Summary */}
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Rating & Summary</Text>

              <View style={styles.rateCard}>
                <Text style={styles.label}>RATE PER KILO</Text>
                <Text style={styles.rateValue}>
                  {ratePerKilo !== null ? `₱${ratePerKilo.toFixed(2)} / kg` : '—'}
                </Text>
                <Text style={styles.helper}>Configured by administrator.</Text>
              </View>

              <View style={styles.calculations}>
                <Text style={styles.label}>WEIGHT & VOLUME BREAKDOWN</Text>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Total Actual Weight</Text>
                  <Text style={styles.metricValue}>{formatMeasure(totals.actualWeight, 2, 'kg')}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Volumetric Weight (/{divisor || 5000})</Text>
                  <Text style={styles.metricValue}>{formatMeasure(totals.volumetricWeight, 2, 'kg')}</Text>
                </View>
                <View style={[styles.metricRow, styles.billableMetricRow]}>
                  <Text style={styles.billableLabel}>Billable Weight</Text>
                  <Text style={styles.billableValue}>{formatMeasure(totals.billableWeight, 2, 'kg')}</Text>
                </View>
              </View>

              {field('otherCharges', 'OTHER CHARGES (₱)', { ...numericProps, maxLength: 13, placeholder: '0' })}

              <View style={styles.totalBox}>
                <Text style={styles.label}>TOTAL AMOUNT</Text>
                <Text style={styles.total}>
                  {totals.totalAmount !== null
                    ? `₱${totals.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </Text>
                <Text style={styles.helper}>
                  {totals.shippingFee !== null ? `₱${totals.shippingFee.toFixed(2)} shipping` : '—'}
                  {` + ₱${(parseFloat(form.otherCharges) || 0).toFixed(2)} charges`}
                </Text>
              </View>

              {settingsState === 'loading' ? (
                <View style={styles.settingsNotice}>
                  <ActivityIndicator size="small" color={colors.inkSoft} />
                  <Text style={styles.helper}>Loading rate and calculation settings from server…</Text>
                </View>
              ) : null}

              {settingsState === 'unconfigured' ? (
                <View style={styles.unconfiguredBox}>
                  <Text style={styles.unconfiguredTitle}>Rate per Kilo Not Configured</Text>
                  <Text style={styles.unconfiguredText}>
                    Shipment registration is blocked because Rate per Kilo is not configured. An administrator must set the rate in Settings before shipments can be registered.
                  </Text>
                </View>
              ) : null}

              {settingsState === 'error' ? (
                <View style={styles.errorBox}>
                  <Text style={styles.unconfiguredTitle}>Settings Unavailable</Text>
                  <Text style={styles.unconfiguredText}>
                    Unable to load calculation settings from server. Check connection and retry.
                  </Text>
                  <Pressable accessibilityRole="button" style={styles.retry} onPress={() => setSettingsAttempt((v) => v + 1)}>
                    <Text style={styles.retryText}>Retry settings</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.paymentRow}>
                <Switch
                  accessibilityLabel="Paid at registration"
                  value={form.paidAtRegistration}
                  disabled={isSubmitting}
                  onValueChange={(value) => changeField('paidAtRegistration', value)}
                  trackColor={{ false: colors.border, true: colors.black }}
                  thumbColor={colors.surface}
                />
                <View style={styles.paymentCopy}>
                  <Text style={styles.paymentTitle}>Paid at Registration</Text>
                  <Text style={styles.helper}>
                    {form.paidAtRegistration ? 'Records the full amount as an immediate cash payment.' : 'Unpaid. To be billed in the statement of account.'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting || settingsState !== 'ready', busy: isSubmitting }}
            disabled={isSubmitting || settingsState !== 'ready'}
            onPress={() => handleSubmit()}
            style={[styles.submit, (isSubmitting || settingsState !== 'ready') && styles.disabled]}
          >
            {isSubmitting ? <ActivityIndicator color={colors.surface} /> : null}
            <Text style={styles.submitText}>
              {isSubmitting
                ? 'REGISTERING…'
                : uncertainStage
                  ? 'REVIEW BEFORE RETRY'
                  : `REGISTER & GENERATE ${form.parcels.length} QR`}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>}
      {isPickerOpen ? <ClientPicker onClose={() => setIsPickerOpen(false)} onSelect={(client) => {
        setForm((previous) => ({ ...previous, clientId: client.clientId, clientName: client.name }));
        setErrors((previous) => ({ ...previous, clientId: undefined }));
        if (uncertainStage === 'client') { setUncertainStage(null); setErrorMessage(''); }
        setIsPickerOpen(false);
      }} /> : null}
      <StatusModal
        visible={dialog !== null} eyebrow="SHIPMENT REGISTRATION"
        title={
          dialog === 'discard' ? 'Discard this shipment?'
          : dialog === 'discard_units' ? 'Discard excess units?'
          : dialog === 'remove_unit' ? `Remove Unit #${(unitToRemove.current ?? 0) + 1}?`
          : 'Check before retrying'
        }
        message={
          dialog === 'discard'
            ? 'Your unsaved shipment details will be discarded. A client already created will remain in the client directory.'
          : dialog === 'discard_units'
            ? `Reducing quantity to ${pendingQuantity.current} will discard units with entered measurements.`
          : dialog === 'remove_unit'
            ? 'This unit contains entered measurements that will be removed.'
          : uncertainStage === 'client'
            ? 'Check Existing clients first. If the client was created, select it instead. Retry only after confirming it was not created.'
            : 'Check the web shipment directory first. Retry only after confirming this shipment was not created; another submission can create a duplicate payment.'
        }
        confirmText={
          dialog === 'discard' ? 'Discard'
          : dialog === 'discard_units' ? 'Discard Units'
          : dialog === 'remove_unit' ? 'Remove'
          : 'Checked; retry'
        }
        cancelText={dialog === 'discard' || dialog === 'discard_units' || dialog === 'remove_unit' ? 'Cancel' : 'Cancel'}
        onCancel={() => {
          if (dialog === 'discard_units') {
            setForm((prev) => ({ ...prev, quantity: String(prev.parcels.length) }));
          }
          pendingQuantity.current = null;
          unitToRemove.current = null;
          setDialog(null);
        }}
        onConfirm={() => {
          const currentDialog = dialog;
          setDialog(null);
          if (currentDialog === 'discard') {
            canLeave.current = true;
            if (pendingAction.current) navigation.dispatch(pendingAction.current);
            else navigateHome();
          } else if (currentDialog === 'discard_units') {
            const target = pendingQuantity.current;
            pendingQuantity.current = null;
            if (target && target >= 1) {
              setForm((prev) => ({
                ...prev,
                quantity: String(target),
                parcels: prev.parcels.slice(0, target),
              }));
              setErrors((prev) => ({ ...prev, quantity: undefined }));
            }
          } else if (currentDialog === 'remove_unit') {
            const idx = unitToRemove.current;
            unitToRemove.current = null;
            if (idx !== null) performRemoveUnit(idx);
          } else {
            handleSubmit(true);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  headerTitle: { flex: 1, fontSize: 14, letterSpacing: 1, fontWeight: '700', color: colors.ink },
  scrollContent: { flexGrow: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  intro: { ...typography.bodySmall, marginBottom: spacing.lg },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h2, fontSize: 17, marginBottom: spacing.md },
  field: { flex: 1, minWidth: 0, marginBottom: spacing.md },
  label: { ...typography.eyebrow, fontSize: 10, letterSpacing: 0.7, marginBottom: spacing.sm },
  input: { minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 16, backgroundColor: colors.canvas },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 12, lineHeight: 17, color: colors.danger, marginTop: spacing.xs },
  errorBanner: { ...typography.body, backgroundColor: colors.dangerSoft, color: colors.danger, padding: spacing.md, marginBottom: spacing.lg },
  helper: { ...typography.bodySmall, marginTop: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  stacked: { flexDirection: 'column', gap: 0 },
  toggle: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.borderStrong, marginBottom: spacing.lg },
  toggleButton: { flex: 1, minHeight: 44, padding: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  toggleActive: { backgroundColor: colors.black },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  toggleActiveText: { color: colors.surface },
  clientButton: { flexDirection: 'row', alignItems: 'center', minHeight: 48, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas, gap: spacing.sm },
  clientText: { flex: 1, fontSize: 15, color: colors.ink },
  clientArrow: { fontSize: 20, color: colors.ink },
  derivedRecipientContainer: { marginBottom: spacing.md },
  derivedRecipientBox: { padding: spacing.md, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border },
  derivedRecipientName: { ...typography.body, fontWeight: '700', fontSize: 15, color: colors.ink },
  quantityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  quantityFieldWrapper: { flex: 1 },
  addUnitButton: { minHeight: 48, marginTop: 22, paddingHorizontal: spacing.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  addUnitButtonText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  unitsSection: { marginTop: spacing.sm },
  unitsHeaderTitle: { ...typography.eyebrow, fontSize: 10.5, letterSpacing: 0.8, color: colors.inkFaint, marginBottom: spacing.sm },
  unitCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  unitCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  unitBadge: { backgroundColor: colors.black, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  unitBadgeText: { ...typography.mono, color: colors.surface, fontSize: 11, fontWeight: '700' },
  unitVolumeTag: { ...typography.mono, fontSize: 11, color: colors.inkSoft, flex: 1, marginLeft: spacing.sm },
  removeUnitBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  removeUnitBtnText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  unitFieldCol: { flex: 1, minWidth: 100, marginBottom: spacing.sm },
  rateCard: { padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  rateLarge: { ...typography.h1, fontSize: 22, color: colors.ink },
  calculations: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.xs },
  metricLabel: { ...typography.bodySmall, color: colors.inkSoft },
  metricValue: { ...typography.body, fontWeight: '700', color: colors.ink },
  billableMetricRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  billableLabel: { ...typography.body, fontWeight: '800', color: colors.ink },
  billableValue: { ...typography.h2, fontSize: 18, fontWeight: '900', color: colors.ink },
  totalBox: { padding: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, marginBottom: spacing.md },
  total: { ...typography.h1, fontSize: 28 },
  settingsNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  unconfiguredBox: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, padding: spacing.md, marginBottom: spacing.md },
  unconfiguredTitle: { ...typography.body, fontWeight: '800', color: colors.ink, marginBottom: 2 },
  unconfiguredText: { ...typography.bodySmall, color: colors.inkSoft, lineHeight: 16 },
  errorBox: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger, padding: spacing.md, marginBottom: spacing.md },
  retry: { minHeight: 36, justifyContent: 'center' },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.ink, textDecorationLine: 'underline' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  paymentCopy: { flex: 1 },
  paymentTitle: { ...typography.body, fontWeight: '700', color: colors.ink },
  footer: { borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg, backgroundColor: colors.canvas },
  submit: { minHeight: 56, maxWidth: 688, width: '100%', alignSelf: 'center', backgroundColor: colors.black, flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  submitText: { fontSize: 14, color: colors.surface, fontWeight: '700', letterSpacing: 0.5 },
});
