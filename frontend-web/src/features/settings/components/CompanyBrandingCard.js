import React from 'react';
import { View, StyleSheet } from 'react-native';
import Card from '../../../components/common/Card';
import FormField from '../../../components/common/FormField';
import { spacing } from '../../../theme';

export default function CompanyBrandingCard({
  form,
  errors,
  onChangeField,
}) {
  return (
    <Card title="COMPANY / SOA BRANDING" style={styles.card}>
      <FormField
        label="BUSINESS NAME"
        required
        value={form.companyName}
        onChangeText={(val) => onChangeField('companyName', val)}
        placeholder="TC & CT Integrated Logistics"
        maxLength={50}
        error={errors.companyName}
        style={styles.field}
      />
      <FormField
        label="ADDRESS"
        required
        value={form.companyAddress}
        onChangeText={(val) => onChangeField('companyAddress', val)}
        placeholder="Labo, Camarines Norte"
        maxLength={100}
        error={errors.companyAddress}
        style={styles.field}
      />
      <FormField
        label="CONTACT"
        required
        value={form.companyContact}
        onChangeText={(val) => onChangeField('companyContact', val.replace(/[^0-9]/g, ''))}
        placeholder="09175550000"
        maxLength={11}
        keyboardType="phone-pad"
        error={errors.companyContact}
        style={styles.field}
      />
      <FormField
        label="BILLING EMAIL"
        required
        value={form.billingEmail}
        onChangeText={(val) => onChangeField('billingEmail', val)}
        placeholder="billing@tnllogistics.ph"
        maxLength={50}
        keyboardType="email-address"
        error={errors.billingEmail}
        style={styles.field}
      />
      <FormField
        label="SOA BANK NAME"
        required
        value={form.soaBankName}
        onChangeText={(val) => onChangeField('soaBankName', val)}
        placeholder="Bank name"
        maxLength={100}
        error={errors.soaBankName}
        style={styles.field}
      />
      <FormField
        label="SOA ACCOUNT NAME"
        required
        value={form.soaAccountName}
        onChangeText={(val) => onChangeField('soaAccountName', val)}
        placeholder="Account name"
        maxLength={150}
        error={errors.soaAccountName}
        style={styles.field}
      />
      <FormField
        label="SOA ACCOUNT NUMBER"
        required
        value={form.soaAccountNumber}
        onChangeText={(val) => onChangeField('soaAccountNumber', val)}
        placeholder="6 to 20 digits"
        maxLength={20}
        keyboardType="number-pad"
        error={errors.soaAccountNumber}
        style={styles.field}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  field: {
    marginBottom: spacing.md,
  },
});
