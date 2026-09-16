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
        error={errors.companyName}
        style={styles.field}
      />
      <FormField
        label="ADDRESS"
        required
        value={form.companyAddress}
        onChangeText={(val) => onChangeField('companyAddress', val)}
        placeholder="Labo, Camarines Norte"
        error={errors.companyAddress}
        style={styles.field}
      />
      <FormField
        label="CONTACT"
        required
        value={form.companyContact}
        onChangeText={(val) => onChangeField('companyContact', val)}
        placeholder="0917-555-0000"
        error={errors.companyContact}
        style={styles.field}
      />
      <FormField
        label="BILLING EMAIL"
        required
        value={form.billingEmail}
        onChangeText={(val) => onChangeField('billingEmail', val)}
        placeholder="billing@tnllogistics.ph"
        keyboardType="email-address"
        error={errors.billingEmail}
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
