import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './common/Card';
import FormField from './common/FormField';
import SelectField from './common/SelectField';
import Button from './common/Button';
import { colors, fonts, spacing, radius, type } from '../constants/theme';

const CHARGE_MODELS = [
  { value: 'FLAT', label: 'Flat (shipment-level)' },
  { value: 'PER_UNIT', label: 'Per unit' },
];

/**
 * Mirrors the prototype's "Register Shipment" screen: client/billing party
 * on the left, recipient on the right, shipment & charges spanning below.
 *
 * clients: [{ id, code, name }] loaded from GET /clients
 * nextShipmentPreview: { shipmentId, firstTrackingId, unitCount } from backend,
 *   shown as the confirmation strip above the submit button.
 * onSubmit(payload) is called with the assembled shipment payload.
 */
export default function ShipmentForm({ clients = [], nextShipmentPreview, onSubmit, submitting }) {
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [recipientName, setRecipientName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [weightPerUnit, setWeightPerUnit] = useState('1');
  const [route, setRoute] = useState('Manila → TNL Baguio');
  const [chargeModel, setChargeModel] = useState('FLAT');
  const [shippingFee, setShippingFee] = useState('');
  const [otherCharges, setOtherCharges] = useState('0');

  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    [clients]
  );

  const totalAmount = useMemo(() => {
    const fee = parseFloat(shippingFee) || 0;
    const other = parseFloat(otherCharges) || 0;
    const qty = parseInt(quantity, 10) || 0;
    if (chargeModel === 'PER_UNIT') {
      return fee * qty + other;
    }
    return fee + other;
  }, [shippingFee, otherCharges, chargeModel, quantity]);

  const canSubmit =
    clientId && recipientName.trim() && address.trim() && contactNumber.trim() && quantity && shippingFee;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit?.({
      clientId,
      recipient: {
        fullName: recipientName,
        address,
        contactNumber,
      },
      description,
      quantity: parseInt(quantity, 10),
      weightPerUnit: parseFloat(weightPerUnit),
      route,
      chargeModel,
      shippingFee: parseFloat(shippingFee) || 0,
      otherCharges: parseFloat(otherCharges) || 0,
      totalAmount,
    });
  }

  return (
    <View>
      <View style={styles.topRow}>
        <Card
          title="Client / Billing Party"
          right={<Text style={styles.existingPill}>Existing</Text>}
          style={styles.half}
        >
          <SelectField
            label="Select Client"
            required
            value={clientId}
            onValueChange={setClientId}
            options={clientOptions.length ? clientOptions : [{ value: '', label: 'No clients yet' }]}
          />
          <Text style={styles.helperNote}>
            Payments consolidate per client — multiple shipments bill as one SOA.
          </Text>
        </Card>

        <Card title="Recipient" style={styles.half}>
          <FormField
            label="Full Name"
            required
            value={recipientName}
            onChangeText={setRecipientName}
            placeholder="Juan Dela Cruz"
          />
          <FormField
            label="Complete Address"
            required
            value={address}
            onChangeText={setAddress}
            placeholder=""
          />
          <FormField
            label="Contact Number"
            required
            value={contactNumber}
            onChangeText={setContactNumber}
            placeholder="0917-000-0000"
            keyboardType="phone-pad"
          />
        </Card>
      </View>

      <Card title="Shipment & Charges" style={styles.fullWidthCard}>
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <FormField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Office supplies"
            />
          </View>
          <View style={styles.gridCol}>
            <FormField
              label="Quantity (Parcel Units)"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              helper="One unique QR per unit"
            />
          </View>
          <View style={styles.gridCol}>
            <FormField
              label="Weight per Unit (kg)"
              value={weightPerUnit}
              onChangeText={setWeightPerUnit}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.gridCol}>
            <FormField label="Route" value={route} onChangeText={setRoute} />
          </View>

          <View style={styles.gridCol}>
            <SelectField
              label="Charge Model"
              value={chargeModel}
              onValueChange={setChargeModel}
              options={CHARGE_MODELS}
            />
          </View>
          <View style={styles.gridCol}>
            <FormField
              label="Shipping Fee (₱)"
              required
              value={shippingFee}
              onChangeText={setShippingFee}
              keyboardType="numeric"
              placeholder="500"
              helper={chargeModel === 'FLAT' ? 'Quantity does not auto-multiply flat charges' : undefined}
            />
          </View>
          <View style={styles.gridCol}>
            <FormField
              label="Other Charges (₱)"
              value={otherCharges}
              onChangeText={setOtherCharges}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
          <View style={styles.gridCol}>
            <Text style={type.label}>Total Amount</Text>
            <View style={styles.totalBox}>
              <Text style={styles.totalValue}>₱{totalAmount.toLocaleString()}</Text>
              <Text style={styles.totalFormula}>
                {chargeModel === 'FLAT' ? 'flat' : 'per unit'} ₱{(parseFloat(shippingFee) || 0).toLocaleString()}
                {' + '}₱{(parseFloat(otherCharges) || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.previewText}>
            {nextShipmentPreview ? (
              <>
                Next Shipment:{' '}
                <Text style={styles.previewStrong}>{nextShipmentPreview.shipmentId}</Text>
                {'  ·  first Tracking ID '}
                <Text style={styles.previewStrong}>{nextShipmentPreview.firstTrackingId}</Text>
                {`  ·  ${nextShipmentPreview.unitCount} QR / label`}
              </>
            ) : (
              ' '
            )}
          </Text>
          <Button
            label={`Register & Generate ${quantity || 0} QR →`}
            variant="primary"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  half: {
    flex: 1,
  },
  fullWidthCard: {
    marginBottom: spacing.lg,
  },
  existingPill: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: colors.black,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  helperNote: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  gridCol: {
    width: '23%',
    minWidth: 180,
  },
  totalBox: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs + 2,
  },
  totalValue: {
    fontFamily: fonts.sans,
    fontSize: 26,
    fontWeight: '800',
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
  },
  previewText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkFaint,
    flex: 1,
  },
  previewStrong: {
    color: colors.ink,
    fontWeight: '700',
  },
});
