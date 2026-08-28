import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, useWindowDimensions } from 'react-native';
import Card from '../../../components/common/Card';
import FormField from '../../../components/common/FormField';
import SelectField from '../../../components/common/SelectField';
import Button from '../../../components/common/Button';
import { colors, fonts, spacing, radius, type } from '../../../theme';

const CHARGE_MODELS = [
  { value: 'FLAT', label: 'Flat (shipment-level)' },
  { value: 'PER_UNIT', label: 'Per unit' },
];

export default function ShipmentForm({ clients = [], nextShipmentPreview, onSubmit, submitting }) {
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

  // Recipient Details
  const [recipientName, setRecipientName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // Shipment & Parcel Details
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [weightPerUnit, setWeightPerUnit] = useState('1');
  const [lengthCm, setLengthCm] = useState('20');
  const [widthCm, setWidthCm] = useState('10');
  const [heightCm, setHeightCm] = useState('15');

  // Charges & Options
  const [route, setRoute] = useState('Manila → TNL Baguio');
  const [chargeModel, setChargeModel] = useState('FLAT');
  const [shippingFee, setShippingFee] = useState('500');
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

  const clientOptions = useMemo(
    () =>
      (clients || [])
        .filter((c) => c.active !== false)
        .map((c) => {
          const val = c.id || c.clientId;
          const code = c.code || c.clientId || c.id;
          return { value: val, label: `${code} — ${c.name}` };
        }),
    [clients]
  );

  // Live Total Calculation
  const totalAmount = useMemo(() => {
    const fee = parseFloat(shippingFee) || 0;
    const other = parseFloat(otherCharges) || 0;
    const qty = parseInt(quantity, 10) || 0;
    if (chargeModel === 'PER_UNIT') {
      return fee * qty + other;
    }
    return fee + other;
  }, [shippingFee, otherCharges, chargeModel, quantity]);

  // Live Volume Calculation: (L * W * H) / 1,000,000
  const volumeStats = useMemo(() => {
    const l = parseFloat(lengthCm) || 0;
    const w = parseFloat(widthCm) || 0;
    const h = parseFloat(heightCm) || 0;
    const qty = parseInt(quantity, 10) || 1;

    const unitCbm = (l * w * h) / 1000000;
    const totalCbm = unitCbm * qty;

    return {
      unitCbm: unitCbm.toFixed(4),
      totalCbm: totalCbm.toFixed(4),
    };
  }, [lengthCm, widthCm, heightCm, quantity]);

  function validateForm() {
    const newErrors = {};

    if (clientMode === 'EXISTING') {
      const activeClientId = clientId || (clients.length > 0 ? (clients[0].id || clients[0].clientId) : '');
      if (!activeClientId) newErrors.clientId = 'Please select a billing client.';
    } else {
      if (!newClientName.trim()) newErrors.newClientName = 'Client / Company name is required.';
      if (!newClientAddress.trim()) newErrors.newClientAddress = 'Billing address is required.';
      if (!newClientContact.trim() || newClientContact.trim().length < 7) {
        newErrors.newClientContact = 'Valid contact number is required (min 7 digits).';
      }
    }

    if (!recipientName.trim()) newErrors.recipientName = 'Recipient full name is required.';
    if (!address.trim()) newErrors.address = 'Complete delivery address is required.';
    if (!contactNumber.trim() || contactNumber.trim().length < 7) {
      newErrors.contactNumber = 'Valid contact number is required (min 7 digits).';
    }

    const qtyNum = parseInt(quantity, 10);
    if (!quantity || isNaN(qtyNum) || qtyNum < 1) {
      newErrors.quantity = 'Quantity must be at least 1.';
    }

    const wtNum = parseFloat(weightPerUnit);
    if (!weightPerUnit || isNaN(wtNum) || wtNum <= 0) {
      newErrors.weightPerUnit = 'Weight must be greater than 0 kg.';
    }

    const lNum = parseFloat(lengthCm);
    const wNum = parseFloat(widthCm);
    const hNum = parseFloat(heightCm);
    if (isNaN(lNum) || lNum <= 0) newErrors.lengthCm = 'Required';
    if (isNaN(wNum) || wNum <= 0) newErrors.widthCm = 'Required';
    if (isNaN(hNum) || hNum <= 0) newErrors.heightCm = 'Required';

    const feeNum = parseFloat(shippingFee);
    if (shippingFee === '' || isNaN(feeNum) || feeNum < 0) {
      newErrors.shippingFee = 'Shipping fee is required (cannot be negative).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validateForm()) return;

    const basePayload = {
      recipient: {
        fullName: recipientName.trim(),
        address: address.trim(),
        contactNumber: contactNumber.trim(),
      },
      description: description.trim() || 'General Goods',
      quantity: parseInt(quantity, 10),
      weightPerUnit: parseFloat(weightPerUnit),
      lengthCm: parseFloat(lengthCm) || 20.0,
      widthCm: parseFloat(widthCm) || 10.0,
      heightCm: parseFloat(heightCm) || 15.0,
      route: route.trim() || 'Manila → TNL Baguio',
      chargeModel,
      shippingFee: parseFloat(shippingFee) || 0,
      otherCharges: parseFloat(otherCharges) || 0,
      paidAtRegistration,
      totalAmount,
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
          style={[styles.halfCard, isMobile && styles.cardMobile]}
        >
          {clientMode === 'EXISTING' ? (
            <>
              <SelectField
                label="Select Client"
                required
                value={clientId}
                onValueChange={(val) => {
                  setClientId(val);
                  if (errors.clientId) setErrors((prev) => ({ ...prev, clientId: null }));
                }}
                options={clientOptions.length ? clientOptions : [{ value: '', label: 'No clients loaded' }]}
                error={errors.clientId}
              />
              <Text style={styles.helperNote}>
                Payments consolidate per client — multiple shipments bill as one SOA.
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
                error={errors.newClientAddress}
              />
              <FormField
                label="Contact Number"
                required
                value={newClientContact}
                onChangeText={(val) => {
                  const sanitized = val.replace(/[^0-9+\-() ]/g, '');
                  setNewClientContact(sanitized);
                  if (errors.newClientContact) setErrors((prev) => ({ ...prev, newClientContact: null }));
                }}
                placeholder="0917-000-0000"
                keyboardType="phone-pad"
                error={errors.newClientContact}
              />
              <FormField
                label="Email Address"
                value={newClientEmail}
                onChangeText={setNewClientEmail}
                placeholder="billing@company.com"
                keyboardType="email-address"
                helper="For consolidated SOA billing"
              />
            </View>
          )}
        </Card>

        {/* 2. Recipient Card */}
        <Card title="Recipient" style={[styles.halfCard, isMobile && styles.cardMobile]}>
          <FormField
            label="Full Name"
            required
            value={recipientName}
            onChangeText={(val) => {
              setRecipientName(val);
              if (errors.recipientName) setErrors((prev) => ({ ...prev, recipientName: null }));
            }}
            placeholder="Juan Dela Cruz"
            error={errors.recipientName}
          />
          <FormField
            label="Complete Address"
            required
            value={address}
            onChangeText={(val) => {
              setAddress(val);
              if (errors.address) setErrors((prev) => ({ ...prev, address: null }));
            }}
            placeholder="Unit, Street, Barangay, City, Province"
            error={errors.address}
          />
          <FormField
            label="Contact Number"
            required
            value={contactNumber}
            onChangeText={(val) => {
              const sanitized = val.replace(/[^0-9+\-() ]/g, '');
              setContactNumber(sanitized);
              if (errors.contactNumber) setErrors((prev) => ({ ...prev, contactNumber: null }));
            }}
            placeholder="0917-000-0000"
            keyboardType="phone-pad"
            error={errors.contactNumber}
          />
        </Card>
      </View>

      {/* 3. Shipment & Charges Card */}
      <Card title="Shipment & Charges" style={styles.fullWidthCard}>
        {/* Row 1: Description, Quantity, Weight, Route */}
        <View style={styles.gridRow}>
          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Office supplies, electronics, etc."
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField
              label="Quantity (Parcel Units)"
              required
              value={quantity}
              onChangeText={(val) => {
                setQuantity(val);
                if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: null }));
              }}
              integerOnly
              placeholder="1"
              helper="One unique QR per unit"
              error={errors.quantity}
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField
              label="Weight per Unit (kg)"
              required
              value={weightPerUnit}
              onChangeText={(val) => {
                setWeightPerUnit(val);
                if (errors.weightPerUnit) setErrors((prev) => ({ ...prev, weightPerUnit: null }));
              }}
              numericOnly
              placeholder="1.0"
              suffix="kg"
              error={errors.weightPerUnit}
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField label="Route" value={route} onChangeText={setRoute} placeholder="Manila → TNL Baguio" />
          </View>
        </View>

        {/* Row 2: Parcel Dimensions & Auto-Calculated Volume */}
        <View style={styles.dimensionsBox}>
          <Text style={styles.dimensionsHeader}>PARCEL DIMENSIONS & VOLUME</Text>
          <View style={styles.dimensionsRow}>
            <View style={styles.dimField}>
              <FormField
                label="Length (cm)"
                value={lengthCm}
                onChangeText={(val) => {
                  setLengthCm(val);
                  if (errors.lengthCm) setErrors((prev) => ({ ...prev, lengthCm: null }));
                }}
                numericOnly
                placeholder="20"
                suffix="cm"
                error={errors.lengthCm}
              />
            </View>
            <View style={styles.dimField}>
              <FormField
                label="Width (cm)"
                value={widthCm}
                onChangeText={(val) => {
                  setWidthCm(val);
                  if (errors.widthCm) setErrors((prev) => ({ ...prev, widthCm: null }));
                }}
                numericOnly
                placeholder="10"
                suffix="cm"
                error={errors.widthCm}
              />
            </View>
            <View style={styles.dimField}>
              <FormField
                label="Height (cm)"
                value={heightCm}
                onChangeText={(val) => {
                  setHeightCm(val);
                  if (errors.heightCm) setErrors((prev) => ({ ...prev, heightCm: null }));
                }}
                numericOnly
                placeholder="15"
                suffix="cm"
                error={errors.heightCm}
              />
            </View>
            <View style={styles.volumeResultBox}>
              <Text style={styles.volumeLabel}>CALCULATED VOLUME</Text>
              <Text style={styles.volumeValue}>{volumeStats.unitCbm} m³</Text>
              <Text style={styles.volumeSub}>Total ({quantity || 1} units): {volumeStats.totalCbm} m³</Text>
            </View>
          </View>
        </View>

        {/* Row 3: Charge Model, Shipping Fee, Other Charges, Total Amount */}
        <View style={styles.gridRow}>
          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <SelectField
              label="Charge Model"
              value={chargeModel}
              onValueChange={setChargeModel}
              options={CHARGE_MODELS}
              helper={chargeModel === 'FLAT' ? 'Flat rate for entire shipment' : 'Multiplies shipping fee by parcel quantity'}
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField
              label="Shipping Fee (₱)"
              required
              value={shippingFee}
              onChangeText={(val) => {
                setShippingFee(val);
                if (errors.shippingFee) setErrors((prev) => ({ ...prev, shippingFee: null }));
              }}
              numericOnly
              placeholder="500"
              error={errors.shippingFee}
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <FormField
              label="Other Charges (₱)"
              value={otherCharges}
              onChangeText={setOtherCharges}
              numericOnly
              placeholder="0"
              helper="Valuation, packaging, etc."
            />
          </View>

          <View style={[styles.gridCol, isMobile ? styles.colFull : isTablet ? styles.colHalf : styles.colFourth]}>
            <Text style={type.label}>Total Amount</Text>
            <View style={styles.totalBox}>
              <Text style={styles.totalValue}>₱{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
              <Text style={styles.totalFormula}>
                {chargeModel === 'FLAT' ? 'flat' : `₱${(parseFloat(shippingFee) || 0).toLocaleString()} × ${quantity || 1}`}
                {' + ₱'}{(parseFloat(otherCharges) || 0).toLocaleString()}
              </Text>
            </View>
          </View>
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
              label={submitting ? 'Registering...' : `Register & Generate ${quantity || 1} QR →`}
              variant="primary"
              onPress={handleSubmit}
              loading={submitting}
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
  },
  topRowMobile: {
    flexDirection: 'column',
  },
  halfCard: {
    flex: 1,
    minWidth: 280,
  },
  cardMobile: {
    width: '100%',
    minWidth: '100%',
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
  volumeResultBox: {
    flex: 1.5,
    minWidth: 160,
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
  volumeValue: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2,
  },
  volumeSub: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: 2,
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
