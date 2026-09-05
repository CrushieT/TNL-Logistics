import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fonts, spacing, radius, type } from '../../../theme';

/**
 * DeductionsInputCard matches the deductions and collector action bar from prototype soa page.png:
 * - DEDUCTION (₱)
 * - DEDUCTION NOTE
 * - COLLECTED BY dropdown (with active staff, None, and Other free-text)
 * - Save button
 */
export default function DeductionsInputCard({
  deductionAmount,
  onDeductionAmountChange,
  deductionNote,
  onDeductionNoteChange,
  collectedBy,
  onCollectedByChange,
  collectors = [],
  onSave,
  saving = false,
  disabled = false,
  maxDeduction = null,
}) {
  const [collectorMode, setCollectorMode] = useState('select'); // 'select' | 'custom'
  const [customCollector, setCustomCollector] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const numDeduction = Number(deductionAmount) || 0;
  const isExceedingTotal = maxDeduction !== null && maxDeduction !== undefined && numDeduction > Number(maxDeduction);

  useEffect(() => {
    if (collectedBy) {
      const match = collectors.find((c) => c.fullName === collectedBy || c.username === collectedBy);
      if (!match && collectedBy !== '') {
        setCollectorMode('custom');
        setCustomCollector(collectedBy);
      } else {
        setCollectorMode('select');
      }
    } else {
      setCollectorMode('select');
      setCustomCollector('');
    }
  }, [collectedBy, collectors]);

  const handleSelectCollector = (name) => {
    if (name === '__OTHER__') {
      setCollectorMode('custom');
      setCustomCollector('');
      onCollectedByChange('');
    } else {
      setCollectorMode('select');
      onCollectedByChange(name);
    }
    setDropdownOpen(false);
  };

  const handleCustomChange = (text) => {
    setCustomCollector(text);
    onCollectedByChange(text);
  };

  return (
    <View style={styles.card}>
      {/* Column 1: DEDUCTION (₱) */}
      <View style={styles.col}>
        <Text style={styles.label}>DEDUCTION (₱)</Text>
        <TextInput
          style={[
            styles.input,
            disabled && styles.inputDisabled,
            isExceedingTotal && styles.inputError,
          ]}
          value={String(deductionAmount === 0 ? '0' : deductionAmount || '')}
          onChangeText={(val) => {
            let sanitized = val.replace(/[^0-9.]/g, '');
            const parts = sanitized.split('.');
            if (parts.length > 2) {
              sanitized = `${parts[0]}.${parts.slice(1).join('')}`;
            }
            if (parts.length >= 2) {
              sanitized = `${parts[0]}.${parts[1].slice(0, 2)}`;
            }
            onDeductionAmountChange(sanitized);
          }}
          placeholder="0"
          placeholderTextColor={colors.inkFaint}
          keyboardType="numeric"
          maxLength={12}
          editable={!disabled}
        />
        <Text style={[styles.subtext, isExceedingTotal && styles.subtextError]}>
          {isExceedingTotal
            ? `Cannot exceed total charges (₱${Number(maxDeduction).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
            : 'Separate from original charges — max 2 decimals'}
        </Text>
      </View>

      {/* Column 2: DEDUCTION NOTE */}
      <View style={[styles.col, styles.colWide]}>
        <Text style={styles.label}>DEDUCTION NOTE</Text>
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          value={deductionNote}
          onChangeText={onDeductionNoteChange}
          placeholder="e.g. Negotiated discount"
          placeholderTextColor={colors.inkFaint}
          maxLength={255}
          editable={!disabled}
        />
        <Text style={styles.counterText}>{`${(deductionNote || '').length}/255`}</Text>
      </View>

      {/* Column 3: COLLECTED BY + Save */}
      <View style={[styles.col, styles.colCollector]}>
        <Text style={styles.label}>COLLECTED BY</Text>
        <View style={styles.actionRow}>
          {collectorMode === 'custom' ? (
            <View style={styles.customWrap}>
              <TextInput
                style={[styles.input, styles.customInput]}
                value={customCollector}
                onChangeText={handleCustomChange}
                placeholder="Enter collector name"
                placeholderTextColor={colors.inkFaint}
                maxLength={150}
                editable={!disabled}
              />
              <TouchableOpacity
                style={styles.cancelCustomBtn}
                onPress={() => {
                  setCollectorMode('select');
                  onCollectedByChange('');
                }}
              >
                <Text style={styles.cancelCustomText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectWrap}>
              <TouchableOpacity
                style={[styles.dropdownButton, disabled && styles.inputDisabled]}
                onPress={() => !disabled && setDropdownOpen((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownButtonText,
                    !collectedBy && styles.dropdownPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {collectedBy || '— select collector —'}
                </Text>
                <Text style={styles.dropdownCaret}>▾</Text>
              </TouchableOpacity>

              {dropdownOpen && (
                <View style={styles.dropdownMenu}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleSelectCollector('')}
                  >
                    <Text style={styles.dropdownItemTextMuted}>— None (Leave blank) —</Text>
                  </TouchableOpacity>

                  {collectors.map((c) => (
                    <TouchableOpacity
                      key={c.userId}
                      style={[
                        styles.dropdownItem,
                        collectedBy === c.fullName && styles.dropdownItemSelected,
                      ]}
                      onPress={() => handleSelectCollector(c.fullName)}
                    >
                      <Text style={styles.dropdownItemText}>{c.fullName}</Text>
                      {c.role ? <Text style={styles.roleBadge}>{c.role}</Text> : null}
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={[styles.dropdownItem, styles.dropdownItemDivider]}
                    onPress={() => handleSelectCollector('__OTHER__')}
                  >
                    <Text style={styles.dropdownItemTextSpecial}>+ Other (Specify custom name)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, (saving || disabled || isExceedingTotal) && styles.saveButtonDisabled]}
            onPress={onSave}
            disabled={saving || disabled || isExceedingTotal}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.subtext}>Select from authorized staff</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.md,
    zIndex: 10,
  },
  col: {
    flex: 1,
    minWidth: 200,
  },
  colWide: {
    flex: 1.5,
    minWidth: 240,
  },
  colCollector: {
    flex: 2,
    minWidth: 320,
    zIndex: 20,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    outlineStyle: 'none',
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  inputDisabled: {
    backgroundColor: colors.canvas,
    color: colors.inkMuted,
  },
  subtext: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 4,
  },
  subtextError: {
    color: colors.danger,
    fontWeight: '600',
  },
  subtextSpacer: {
    height: 15,
  },
  counterText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkFaint,
    textAlign: 'right',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    position: 'relative',
    zIndex: 30,
  },
  selectWrap: {
    flex: 1,
    position: 'relative',
  },
  dropdownButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: colors.inkFaint,
  },
  dropdownCaret: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkMuted,
    marginLeft: spacing.xs,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
    maxHeight: 220,
  },
  dropdownItem: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dropdownItemSelected: {
    backgroundColor: colors.canvas,
  },
  dropdownItemDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas,
  },
  dropdownItemText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink,
  },
  dropdownItemTextMuted: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  dropdownItemTextSpecial: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  roleBadge: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkMuted,
    backgroundColor: colors.borderLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  customWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    paddingRight: 28,
  },
  cancelCustomBtn: {
    position: 'absolute',
    right: 8,
    padding: 4,
  },
  cancelCustomText: {
    fontSize: 12,
    color: colors.inkMuted,
    fontWeight: 'bold',
  },
  saveButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
});
