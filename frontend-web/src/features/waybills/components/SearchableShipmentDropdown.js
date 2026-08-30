import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors, fonts, spacing, radius, waybillStyles } from '../../../theme';

export default function SearchableShipmentDropdown({
  shipments = [],
  selectedShipmentId = '',
  onSelectShipment,
  loading = false,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  // Find currently selected shipment object
  const currentSelected = useMemo(
    () => shipments.find((s) => s.shipmentId === selectedShipmentId),
    [shipments, selectedShipmentId]
  );

  // Synchronize input text with selected shipment when popover is closed
  useEffect(() => {
    if (!isOpen && currentSelected) {
      setQuery(`${currentSelected.shipmentId} · ${currentSelected.recipientName} (${currentSelected.clientName})`);
    } else if (!isOpen && !selectedShipmentId) {
      setQuery('');
    }
  }, [selectedShipmentId, currentSelected, isOpen]);

  // Filter recommendations based on active search query
  const filteredShipments = useMemo(() => {
    if (!isOpen) return [];

    // If query is the current selected string representation, return all shipments
    const selectedDisplay = currentSelected
      ? `${currentSelected.shipmentId} · ${currentSelected.recipientName} (${currentSelected.clientName})`
      : '';

    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery || cleanQuery === selectedDisplay.toLowerCase()) {
      return shipments;
    }

    return shipments.filter((s) => {
      const matchId = s.shipmentId?.toLowerCase().includes(cleanQuery);
      const matchRecipient = s.recipientName?.toLowerCase().includes(cleanQuery);
      const matchClient = s.clientName?.toLowerCase().includes(cleanQuery);
      const matchDestination = s.destination?.toLowerCase().includes(cleanQuery);
      const matchTracking = (s.trackingNumbers || []).some((tn) =>
        tn.toLowerCase().includes(cleanQuery)
      );

      return matchId || matchRecipient || matchClient || matchDestination || matchTracking;
    });
  }, [shipments, query, isOpen, currentSelected]);

  const handleFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setIsFocused(true);
    setIsOpen(true);
    // If input had the formatted display text, highlight or keep for search
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Delay closing slightly so user click on a recommendation item fires first
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      if (currentSelected) {
        setQuery(`${currentSelected.shipmentId} · ${currentSelected.recipientName} (${currentSelected.clientName})`);
      }
    }, 200);
  };

  const handleSelect = (shipment) => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setIsOpen(false);
    setIsFocused(false);
    setQuery(`${shipment.shipmentId} · ${shipment.recipientName} (${shipment.clientName})`);
    onSelectShipment?.(shipment.shipmentId);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(true);
  };

  const toggleDropdown = () => {
    if (isOpen) {
      setIsOpen(false);
      if (currentSelected) {
        setQuery(`${currentSelected.shipmentId} · ${currentSelected.recipientName} (${currentSelected.clientName})`);
      }
    } else {
      setIsOpen(true);
    }
  };

  return (
    <View ref={containerRef} style={styles.wrapper}>
      {/* Search Input Box */}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          isOpen && styles.inputContainerOpen,
        ]}
      >
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search by recipient name, shipment ID, tracking #, or client..."
          placeholderTextColor={colors.inkFaint}
          style={styles.textInput}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Clear Button */}
        {query.length > 0 && isFocused ? (
          <Pressable
            onPress={handleClear}
            style={({ hovered }) => [styles.clearBtn, hovered && styles.clearBtnHovered]}
            hitSlop={8}
          >
            <Text style={styles.clearBtnText}>✕</Text>
          </Pressable>
        ) : null}

        {/* Caret Toggle Button */}
        <Pressable
          onPress={toggleDropdown}
          style={({ hovered }) => [styles.caretBtn, hovered && styles.caretBtnHovered]}
        >
          <Text style={styles.caretText}>{isOpen ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {/* Floating Recommendation Dropdown Menu */}
      {isOpen && (
        <View style={styles.popover}>
          {filteredShipments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No matching shipments found</Text>
              <Text style={styles.emptySubText}>
                Try searching with a different name, shipment ID, or tracking number.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollList}
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
            >
              {filteredShipments.map((s, idx) => {
                const isSelected = s.shipmentId === selectedShipmentId;
                const statusLabel = s.waybillStatus || 'Not Generated';
                const badgeStyle = waybillStyles[statusLabel] || waybillStyles['Not Generated'];

                // Check if any tracking ID matched query
                const cleanQuery = query.trim().toLowerCase();
                const matchedTracking = (s.trackingNumbers || []).find((tn) =>
                  cleanQuery.length > 2 && tn.toLowerCase().includes(cleanQuery)
                );

                return (
                  <Pressable
                    key={s.shipmentId}
                    onPress={() => handleSelect(s)}
                    style={({ hovered }) => [
                      styles.itemCard,
                      isSelected && styles.itemCardSelected,
                      hovered && styles.itemCardHovered,
                      idx !== filteredShipments.length - 1 && styles.itemDivider,
                    ]}
                  >
                    {/* Top Row: Shipment ID + Recipient & Status Badge */}
                    <View style={styles.itemTopRow}>
                      <View style={styles.itemTitleGroup}>
                        <Text style={[styles.shipmentIdText, isSelected && styles.shipmentIdTextSelected]}>
                          {s.shipmentId}
                        </Text>
                        <Text style={styles.dotSeparator}>·</Text>
                        <Text style={styles.recipientNameText} numberOfLines={1}>
                          {s.recipientName || '—'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.badgePill,
                          { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border },
                        ]}
                      >
                        <Text style={[styles.badgePillText, { color: badgeStyle.fg }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Bottom Row: Client, Route, Units */}
                    <View style={styles.itemBottomRow}>
                      <Text style={styles.itemSubText} numberOfLines={1}>
                        Client: <Text style={styles.itemSubStrong}>{s.clientName || '—'}</Text>
                        {'  ·  '}
                        Route: <Text style={styles.itemSubStrong}>{s.destination || '—'}</Text>
                        {'  ·  '}
                        Qty: <Text style={styles.itemSubStrong}>{s.quantity || 1} units</Text>
                      </Text>

                      {matchedTracking ? (
                        <Text style={styles.matchedTrackingText}>
                          Matched Tracking: {matchedTracking}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    flex: 1,
    maxWidth: 560,
    zIndex: 100,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 40,
  },
  inputContainerFocused: {
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  inputContainerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: colors.ink,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    outlineStyle: 'none',
    paddingVertical: 0,
  },
  clearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
  },
  clearBtnHovered: {
    opacity: 0.7,
  },
  clearBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
    fontWeight: '600',
  },
  caretBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  caretBtnHovered: {
    opacity: 0.7,
  },
  caretText: {
    fontSize: 10,
    color: colors.inkSoft,
  },
  popover: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    maxHeight: 320,
    zIndex: 1000,
    overflow: 'hidden',
  },
  scrollList: {
    maxHeight: 320,
  },
  itemCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  itemCardSelected: {
    backgroundColor: '#FAF9F5',
  },
  itemCardHovered: {
    backgroundColor: '#F3F2EB',
  },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  shipmentIdText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  shipmentIdTextSelected: {
    color: colors.ink,
  },
  dotSeparator: {
    marginHorizontal: 6,
    color: colors.inkFaint,
  },
  recipientNameText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
  },
  badgePill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 3,
    borderWidth: 1,
  },
  badgePillText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  itemBottomRow: {
    flexDirection: 'column',
    gap: 2,
  },
  itemSubText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  itemSubStrong: {
    fontWeight: '600',
    color: colors.ink,
  },
  matchedTrackingText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  emptySubText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
