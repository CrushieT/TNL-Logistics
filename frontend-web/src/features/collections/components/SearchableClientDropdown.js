import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, fonts, spacing, radius } from '../../../theme';

export default function SearchableClientDropdown({
  clients = [],
  value = '',
  onChangeSearch,
  onSelectClient,
  placeholder = 'Search by client name, client code, or contact...',
  maxWidth = 420,
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Handle clicking outside to close popover in web environments
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleClickOutside = (event) => {
      if (containerRef.current) {
        const domNode = containerRef.current;
        if (domNode.contains && !domNode.contains(event.target)) {
          setIsOpen(false);
          setIsFocused(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Filter recommendations based on active search query
  const filteredClients = useMemo(() => {
    if (!isOpen) return [];

    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return clients;

    return clients.filter((c) => {
      const matchName = (c.name || c.clientName || '').toLowerCase().includes(cleanQuery);
      const matchCode = (c.code || c.clientCode || '').toLowerCase().includes(cleanQuery);
      const matchContact = (c.contactNumber || c.contact || '').toLowerCase().includes(cleanQuery);
      const matchEmail = (c.email || '').toLowerCase().includes(cleanQuery);

      return matchName || matchCode || matchContact || matchEmail;
    });
  }, [clients, query, isOpen]);

  const handleFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setIsFocused(true);
    setIsOpen(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleChangeText = (text) => {
    setQuery(text);
    onChangeSearch?.(text);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (client) => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setIsOpen(false);
    setIsFocused(false);
    const clientName = client.name || client.clientName || '';
    setQuery(clientName);
    onChangeSearch?.(clientName);
    onSelectClient?.(client);
  };

  const handleClear = () => {
    setQuery('');
    onChangeSearch?.('');
    setIsOpen(true);
  };

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <View ref={containerRef} style={[styles.wrapper, { maxWidth }]}>
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
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.inkFaint}
          style={styles.textInput}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Clear Button */}
        {query.length > 0 ? (
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
          {filteredClients.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No matching clients found</Text>
              <Text style={styles.emptySubText}>
                Try searching with a different name, code, or contact number.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollList}
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
            >
              {filteredClients.map((client, idx) => {
                const clientId = String(client.id || client.clientId);
                const clientName = client.name || client.clientName || 'Client';
                const clientCode = client.code || client.clientCode || '';
                const unbilledCount = client.unbilledShipmentsCount ?? client.shipmentsCount ?? null;
                const outstanding = client.outstandingBalance ?? client.netAmountDue ?? null;

                return (
                  <Pressable
                    key={clientId || idx}
                    onPress={() => handleSelect(client)}
                    style={({ hovered }) => [
                      styles.itemCard,
                      hovered && styles.itemCardHovered,
                      idx !== filteredClients.length - 1 && styles.itemDivider,
                    ]}
                  >
                    {/* Top Row: Client Name + Code Pill */}
                    <View style={styles.itemTopRow}>
                      <View style={styles.itemTitleGroup}>
                        <Text style={styles.clientNameText} numberOfLines={1}>
                          {clientName}
                        </Text>
                        {clientCode ? (
                          <>
                            <Text style={styles.dotSeparator}>·</Text>
                            <Text style={styles.clientCodeText}>{clientCode}</Text>
                          </>
                        ) : null}
                      </View>

                      {clientCode ? (
                        <View style={styles.codePill}>
                          <Text style={styles.codePillText}>{clientCode}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Bottom Row: Contact & Unbilled count */}
                    <View style={styles.itemBottomRow}>
                      <Text style={styles.itemSubText} numberOfLines={1}>
                        {client.contactNumber ? `Contact: ${client.contactNumber}` : client.address || '—'}
                        {unbilledCount !== null ? (
                          <>
                            {'  ·  '}
                            <Text style={styles.itemSubStrong}>
                              {unbilledCount} unbilled {unbilledCount === 1 ? 'shipment' : 'shipments'}
                            </Text>
                          </>
                        ) : null}
                        {outstanding !== null ? (
                          <>
                            {'  ·  '}
                            Due: <Text style={styles.itemOutstandingText}>₱{Number(outstanding).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                          </>
                        ) : null}
                      </Text>
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
    zIndex: 1000,
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
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    maxHeight: 320,
    zIndex: 9999,
    elevation: 10,
    overflow: 'hidden',
  },
  scrollList: {
    maxHeight: 300,
  },
  itemCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
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
  clientNameText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.ink,
  },
  dotSeparator: {
    marginHorizontal: 6,
    color: colors.inkFaint,
  },
  clientCodeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  codePill: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  codePillText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
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
  itemOutstandingText: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: '#DC2626',
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
