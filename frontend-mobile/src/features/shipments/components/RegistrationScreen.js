import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, Vibration, View, useWindowDimensions,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusModal } from '../../../components/common/StatusModal';
import { BackButton } from '../../../components/common/BackButton';
import { colors, spacing, typography } from '../../../theme';
import { ClientPicker } from './ClientPicker';
import { ParcelUnitsEditor } from './ParcelUnitsEditor';
import { RegistrationResult } from './RegistrationResult';
import { shipmentApi } from '../services/shipmentApi';
import { clampParcelPage, getParcelPageIndex } from '../parcelPagination.mjs';
import { safeHaptics } from '../../scanner/utils/haptics';
import {
  calculateRegistration, createRegistrationForm, createShipmentSubmitter,
  isUncertainWrite, mapRegistrationErrors, validateRegistration,
  MAX_ADDRESS_LENGTH, MAX_DESCRIPTION_LENGTH,
} from '../registration.mjs';

function FormField({ name, label, form, errors, onChange, isSubmitting, inputRefs, fieldRefs, showCharacterCount = false, ...props }) {
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
      {showCharacterCount ? <Text style={styles.helper}>{(form[name] || '').length}/{props.maxLength} characters</Text> : null}
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
  const [parcelPage, setParcelPage] = useState(0);
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
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);
  const [highlightedUnitSeq, setHighlightedUnitSeq] = useState(null);
  const highlightTimerRef = useRef(null);

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
  const pendingFocusField = useRef(null);
  const submitter = useRef(null);

  if (!submitter.current) submitter.current = createShipmentSubmitter(shipmentApi, () => isActive.current);

  const isDirty = !result && (
    form.clientId !== '' ||
    form.clientMode === 'NEW' ||
    form.recipientAddress !== '' ||
    form.recipientContact !== '' ||
    form.isShippingFeeOverridden ||
    form.parcels.length > 1 ||
    Boolean(form.parcels[0]?.weightKg || form.parcels[0]?.lengthCm || form.parcels[0]?.widthCm || form.parcels[0]?.heightCm)
  );

  const totals = calculateRegistration(form, divisor, ratePerKilo);
  const isZeroTotal = totals.totalAmount !== null && totals.totalAmount === 0;

  useEffect(() => {
    isActive.current = true;
    return () => {
      isActive.current = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const showUnitAddedToast = (message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      if (isActive.current) {
        setToastMessage(null);
      }
      toastTimerRef.current = null;
    }, 2500);
  };

  const triggerUnitAddedFeedback = (seq) => {
    // 1. Strong vibration: physical motor double-buzz + heavy haptic impact
    try {
      if (Platform.OS !== 'web' && typeof Vibration?.vibrate === 'function') {
        Vibration.vibrate([0, 100, 50, 100]);
      }
    } catch {}
    void safeHaptics.heavy();

    // 2. Highlight newly added unit card
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightedUnitSeq(seq);
    highlightTimerRef.current = setTimeout(() => {
      if (isActive.current) {
        setHighlightedUnitSeq(null);
      }
      highlightTimerRef.current = null;
    }, 4000);

    // 3. Floating toast
    showUnitAddedToast(`Unit #${seq} added at the top`);
  };

  useEffect(() => {
    const controller = new AbortController();
    const selectedClientId = form.clientMode === 'EXISTING' ? form.clientId : null;
    setSettingsState('loading');
    shipmentApi.getCalculationSettings(selectedClientId, controller.signal).then((settings) => {
      if (controller.signal.aborted) return;
      if (selectedClientId && settings.clientId !== selectedClientId) return;
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
  }, [form.clientId, form.clientMode, settingsAttempt]);

  useEffect(() => {
    const fieldName = pendingFocusField.current;
    if (!fieldName) return undefined;

    const animationFrame = requestAnimationFrame(() => {
      if (!isActive.current) return;
      const fieldNode = fieldRefs.current[fieldName];
      pendingFocusField.current = null;
      if (!fieldNode) return;
      fieldNode.measureLayout(contentRef.current, (_left, top) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, top - 16), animated: true });
      }, () => {});
      inputRefs.current[fieldName]?.focus();
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [errors, parcelPage]);

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
    setForm((previous) => {
      const updated = { ...previous, [name]: nextValue };
      if (name === 'newClientAddress') {
        if (!previous.recipientAddress || previous.recipientAddress === previous.newClientAddress) {
          updated.recipientAddress = nextValue;
        }
      } else if (name === 'newClientContact') {
        if (!previous.recipientContact || previous.recipientContact === previous.newClientContact) {
          updated.recipientContact = nextValue;
        }
      }
      return updated;
    });
    setErrors((previous) => {
      const updatedErrors = { ...previous, [name]: undefined };
      if (name === 'newClientAddress' && nextValue) updatedErrors.recipientAddress = undefined;
      if (name === 'newClientContact' && nextValue) updatedErrors.recipientContact = undefined;
      return updatedErrors;
    });
  }

  function handleQuantityChange(value) {
    const sanitized = value.replace(/[^0-9]/g, '');
    const newQty = parseInt(sanitized, 10);

    if (sanitized === '0') {
      setForm((prev) => ({ ...prev, quantity: '0' }));
      setErrors((prev) => ({ ...prev, quantity: 'Enter a whole number from 1 to 1000.' }));
      return;
    }

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
        setParcelPage((prev) => clampParcelPage(prev, targetQty));
      }
    } else {
      setForm((prev) => ({ ...prev, quantity: String(targetQty) }));
      setErrors((prev) => ({ ...prev, quantity: undefined }));
    }
  }

  function handleQuantityBlur() {
    const qtyNum = parseInt(form.quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 1 || qtyNum > 1000) {
      setForm((prev) => ({ ...prev, quantity: String(Math.max(1, form.parcels.length)) }));
      setErrors((prev) => ({ ...prev, quantity: undefined }));
    }
  }

  function handleAddUnit() {
    if (form.parcels.length >= 1000) return;
    const nextSeq = form.parcels.length + 1;
    const lastUnit = form.parcels[form.parcels.length - 1];
    const newUnit = {
      id: `unit-${Date.now()}-${nextSeq}`,
      seq: nextSeq,
      weightKg: lastUnit ? lastUnit.weightKg || '' : '',
      lengthCm: lastUnit ? lastUnit.lengthCm || '' : '',
      widthCm: lastUnit ? lastUnit.widthCm || '' : '',
      heightCm: lastUnit ? lastUnit.heightCm || '' : '',
    };
    setForm((prev) => ({
      ...prev,
      quantity: String(nextSeq),
      parcels: [...prev.parcels, newUnit],
    }));
    setErrors((prev) => ({ ...prev, quantity: undefined }));
    setParcelPage(0);

    triggerUnitAddedFeedback(nextSeq);
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
    setParcelPage((prev) => clampParcelPage(prev, updated.length));
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
    if (!name) return;
    pendingFocusField.current = name;
    const parcelMatch = name.match(/^parcels\[(\d+)\]\./);
    if (parcelMatch) {
      const unitIndex = parseInt(parcelMatch[1], 10);
      setParcelPage(getParcelPageIndex(unitIndex, form.parcels.length, true));
    }
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
        setParcelPage(0);
      }
    } catch (error) {
      if (!isActive.current || error.response?.status === 401) return;

      if (error.response?.status === 409) {
        setSettingsAttempt((c) => c + 1);
        const code = error.response?.data?.code;
        if (code === 'RATE_PER_KILO_NOT_CONFIGURED') {
          setErrorMessage('Shipment registration is blocked because neither this client nor the system has a configured rate per kilo.');
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
            <View style={styles.introBanner}>
              <View style={styles.introDot} />
              <Text style={styles.introText}>Shipment and tracking numbers are assigned on registration.</Text>
            </View>
            {errorMessage ? <Text accessibilityRole="alert" style={styles.errorBanner}>{errorMessage}</Text> : null}

            {/* 1. Client Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text accessibilityRole="header" style={styles.cardTitle}>Client / Billing Party</Text>
              </View>
              <View style={styles.toggle}>
                {['EXISTING', 'NEW'].map((mode) => <Pressable
                  key={mode} accessibilityRole="button" accessibilityState={{ selected: form.clientMode === mode, disabled: isSubmitting }} disabled={isSubmitting}
                  onPress={() => { changeField('clientMode', mode); setErrors({}); }}
                  style={[styles.toggleButton, form.clientMode === mode && styles.toggleActive]}
                ><Text style={[styles.toggleText, form.clientMode === mode && styles.toggleActiveText]}>{mode === 'EXISTING' ? 'Existing Client' : '+ New Client'}</Text></Pressable>)}
              </View>
              {form.clientMode === 'EXISTING' ? <View ref={(node) => { fieldRefs.current.clientId = node; }} collapsable={false}>
                <Text style={styles.label}>SELECT CLIENT *</Text>
                <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => setIsPickerOpen(true)} style={[styles.clientButton, errors.clientId && styles.inputError]}>
                  <Text style={[styles.clientText, !form.clientId && styles.clientPlaceholderText]}>
                    {form.clientId ? `${form.clientId} · ${form.clientName}` : 'Choose billing client…'}
                  </Text>
                  <Text style={styles.clientArrow}>⌄</Text>
                </Pressable>
                {errors.clientId ? <Text accessibilityRole="alert" style={styles.error}>{errors.clientId}</Text> : null}
                <Text style={styles.helper}>Shipments are billed together on the client’s statement of account.</Text>
              </View> : <>
                {field('newClientName', 'CLIENT / COMPANY NAME *', { placeholder: 'Company or client name', maxLength: 150 })}
                {field('newClientAddress', 'BILLING ADDRESS *', { placeholder: 'Street, city, province', multiline: true, maxLength: MAX_ADDRESS_LENGTH, showCharacterCount: true })}
                {field('newClientContact', 'CONTACT NUMBER *', { keyboardType: 'phone-pad', inputMode: 'numeric', maxLength: 11, placeholder: '09XXXXXXXXX' })}
                {field('newClientEmail', 'EMAIL ADDRESS', { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false, maxLength: 150 })}
              </>}
            </View>

            {/* 2. Recipient Card (shown only when selecting an EXISTING client) */}
            {form.clientMode === 'EXISTING' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text accessibilityRole="header" style={styles.cardTitle}>Recipient</Text>
                </View>
                <View style={styles.derivedRecipientContainer}>
                  <Text style={styles.label}>RECIPIENT / CONSIGNEE</Text>
                  <View style={styles.derivedRecipientBox}>
                    <Text style={styles.derivedRecipientName}>{derivedRecipientName}</Text>
                    <Text style={styles.helper}>Automatically derived from billing client.</Text>
                  </View>
                </View>
                {field('recipientAddress', 'COMPLETE ADDRESS *', { placeholder: 'Unit, street, barangay, city, province', multiline: true, maxLength: MAX_ADDRESS_LENGTH, showCharacterCount: true })}
                {field('recipientContact', 'CONTACT NUMBER *', { keyboardType: 'phone-pad', inputMode: 'numeric', maxLength: 11, placeholder: '09XXXXXXXXX' })}
              </View>
            ) : null}

            {/* 3. Parcel Details & Per-Unit Editor */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text accessibilityRole="header" style={styles.cardTitle}>Parcel Details</Text>
              </View>
              {field('description', 'DESCRIPTION', { placeholder: 'General Goods', multiline: true, maxLength: MAX_DESCRIPTION_LENGTH, showCharacterCount: true })}
              {field('route', 'ROUTE', { placeholder: 'Manila to Daet, Camarines Norte', maxLength: 150 })}

              <View
                ref={(node) => { fieldRefs.current.quantity = node; }}
                collapsable={false}
                style={styles.field}
              >
                <Text style={styles.label}>QUANTITY (PARCEL UNITS) *</Text>
                <View style={styles.quantityControlRow}>
                  <TextInput
                    ref={(node) => { inputRefs.current.quantity = node; }}
                    accessibilityLabel="Quantity in parcel units"
                    value={form.quantity}
                    onChangeText={handleQuantityChange}
                    onBlur={handleQuantityBlur}
                    editable={!isSubmitting}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1"
                    placeholderTextColor={colors.inkFaint}
                    style={[styles.input, styles.quantityInput, errors.quantity && styles.inputError]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add unit ${form.parcels.length + 1}`}
                    disabled={isSubmitting || form.parcels.length >= 1000}
                    onPress={handleAddUnit}
                    style={({ pressed }) => [
                      styles.addUnitButton,
                      pressed && styles.addUnitButtonPressed,
                      (isSubmitting || form.parcels.length >= 1000) && styles.addUnitButtonDisabled,
                    ]}
                  >
                    <Text style={styles.addUnitButtonText}>+ Add Unit #{form.parcels.length + 1}</Text>
                  </Pressable>
                </View>
                {errors.quantity ? <Text accessibilityRole="alert" style={styles.error}>{errors.quantity}</Text> : null}
                <Text style={styles.helper}>1–1,000 units. One QR generated per unit.</Text>
              </View>

              {highlightedUnitSeq ? (
                <View style={styles.unitAddedBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
                  <View style={styles.unitAddedDot} />
                  <Text style={styles.unitAddedText}>
                    Unit #{highlightedUnitSeq} added at the top ({form.parcels.length} {form.parcels.length === 1 ? 'unit' : 'units'} total)
                  </Text>
                </View>
              ) : null}

              {/* Per-Unit Cards */}
              <ParcelUnitsEditor
                currentPage={parcelPage}
                errors={errors}
                fieldRefs={fieldRefs}
                highlightedUnitSeq={highlightedUnitSeq}
                inputRefs={inputRefs}
                isSubmitting={isSubmitting}
                onPageChange={setParcelPage}
                onRequestRemoveUnit={handleRequestRemoveUnit}
                onUpdateParcelField={updateParcelField}
                parcels={form.parcels}
                shouldStack={shouldStack}
              />
            </View>

            {/* 4. Live Rating & Summary */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text accessibilityRole="header" style={styles.cardTitle}>Rating & Summary</Text>
                {ratePerKilo !== null ? (
                  <View style={styles.rateBadge}>
                    <Text style={styles.rateBadgeText}>₱{ratePerKilo.toFixed(2)} / kg</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.calculations}>
                <Text style={styles.breakdownHeaderTitle}>WEIGHT & VOLUME BREAKDOWN</Text>
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

              <View ref={(node) => { fieldRefs.current.shippingFee = node; }} collapsable={false} style={styles.field}>
                <View style={styles.shippingFeeHeader}>
                  <Text style={styles.label}>SHIPPING FEE (₱)</Text>
                  {form.isShippingFeeOverridden ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSubmitting}
                      onPress={() => {
                        changeField('isShippingFeeOverridden', false);
                        changeField('shippingFee', '');
                        setErrors((prev) => ({ ...prev, shippingFee: undefined }));
                      }}
                      style={styles.resetButton}
                    >
                      <Text style={styles.resetButtonText}>Reset to calculated</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.calculatedBadge}>
                      <Text style={styles.calculatedBadgeText}>Calculated</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  ref={(node) => { inputRefs.current.shippingFee = node; }}
                  accessibilityLabel="Shipping fee in pesos"
                  accessibilityHint={errors.shippingFee || undefined}
                  value={form.isShippingFeeOverridden
                    ? (form.shippingFee ?? '')
                    : (totals.calculatedShippingFee !== null && totals.calculatedShippingFee !== undefined
                        ? totals.calculatedShippingFee.toFixed(2)
                        : (totals.shippingFee !== null ? totals.shippingFee.toFixed(2) : ''))}
                  onChangeText={(val) => {
                    changeField('isShippingFeeOverridden', true);
                    changeField('shippingFee', val);
                    if (errors.shippingFee) setErrors((prev) => ({ ...prev, shippingFee: undefined }));
                  }}
                  editable={!isSubmitting}
                  placeholderTextColor={colors.inkFaint}
                  placeholder="0.00"
                  style={[styles.input, errors.shippingFee && styles.inputError]}
                  {...numericProps}
                  maxLength={13}
                />
                <Text style={styles.helper}>
                  {form.isShippingFeeOverridden
                    ? (totals.calculatedShippingFee !== null && totals.calculatedShippingFee !== undefined
                        ? `Manual override (Calculated: ₱${totals.calculatedShippingFee.toFixed(2)})`
                        : 'Manual override')
                    : 'Calculated from billable weight & rate'}
                </Text>
                {errors.shippingFee ? <Text accessibilityRole="alert" style={styles.error}>{errors.shippingFee}</Text> : null}
              </View>

              {field('otherCharges', 'OTHER CHARGES (₱)', { ...numericProps, maxLength: 13, placeholder: '0' })}

              <View style={styles.totalBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
                  <Text style={styles.total}>
                    {totals.totalAmount !== null
                      ? `₱${totals.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </Text>
                </View>
                <Text style={styles.totalSubtext}>
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
                    Shipment registration is blocked because neither this client nor the system has a configured rate per kilo.
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
                  value={isZeroTotal ? false : form.paidAtRegistration}
                  disabled={isSubmitting || isZeroTotal}
                  onValueChange={(value) => changeField('paidAtRegistration', value)}
                  trackColor={{ false: colors.border, true: colors.black }}
                  thumbColor={colors.surface}
                />
                <View style={styles.paymentCopy}>
                  <Text style={styles.paymentTitle}>Paid at Registration</Text>
                  <Text style={styles.helper}>
                    {isZeroTotal
                      ? 'Free shipment (₱0.00 total) · No payment record created.'
                      : form.paidAtRegistration
                        ? 'Records the full amount as an immediate cash payment.'
                        : 'Unpaid. To be billed in the statement of account.'}
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
        const clientContact = (client.contactNumber || client.contact || '').replace(/[^0-9]/g, '');
        setForm((previous) => ({
          ...previous,
          clientId: client.clientId,
          clientName: client.name,
          recipientAddress: client.address || previous.recipientAddress,
          recipientContact: clientContact || previous.recipientContact,
        }));
        setErrors((previous) => ({
          ...previous,
          clientId: undefined,
          ...(client.address ? { recipientAddress: undefined } : {}),
          ...(clientContact ? { recipientContact: undefined } : {}),
        }));
        if (uncertainStage === 'client') { setUncertainStage(null); setErrorMessage(''); }
        setIsPickerOpen(false);
      }} /> : null}
      <StatusModal
        visible={dialog !== null} eyebrow="SHIPMENT REGISTRATION"
        title={
          dialog === 'discard' ? 'Discard this shipment?'
          : dialog === 'discard_units' ? 'Discard excess units?'
          : dialog === 'remove_unit' ? `Discard measurements for parcel unit #${form.parcels[unitToRemove.current]?.seq || (unitToRemove.current ?? 0) + 1}?`
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
          : dialog === 'remove_unit' ? 'Discard'
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
              setParcelPage((prev) => clampParcelPage(prev, target));
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
      {toastMessage ? (
        <View style={styles.toastContainer} pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite">
          <View style={styles.toastBadge}>
            <View style={styles.toastDot} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      ) : null}
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
  introBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  introDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  introText: {
    ...typography.bodySmall,
    color: colors.inkSoft,
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    ...typography.h2,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  rateBadge: {
    backgroundColor: colors.slateSoft,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 4,
  },
  rateBadgeText: {
    ...typography.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
  field: { flex: 1, minWidth: 0, marginBottom: spacing.md },
  label: { ...typography.eyebrow, fontSize: 10, letterSpacing: 0.7, marginBottom: spacing.sm },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.ink,
    fontSize: 15,
    backgroundColor: colors.canvas,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 12, lineHeight: 17, color: colors.danger, marginTop: spacing.xs },
  errorBanner: { ...typography.body, backgroundColor: colors.dangerSoft, color: colors.danger, padding: spacing.md, marginBottom: spacing.lg, borderRadius: 4 },
  helper: { ...typography.bodySmall, marginTop: spacing.xs, marginBottom: spacing.sm },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  toggleButton: { flex: 1, minHeight: 44, padding: spacing.sm, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  toggleActive: { backgroundColor: colors.black },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  toggleActiveText: { color: colors.surface, fontWeight: '800' },
  clientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.canvas,
    gap: spacing.sm,
  },
  clientText: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: '600' },
  clientPlaceholderText: { color: colors.inkFaint, fontWeight: '400' },
  clientArrow: { fontSize: 18, color: colors.inkFaint, fontWeight: '700' },
  derivedRecipientContainer: { marginBottom: spacing.md },
  derivedRecipientBox: { padding: spacing.md, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border, borderRadius: 4 },
  derivedRecipientName: { ...typography.body, fontWeight: '700', fontSize: 15, color: colors.ink, marginBottom: 2 },
  quantityControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityInput: {
    width: 88,
    textAlign: 'center',
    fontWeight: '700',
  },
  addUnitButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addUnitButtonPressed: {
    backgroundColor: colors.canvas,
    transform: [{ scale: 0.98 }],
  },
  addUnitButtonDisabled: {
    opacity: 0.4,
  },
  addUnitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.3,
  },
  unitAddedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9EE',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  unitAddedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  unitAddedText: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  toastContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginRight: 8,
  },
  toastText: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.canvas,
    letterSpacing: 0.3,
  },
  calculations: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    borderRadius: 4,
    marginBottom: spacing.md,
  },
  breakdownHeaderTitle: {
    ...typography.eyebrow,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.inkFaint,
    marginBottom: spacing.sm,
  },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.xs },
  metricLabel: { ...typography.bodySmall, color: colors.inkSoft },
  metricValue: { ...typography.body, fontWeight: '700', color: colors.ink },
  billableMetricRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm },
  billableLabel: { ...typography.body, fontWeight: '800', color: colors.ink },
  billableValue: { ...typography.h2, fontSize: 18, fontWeight: '900', color: colors.ink },
  totalBox: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.canvas,
    borderRadius: 4,
    marginBottom: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  totalLabel: {
    ...typography.eyebrow,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.inkFaint,
  },
  total: {
    ...typography.h1,
    fontSize: 26,
    color: colors.ink,
  },
  totalSubtext: {
    ...typography.mono,
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
  settingsNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  unconfiguredBox: { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, padding: spacing.md, marginBottom: spacing.md, borderRadius: 4 },
  unconfiguredTitle: { ...typography.body, fontWeight: '800', color: colors.ink, marginBottom: 2 },
  unconfiguredText: { ...typography.bodySmall, color: colors.inkSoft, lineHeight: 16 },
  errorBox: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger, padding: spacing.md, marginBottom: spacing.md, borderRadius: 4 },
  retry: { minHeight: 36, justifyContent: 'center' },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.ink, textDecorationLine: 'underline' },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  paymentCopy: { flex: 1 },
  paymentTitle: { ...typography.body, fontWeight: '700', color: colors.ink },
  shippingFeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  resetButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  calculatedBadge: {
    backgroundColor: colors.slateSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  calculatedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSoft,
    textTransform: 'uppercase',
  },
  footer: { borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg, backgroundColor: colors.canvas },
  submit: {
    minHeight: 54,
    maxWidth: 688,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.black,
    borderRadius: 4,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  submitText: { fontSize: 14, color: colors.surface, fontWeight: '700', letterSpacing: 0.5 },
});
