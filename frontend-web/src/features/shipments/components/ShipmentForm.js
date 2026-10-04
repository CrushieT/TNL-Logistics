import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Switch, TouchableOpacity, useWindowDimensions } from 'react-native';
import Card from '../../../components/common/Card';
import FormField from '../../../components/common/FormField';
import SelectField from '../../../components/common/SelectField';
import Button from '../../../components/common/Button';
import ClientSelectDropdown from './ClientSelectDropdown';
import { calculateShipmentMetrics } from '../registrationCalculations.mjs';
import { colors, fonts, spacing, radius, type } from '../../../theme';

const CHARGE_MODELS = [
  { value: 'FLAT', label: 'Flat (shipment-level)' },
  { value: 'PER_UNIT', label: 'Per unit' },
];

function formatMeasure(value, digits, suffix) {
  return value === null ? 'Unavailable' : `${value.toFixed(digits)} ${suffix}`;
}

export default function ShipmentForm({
  clients = [],
  nextShipmentPreview,
  onSubmit,
  submitting,
  volumetricDivisor,
  ratePerKilo,
  calculationSettingsState = 'loading',
  onRetryCalculationSettings,
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  // Client Selection / Creation Mode
  const [clientMode, setClientMode] = useState('EXISTING'); // 'EXISTING' | 'NEW'
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [newClientName, setNewClientName] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  // Delivery Details (recipient name is derived from billing client)
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // Shipment & Parcel Details
  const [description, setDescription] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [parcels, setParcels] = useState([
    { id: 'unit-1', seq: 1, weightKg: '1', lengthCm: '20', widthCm: '10', heightCm: '15' },
  ]);

  // Charges & Options
  const [route, setRoute] = useState('Manila to TNL Labo C.N.');
  const [otherCharges, setOtherCharges] = useState('0');
  const [paidAtRegistration, setPaidAtRegistration] = useState(false);

  // Field Validation Errors
  const [errors, setErrors] = useState({});

  // Automatically sync client selection to first active client when clients list loads
  useEffect(() => {
    const activeClients = (clients || []).filter((c) => c.active !== false);
    if (activeClients.length > 0) {
      const isCurrentActive = activeClients.some((c) => (c.id || c.clientId) === clientId);
      if (!clientId || !isCurrentActive) {
        const defaultId = activeClients[0].id || activeClients[0].clientId || '';
        setClientId(defaultId);
        setErrors((prev) => ({ ...prev, clientId: null }));
      }
    }
  }, [clients, clientId]);

  const selectedClient = useMemo(() => {
    return (clients || []).find((c) => (c.id || c.clientId) === clientId);
  }, [clients, clientId]);

  const derivedRecipientName = clientMode === 'EXISTING'
    ? (selectedClient?.name || '')
    : (newClientName.trim() || '');

  function handleQuantityChange(value) {
    const cleaned = value.replace(/[^0-9]/g, '');
    setQuantityInput(cleaned);
  }

  function handleQuantityBlur() {
    const qtyNum = parseInt(quantityInput, 10);
    if (isNaN(qtyNum) || qtyNum < 1 || qtyNum > 1000) {
      setQuantityInput(String(parcels.length));
      return;
    }
    syncQuantityToParcels(qtyNum);
  }

  function syncQuantityToParcels(targetQty) {
    if (targetQty === parcels.length) return;

    if (targetQty > parcels.length) {
      const added = [];
      for (let i = parcels.length + 1; i <= targetQty; i++) {
        added.push({
          id: `unit-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          seq: i,
          weightKg: '',
          lengthCm: '',
          widthCm: '',
          heightCm: '',
        });
      }
      setParcels((prev) => [...prev, ...added]);
      setQuantityInput(String(targetQty));
    } else {
      const discarded = parcels.slice(targetQty);
      const isPopulated = discarded.some(
        (p) => Boolean(p.weightKg?.trim() || p.lengthCm?.trim() || p.widthCm?.trim() || p.heightCm?.trim())
      );
      if (isPopulated) {
        const confirmMsg = `Reducing quantity to ${targetQty} will discard measurements for parcel unit(s) ${discarded.map((p) => `#${p.seq}`).join(', ')}. Discard these units?`;
        const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(confirmMsg)
          : true;
        if (!confirmed) {
          setQuantityInput(String(parcels.length));
          return;
        }
      }
      setParcels((prev) => prev.slice(0, targetQty));
      setQuantityInput(String(targetQty));
    }
  }

  function addUnit() {
    if (parcels.length >= 1000) return;
    const nextSeq = parcels.length + 1;
    const newUnit = {
      id: `unit-${Date.now()}-${nextSeq}-${Math.random().toString(36).slice(2, 6)}`,
      seq: nextSeq,
      weightKg: '',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
    };
    setParcels((prev) => [...prev, newUnit]);
    setQuantityInput(String(nextSeq));
  }

  function removeUnit(indexToRemove) {
    if (parcels.length <= 1) return;
    const unitToRemove = parcels[indexToRemove];
    const isPopulated = Boolean(
      unitToRemove.weightKg?.trim() || unitToRemove.lengthCm?.trim() ||
      unitToRemove.widthCm?.trim() || unitToRemove.heightCm?.trim()
    );
    if (isPopulated) {
      const confirmMsg = `Discard measurements for parcel unit #${unitToRemove.seq}?`;
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(confirmMsg)
        : true;
      if (!confirmed) return;
    }
    const nextParcels = parcels
      .filter((_, idx) => idx !== indexToRemove)
      .map((p, idx) => ({ ...p, seq: idx + 1 }));
    setParcels(nextParcels);
    setQuantityInput(String(nextParcels.length));
  }

  function updateParcelField(index, field, value) {
    setParcels((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    if (errors[`parcel_${index}_${field}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`parcel_${index}_${field}`];
        return next;
      });
    }
  }

  const shipmentMetrics = useMemo(() => {
    return calculateShipmentMetrics({ parcels }, volumetricDivisor, ratePerKilo);
  }, [parcels, volumetricDivisor, ratePerKilo]);

  const totalAmount = useMemo(() => {
    const fee = shipmentMetrics.shippingFee || 0;
    const other = parseFloat(otherCharges) || 0;
    return Math.round((fee + other + Number.EPSILON) * 100) / 100;
  }, [shipmentMetrics.shippingFee, otherCharges]);

  function validateForm() {
    const newErrors = {};

    if (clientMode === 'EXISTING') {
      const activeClientId = clientId || (clients.length > 0 ? (clients[0].id || clients[0].clientId) : '');
      if (!activeClientId) newErrors.clientId = 'Please select a billing client.';
    } else {
      if (!newClientName.trim()) {
        newErrors.newClientName = 'Client / Company name is required.';
      } else if (newClientName.trim().length > 150) {
        newErrors.newClientName = 'Client / Company name cannot exceed 150 characters.';
      }

      if (!newClientAddress.trim()) {
        newErrors.newClientAddress = 'Billing address is required.';
      } else if (newClientAddress.trim().length > 255) {
        newErrors.newClientAddress = 'Billing address cannot exceed 255 characters.';
      }

      if (!newClientContact.trim() || newClientContact.trim().length < 7) {
        newErrors.newClientContact = 'Valid contact number is required (min 7 digits).';
      } else if (newClientContact.trim().length > 11) {
        newErrors.newClientContact = 'Contact number cannot exceed 11 characters.';
      } else if (!/^\d+$/.test(newClientContact.trim())) {
        newErrors.newClientContact = 'Contact number must contain digits only.';
      }

      if (newClientEmail.trim() && newClientEmail.trim().length > 150) {
        newErrors.newClientEmail = 'Email address cannot exceed 150 characters.';
      }
    }

    if (!address.trim()) {
      newErrors.address = 'Complete delivery address is required.';
    } else if (address.trim().length > 255) {
      newErrors.address = 'Complete delivery address cannot exceed 255 characters.';
    }

    if (!contactNumber.trim() || contactNumber.trim().length < 7) {
      newErrors.contactNumber = 'Valid contact number is required (min 7 digits).';
    } else if (contactNumber.trim().length > 11) {
      newErrors.contactNumber = 'Contact number cannot exceed 11 characters.';
    } else if (!/^\d+$/.test(contactNumber.trim())) {
      newErrors.contactNumber = 'Contact number must contain digits only.';
    }

    if (description.trim().length > 255) {
      newErrors.description = 'Description cannot exceed 255 characters.';
    }

    if (route.trim().length > 150) {
      newErrors.route = 'Route cannot exceed 150 characters.';
    }

    const qtyNum = parseInt(quantityInput, 10);
    if (!quantityInput || isNaN(qtyNum) || qtyNum < 1 || qtyNum > 1000) {
      newErrors.quantity = 'Quantity must be between 1 and 1,000.';
    }

    // Per-unit validation
    parcels.forEach((p, idx) => {
      const wtNum = parseFloat(p.weightKg);
      if (!p.weightKg || isNaN(wtNum) || wtNum <= 0) {
        newErrors[`parcel_${idx}_weightKg`] = 'Required (> 0 kg)';
      }

      const lNum = parseFloat(p.lengthCm);
      const wNum = parseFloat(p.widthCm);
      const hNum = parseFloat(p.heightCm);

      if (!p.lengthCm || isNaN(lNum) || lNum <= 0) newErrors[`parcel_${idx}_lengthCm`] = 'Required (> 0)';
      if (!p.widthCm || isNaN(wNum) || wNum <= 0) newErrors[`parcel_${idx}_widthCm`] = 'Required (> 0)';
      if (!p.heightCm || isNaN(hNum) || hNum <= 0) newErrors[`parcel_${idx}_heightCm`] = 'Required (> 0)';
    });

    const otherNum = parseFloat(otherCharges);
    if (otherCharges !== '' && (isNaN(otherNum) || otherNum < 0)) {
      newErrors.otherCharges = 'Charges cannot be negative.';
    }

    if (calculationSettingsState !== 'ready' || !Number.isFinite(ratePerKilo) || ratePerKilo <= 0) {
      newErrors.calculationSettings = 'Rate per kilo is not configured.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validateForm()) return;

    const basePayload = {
      recipient: {
        fullName: derivedRecipientName,
        address: address.trim(),
        contactNumber: contactNumber.trim(),
      },
      recipientAddress: address.trim(),
      recipientContact: contactNumber.trim(),
      description: description.trim() || 'General Goods',
      quantity: parcels.length,
      route: route.trim() || 'Manila to TNL Labo C.N.',
      chargeModel: 'PER_KILO',
      otherCharges: parseFloat(otherCharges) || 0,
      paidAtRegistration,
      totalAmount,
      parcels: parcels.map((p, idx) => ({
        seq: idx + 1,
        weightKg: parseFloat(p.weightKg),
        lengthCm: parseFloat(p.lengthCm),
        widthCm: parseFloat(p.widthCm),
        heightCm: parseFloat(p.heightCm),
      })),
      expectedRatePerKilo: ratePerKilo,
      expectedVolumetricDivisor: volumetricDivisor,
    };

    if (clientMode === 'EXISTING') {
      const activeClientId = clientId || (clients.length > 0 ? (clients[0].id || clients[0].clientId) : '');
      onSubmit?.({
        ...basePayload,
        clientId: activeClientId,
      });
    } else {
      onSubmit?.({
        ...basePayload,
        newClient: {
          name: newClientName.trim(),
          address: newClientAddress.trim(),
          contactNumber: newClientContact.trim(),
          email: newClientEmail.trim() || null,
        },
      });
    }
  }

  const isRateReady = calculationSettingsState === 'ready' && Number.isFinite(ratePerKilo) && ratePerKilo > 0;
  const canSubmit = isRateReady && !submitting;

  return (
    <View style={styles.container}>
      {/* Top Row: Client & Recipient */}
      <View style={[styles.topRow, isMobile && styles.topRowMobile]}>
        {/* 1. Client Card */}
        <Card
          title="Client / Billing Party"
          right={
            <View style={styles.pillToggle}>
              <TouchableOpacity
                style={[styles.pillBtn, clientMode === 'EXISTING' && styles.pillBtnActive]}
                onPress={() => {
                  setClientMode('EXISTING');
                  setErrors((prev) => ({
                    ...prev,
                    newClientName: null,
                    newClientAddress: null,
                    newClientContact: null,
                  }));
                }}
              >
                <Text style={[styles.pillBtnText, clientMode === 'EXISTING' && styles.pillBtnTextActive]}>
                  Existing
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pillBtn, clientMode === 'NEW' && styles.pillBtnActive]}
                onPress={() => {
                  setClientMode('NEW');
                  setErrors((prev) => ({ ...prev, clientId: null }));
                }}
              >
                <Text style={[styles.pillBtnText, clientMode === 'NEW' && styles.pillBtnTextActive]}>
                  + New
                </Text>
              </TouchableOpacity>
            </View>
          }
          style={[styles.halfCard, isMobile && styles.cardMobile, styles.clientCard]}
          bodyStyle={styles.clientCardBody}
        >
          {clientMode === 'EXISTING' ? (
            <>
              <ClientSelectDropdown
                label="Select Client"
                required
                value={clientId}
                onValueChange={(val) => {
                  setClientId(val);
                  if (errors.clientId) setErrors((prev) => ({ ...prev, clientId: null }));
                }}
                clients={clients}
                error={errors.clientId}
              />
              <Text style={styles.helperNote}>
                Payments consolidate per client; multiple shipments bill as one SOA.
              </Text>
            </>
          ) : (
            <View style={styles.newClientFields}>
              <FormField
                label="Client / Company Name"
                required
                value={newClientName}
                onChangeText={(val) => {
                  setNewClientName(val);
                  if (errors.newClientName) setErrors((prev) => ({ ...prev, newClientName: null }));
                }}
                placeholder="e.g. Northbridge Trading"
                maxLength={150}
                error={errors.newClientName}
              />
              <FormField
                label="Billing Address"
                required
                value={newClientAddress}
                onChangeText={(val) => {
                  setNewClientAddress(val);
                  if (errors.newClientAddress) setErrors((prev) => ({ ...prev, newClientAddress: null }));
                }}
                placeholder="Complete street, city, province"
                maxLength={255}
                error={errors.newClientAddress}
              />
              <FormField
                label="Contact Number"
                required
                value={newClientContact}
                onChangeText={(val) => {
                  const sanitized = val.replace(/[^0-9]/g, '');
                  setNewClientContact(sanitized);
                  if (errors.newClientContact) setErrors((prev) => ({ ...prev, newClientContact: null }));
                }}
                placeholder="09170000000"
                keyboardType="phone-pad"
                integerOnly
                maxLength={11}
                error={errors.newClientContact}
              />
              <FormField
                label="Email Address"
                value={newClientEmail}
                onChangeText={setNewClientEmail}
                placeholder="billing@company.com"
                keyboardType="email-address"
                maxLength={150}
                helper="For consolidated SOA billing"
              />
            </View>
          )}
        </Card>

        {/* 2. Recipient Card */}
        <Card title="Recipient" style={[styles.halfCard, isMobile && styles.cardMobile]}>
          <View style={styles.derivedRecipientContainer}>
            <Text style={type.label}>RECIPIENT / CONSIGNEE</Text>
            <View style={styles.derivedRecipientBox}>
              <Text style={styles.derivedRecipientName}>
                {derivedRecipientName || (clientMode === 'EXISTING' ? 'Select a billing client' : 'Enter client name')}
              </Text>
              <Text style={styles.derivedRecipientSub}>
                Automatically derived from billing client
              </Text>
            </View>
          </View>
          <FormField
            label="Complete Address"
            required
            value={address}
            onChangeText={(val) => {
              setAddress(val);
              if (errors.address) setErrors((prev) => ({ ...prev, address: null }));
            }}
            placeholder="Unit, Street, Barangay, City, Province"
            maxLength={255}
            error={errors.address}
          />
          <FormField
            label="Contact Number"
            required
            value={contactNumber}
            onChangeText={(val) => {
              const sanitized = val.replace(/[^0-9]/g, '');
              setContactNumber(sanitized);
              if (errors.contactNumber) setErrors((prev) => ({ ...prev, contactNumber: null }));
            }}
            placeholder="09170000000"
            keyboardType="phone-pad"
            integerOnly
            maxLength={11}
            error={errors.contactNumber}
          />
        </Card>
      </View>

      {/* 3. Shipment & Charges Card */}
      <Card title="Shipment & Charges" style={styles.fullWidthCard}>
        {/* Row 1: Description, Route, Quantity, Add Unit Button */}
        <View style={styles.gridRow}>
          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Office supplies, electronics, etc."
              maxLength={255}
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField
              label="Route"
              value={route}
              onChangeText={setRoute}
              placeholder="Manila to TNL Labo C.N."
              maxLength={150}
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField
              label="Quantity (Parcel Units)"
              required
              value={quantityInput}
              onChangeText={handleQuantityChange}
              onBlur={handleQuantityBlur}
              onSubmitEditing={handleQuantityBlur}
              integerOnly
              placeholder="1"
              maxLength={4}
              helper="1–1,000 units. One QR per unit."
              error={errors.quantity}
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth, styles.addUnitCol]}>
            <Text style={type.label}>Add Parcel</Text>
            <TouchableOpacity
              style={styles.addUnitButton}
              onPress={addUnit}
              disabled={parcels.length >= 1000}
            >
              <Text style={styles.addUnitButtonText}>+ Add Unit #{parcels.length + 1}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Per-Unit Measurements Editor */}
        <View style={styles.dimensionsBox}>
          <View style={styles.unitsSectionHeader}>
            <Text style={styles.dimensionsHeader}>
              PARCEL UNITS ({parcels.length} {parcels.length === 1 ? 'UNIT' : 'UNITS'}) · PER-UNIT MEASUREMENTS
            </Text>
          </View>

          <View style={styles.unitsScrollContainer}>
            {parcels.map((parcel, index) => {
              const lNum = parseFloat(parcel.lengthCm);
              const wNum = parseFloat(parcel.widthCm);
              const hNum = parseFloat(parcel.heightCm);
              const hasDims = !isNaN(lNum) && lNum > 0 && !isNaN(wNum) && wNum > 0 && !isNaN(hNum) && hNum > 0;
              const unitVolume = hasDims ? (lNum * wNum * hNum) / 1000000 : null;

              return (
                <View key={parcel.id || `parcel-${index}`} style={styles.unitCard}>
                  <View style={styles.unitCardTop}>
                    <View style={styles.unitBadge}>
                      <Text style={styles.unitBadgeText}>UNIT #{parcel.seq}</Text>
                    </View>
                    {unitVolume !== null ? (
                      <Text style={styles.unitVolumeTag}>
                        {formatMeasure(unitVolume, 4, 'm³')}
                      </Text>
                    ) : null}
                    {parcels.length > 1 ? (
                      <TouchableOpacity
                        style={styles.removeUnitBtn}
                        onPress={() => removeUnit(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove unit ${parcel.seq}`}
                      >
                        <Text style={styles.removeUnitBtnText}>✕ Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.unitFieldsRow}>
                    <View style={styles.unitFieldCol}>
                      <FormField
                        label="Weight (kg)"
                        required
                        value={parcel.weightKg}
                        onChangeText={(val) => updateParcelField(index, 'weightKg', val)}
                        numericOnly
                        placeholder="1.0"
                        maxLength={9}
                        suffix="kg"
                        error={errors[`parcel_${index}_weightKg`]}
                      />
                    </View>
                    <View style={styles.unitFieldCol}>
                      <FormField
                        label="Length (cm)"
                        required
                        value={parcel.lengthCm}
                        onChangeText={(val) => updateParcelField(index, 'lengthCm', val)}
                        numericOnly
                        placeholder="20"
                        maxLength={9}
                        suffix="cm"
                        error={errors[`parcel_${index}_lengthCm`]}
                      />
                    </View>
                    <View style={styles.unitFieldCol}>
                      <FormField
                        label="Width (cm)"
                        required
                        value={parcel.widthCm}
                        onChangeText={(val) => updateParcelField(index, 'widthCm', val)}
                        numericOnly
                        placeholder="10"
                        maxLength={9}
                        suffix="cm"
                        error={errors[`parcel_${index}_widthCm`]}
                      />
                    </View>
                    <View style={styles.unitFieldCol}>
                      <FormField
                        label="Height (cm)"
                        required
                        value={parcel.heightCm}
                        onChangeText={(val) => updateParcelField(index, 'heightCm', val)}
                        numericOnly
                        placeholder="15"
                        maxLength={9}
                        suffix="cm"
                        error={errors[`parcel_${index}_heightCm`]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Row 3: Live Rating & Pricing Breakdown */}
        <View style={styles.summaryContainer}>
          <Text style={styles.dimensionsHeader}>LIVE RATING BREAKDOWN & SUMMARY</Text>
          <View style={styles.summaryGrid}>
            {/* 1. Rate per Kilo (Read-only) */}
            <View style={styles.summaryCardCol}>
              <Text style={type.label}>Rate per Kilo</Text>
              <View style={styles.readOnlyStatBox}>
                <Text style={styles.statLargeText}>
                  {ratePerKilo ? `₱${Number(ratePerKilo).toFixed(2)}` : '—'}
                </Text>
                <Text style={styles.statSubText}>Configured by Admin</Text>
              </View>
            </View>

            {/* 2. Weight Metrics */}
            <View style={styles.summaryCardCol}>
              <Text style={type.label}>Weight Summary</Text>
              <View style={styles.metricsBox}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Total Actual Weight</Text>
                  <Text style={styles.metricValue}>{formatMeasure(shipmentMetrics.actualWeight, 2, 'kg')}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Volumetric Weight (/{volumetricDivisor || 5000})</Text>
                  <Text style={styles.metricValue}>{formatMeasure(shipmentMetrics.volumetricWeight, 2, 'kg')}</Text>
                </View>
                <View style={[styles.metricRow, styles.billableRow]}>
                  <Text style={styles.billableLabel}>Billable Weight</Text>
                  <Text style={styles.billableValue}>{formatMeasure(shipmentMetrics.billableWeight, 2, 'kg')}</Text>
                </View>
              </View>
            </View>

            {/* 3. Charges & Total */}
            <View style={styles.summaryCardCol}>
              <FormField
                label="Other Charges (₱)"
                value={otherCharges}
                onChangeText={setOtherCharges}
                numericOnly
                placeholder="0"
                maxLength={13}
                helper="Valuation, packaging, etc."
                error={errors.otherCharges}
              />
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
                <Text style={styles.totalValue}>
                  ₱{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.totalFormula}>
                  {shipmentMetrics.shippingFee !== null ? `₱${shipmentMetrics.shippingFee.toFixed(2)} shipping` : '—'}
                  {' + ₱'}{(parseFloat(otherCharges) || 0).toFixed(2)} charges
                </Text>
              </View>
            </View>
          </View>

          {/* Settings Status Notice */}
          {calculationSettingsState === 'loading' ? (
            <View style={styles.settingsStatusRow}>
              <ActivityIndicator color={colors.inkSoft} size="small" />
              <Text style={styles.settingsMessage}>Loading rate and weight settings from server...</Text>
            </View>
          ) : null}

          {calculationSettingsState === 'unconfigured' ? (
            <View style={styles.settingsAlertBox}>
              <Text style={styles.settingsAlertTitle}>Rate per Kilo Not Configured</Text>
              <Text style={styles.settingsAlertMessage}>
                Shipment registration is blocked because Rate per Kilo is not configured. An administrator must set the rate in Settings before shipments can be registered.
              </Text>
            </View>
          ) : null}

          {calculationSettingsState === 'error' ? (
            <View style={styles.settingsErrorBox}>
              <Text style={styles.settingsAlertTitle}>Calculation Settings Unavailable</Text>
              <Text style={styles.settingsAlertMessage}>
                Unable to load rate and divisor settings from server. Please check connection and retry.
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={onRetryCalculationSettings} style={styles.settingsRetry}>
                <Text style={styles.settingsRetryText}>Retry Settings</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Footer Row: Paid at Registration Toggle & Submit Button */}
        <View style={[styles.footerRow, isMobile && styles.footerRowMobile]}>
          <View style={styles.paidToggleContainer}>
            <Switch
              value={paidAtRegistration}
              onValueChange={setPaidAtRegistration}
              trackColor={{ false: '#D1D5DB', true: colors.black }}
              thumbColor={paidAtRegistration ? colors.accent : '#FFFFFF'}
            />
            <View style={styles.paidToggleLabels}>
              <Text style={styles.paidToggleTitle}>Paid at Registration</Text>
              <Text style={styles.paidToggleSub}>
                {paidAtRegistration ? 'Immediate Cash Payment (Creates Payment Record)' : 'Unpaid (To be billed in Statement of Account)'}
              </Text>
            </View>
          </View>

          <View style={[styles.submitContainer, isMobile && styles.submitContainerMobile]}>
            <Button
              label={submitting ? 'Registering...' : `Register & Generate ${parcels.length} QR`}
              variant="primary"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              fullWidth={isMobile}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    zIndex: 100,
    position: 'relative',
  },
  topRowMobile: {
    flexDirection: 'column',
    zIndex: 100,
  },
  halfCard: {
    flex: 1,
    minWidth: 280,
  },
  cardMobile: {
    width: '100%',
    minWidth: '100%',
  },
  clientCard: {
    overflow: 'visible',
    zIndex: 50,
  },
  clientCardBody: {
    overflow: 'visible',
  },
  fullWidthCard: {
    marginBottom: spacing.lg,
    width: '100%',
  },
  pillToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  pillBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
  },
  pillBtnActive: {
    backgroundColor: '#000000',
  },
  pillBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#666666',
  },
  pillBtnTextActive: {
    color: '#FFFFFF',
  },
  newClientFields: {
    marginTop: 2,
  },
  helperNote: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    lineHeight: 16,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  gridCol: {
    marginBottom: spacing.xs,
  },
  colFull: {
    width: '100%',
  },
  colHalf: {
    width: '47%',
    minWidth: 240,
    flex: 1,
  },
  colFourth: {
    width: '23%',
    minWidth: 180,
    flex: 1,
  },
  dimensionsBox: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  dimensionsHeader: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  dimensionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  dimField: {
    flex: 1,
    minWidth: 100,
  },
  metricsResultBox: {
    flex: 1.5,
    minWidth: 260,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    justifyContent: 'center',
  },
  volumeLabel: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.6,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metricLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
  },
  metricValue: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  billableRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  billableLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
  billableValue: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '900',
    color: colors.ink,
  },
  settingsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  settingsError: {
    marginTop: spacing.sm,
  },
  settingsMessage: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    lineHeight: 15,
  },
  settingsRetry: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  settingsRetryText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  totalBox: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs + 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    minHeight: 70,
  },
  totalLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: colors.inkFaint,
    letterSpacing: 0.8,
  },
  totalValue: {
    fontFamily: fonts.sans,
    fontSize: 24,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  totalFormula: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  derivedRecipientContainer: {
    marginBottom: spacing.md,
  },
  derivedRecipientBox: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  derivedRecipientName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  derivedRecipientSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  addUnitCol: {
    justifyContent: 'flex-start',
  },
  addUnitButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    backgroundColor: '#FFFFFF',
  },
  addUnitButtonText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  unitsSectionHeader: {
    marginBottom: spacing.sm,
  },
  unitsScrollContainer: {
    gap: spacing.md,
  },
  unitCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  unitCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  unitBadge: {
    backgroundColor: colors.black,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  unitBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  unitVolumeTag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkSoft,
    flex: 1,
    marginLeft: spacing.sm,
  },
  removeUnitBtn: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  removeUnitBtnText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  unitFieldsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  unitFieldCol: {
    flex: 1,
    minWidth: 120,
  },
  summaryContainer: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  summaryCardCol: {
    flex: 1,
    minWidth: 240,
  },
  readOnlyStatBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    marginTop: spacing.xs,
    justifyContent: 'center',
    minHeight: 70,
  },
  statLargeText: {
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '900',
    color: colors.ink,
  },
  statSubText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  metricsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs,
    justifyContent: 'center',
  },
  settingsAlertBox: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  settingsAlertTitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2,
  },
  settingsAlertMessage: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
    lineHeight: 16,
  },
  settingsErrorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  footerRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  paidToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 260,
  },
  paidToggleLabels: {
    flex: 1,
  },
  paidToggleTitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  paidToggleSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 1,
  },
  submitContainer: {
    alignItems: 'flex-end',
  },
  submitContainerMobile: {
    width: '100%',
    alignItems: 'stretch',
    marginTop: spacing.sm,
  },
});
