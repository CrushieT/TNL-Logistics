import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusModal } from '../../../components/common/StatusModal';
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
  const [settingsState, setSettingsState] = useState('loading');
  const [settingsAttempt, setSettingsAttempt] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [uncertainStage, setUncertainStage] = useState(null);
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
  const isDirty = !result && JSON.stringify(form) !== JSON.stringify(createRegistrationForm());
  const totals = calculateRegistration(form, divisor);

  useEffect(() => {
    isActive.current = true;
    return () => { isActive.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSettingsState('loading');
    shipmentApi.getCalculationSettings(controller.signal).then((settings) => {
      if (controller.signal.aborted) return;
      if (!Number.isFinite(settings.volumetricDivisor) || settings.volumetricDivisor <= 0) throw new Error('Missing divisor');
      setDivisor(settings.volumetricDivisor);
      setSettingsState('ready');
    }).catch(() => {
      if (!controller.signal.aborted) { setDivisor(null); setSettingsState('error'); }
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
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
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
      const shipment = await submitter.current(form, (client) => {
        setForm((previous) => ({ ...previous, clientMode: 'EXISTING', clientId: client.clientId, clientName: client.name }));
      });
      if (shipment && isActive.current) {
        setResult(shipment);
        setForm(createRegistrationForm());
      }
    } catch (error) {
      if (!isActive.current || error.response?.status === 401) return;
      const fieldErrors = mapRegistrationErrors(error);
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

  const field = (name, label, props = {}) => <FormField key={name} {...{ name, label, form, errors, isSubmitting, inputRefs, fieldRefs }} onChange={changeField} {...props} />;
  const rowStyle = [styles.row, shouldStack && styles.stacked];
  const numericProps = { keyboardType: 'decimal-pad', inputMode: 'decimal', maxLength: 9 };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to office home" disabled={isSubmitting} onPress={requestBack} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
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
                {field('newClientContact', 'CONTACT NUMBER *', { keyboardType: 'phone-pad', maxLength: 30 })}
                {field('newClientEmail', 'EMAIL ADDRESS', { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false, maxLength: 150 })}
              </>}
            </View>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Recipient</Text>
              {field('recipientName', 'RECIPIENT NAME *', { placeholder: 'Full name' })}
              {field('recipientAddress', 'COMPLETE ADDRESS *', { placeholder: 'Unit, street, barangay, city, province', multiline: true })}
              {field('recipientContact', 'CONTACT NUMBER *', { keyboardType: 'phone-pad' })}
            </View>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Parcel Details</Text>
              {field('description', 'DESCRIPTION', { placeholder: 'General Goods' })}
              {field('route', 'ROUTE', { placeholder: 'Manila to TNL Baguio' })}
              <View style={rowStyle}>
                {field('quantity', 'QUANTITY (UNITS) *', { keyboardType: 'number-pad', inputMode: 'numeric', maxLength: 4 })}
                {field('weightKg', 'WEIGHT / UNIT (KG) *', numericProps)}
              </View>
              <Text style={styles.helper}>The same weight and dimensions apply to every unit. Up to 1,000 units per mobile registration.</Text>
              <View style={rowStyle}>
                {field('lengthCm', 'LENGTH (CM) *', numericProps)}
                {field('widthCm', 'WIDTH (CM) *', numericProps)}
                {field('heightCm', 'HEIGHT (CM) *', numericProps)}
              </View>
              <View style={styles.calculations}>
                <Text style={styles.label}>WEIGHT / VOLUME · AUTO-COMPUTED</Text>
                <Text style={styles.calculation}>Volume / unit: {formatMeasure(totals.unitVolume, 4, 'm³')}</Text>
                <Text style={styles.calculation}>Total volume: {formatMeasure(totals.totalVolume, 4, 'm³')}</Text>
                <Text style={styles.calculation}>Total actual weight: {formatMeasure(totals.actualWeight, 2, 'kg')}</Text>
                <Text style={styles.calculation}>Volumetric weight: {formatMeasure(totals.volumetricWeight, 2, 'kg')}</Text>
                <Text style={styles.billable}>Billable weight: {formatMeasure(totals.billableWeight, 2, 'kg')}</Text>
                {settingsState === 'loading' ? <Text style={styles.helper}>Loading weight calculation settings…</Text> : null}
                {settingsState === 'error' ? <>
                  <Text style={styles.helper}>Weight estimates are unavailable. You can still register this shipment.</Text>
                  <Pressable accessibilityRole="button" style={styles.retry} onPress={() => setSettingsAttempt((value) => value + 1)}><Text style={styles.retryText}>Retry weight settings</Text></Pressable>
                </> : <Text style={styles.helper}>Estimates only. Shipping charges use the rate entered below.</Text>}
              </View>
            </View>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Charges / Payment</Text>
              <Text style={styles.label}>CHARGE MODEL</Text>
              <View style={styles.toggle}>
                {['FLAT', 'PER_PARCEL'].map((model) => <Pressable
                  key={model} accessibilityRole="button" accessibilityState={{ selected: form.chargeModel === model, disabled: isSubmitting }} disabled={isSubmitting}
                  onPress={() => changeField('chargeModel', model)} style={[styles.toggleButton, form.chargeModel === model && styles.toggleActive]}
                ><Text style={[styles.toggleText, form.chargeModel === model && styles.toggleActiveText]}>{model === 'FLAT' ? 'Flat · shipment' : 'Per unit'}</Text></Pressable>)}
              </View>
              <View style={rowStyle}>
                {field('shippingFee', form.chargeModel === 'FLAT' ? 'SHIPPING FEE (₱) *' : 'FEE / UNIT (₱) *', { ...numericProps, maxLength: 13 })}
                {field('otherCharges', 'OTHER CHARGES (₱)', { ...numericProps, maxLength: 13 })}
              </View>
              <View style={styles.totalBox}>
                <Text style={styles.label}>TOTAL AMOUNT</Text>
                <Text style={styles.total}>{totals.totalCents === null ? '—' : `₱${(totals.totalCents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>
                <Text style={styles.helper}>{form.chargeModel === 'FLAT' ? 'Shipping fee + other charges' : 'Shipping fee × quantity + other charges'}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Switch accessibilityLabel="Paid at registration" value={form.paidAtRegistration} disabled={isSubmitting} onValueChange={(value) => changeField('paidAtRegistration', value)} trackColor={{ false: colors.border, true: colors.black }} thumbColor={colors.surface} />
                <View style={styles.paymentCopy}>
                  <Text style={styles.paymentTitle}>Paid at Registration</Text>
                  <Text style={styles.helper}>{form.paidAtRegistration ? 'Records the full amount as a cash payment.' : 'Unpaid. To be billed in the statement of account.'}</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }} disabled={isSubmitting} onPress={() => handleSubmit()} style={[styles.submit, isSubmitting && styles.disabled]}>
            {isSubmitting ? <ActivityIndicator color={colors.surface} /> : null}
            <Text style={styles.submitText}>{isSubmitting ? 'REGISTERING…' : uncertainStage ? 'REVIEW BEFORE RETRY' : 'REGISTER SHIPMENT'}</Text>
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
        title={dialog === 'discard' ? 'Discard this shipment?' : 'Check before retrying'}
        message={dialog === 'discard'
          ? 'Your unsaved shipment details will be discarded. A client already created will remain in the client directory.'
          : uncertainStage === 'client'
            ? 'Check Existing clients first. If the client was created, select it instead. Retry only after confirming it was not created.'
            : 'Check the web shipment directory first. Retry only after confirming this shipment was not created; another submission can create a duplicate payment.'}
        confirmText={dialog === 'discard' ? 'Discard' : 'Checked; retry'}
        cancelText={dialog === 'discard' ? 'Keep editing' : 'Cancel'}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          if (dialog === 'discard') {
            canLeave.current = true;
            if (pendingAction.current) navigation.dispatch(pendingAction.current);
            else navigateHome();
          } else handleSubmit(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingRight: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  back: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 30, color: colors.ink },
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
  calculations: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  calculation: { ...typography.body, marginBottom: spacing.xs },
  billable: { ...typography.body, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.ink, textDecorationLine: 'underline' },
  totalBox: { padding: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  total: { ...typography.h1, fontSize: 28 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  paymentCopy: { flex: 1 },
  paymentTitle: { ...typography.body, fontWeight: '700', color: colors.ink },
  footer: { borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg, backgroundColor: colors.canvas },
  submit: { minHeight: 56, maxWidth: 688, width: '100%', alignSelf: 'center', backgroundColor: colors.black, flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  submitText: { fontSize: 14, color: colors.surface, fontWeight: '700', letterSpacing: 0.5 },
});
