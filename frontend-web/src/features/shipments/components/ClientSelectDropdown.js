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
import { colors, fonts, spacing, radius, type } from '../../../theme';

export default function ClientSelectDropdown({
  label = 'Select Client',
  required = false,
  clients = [],
  value = '',
  onSelectClient,
  onValueChange,
  placeholder = 'Search or select client...',
  error,
  helper,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Active clients list
  const activeClients = useMemo(
    () => (clients || []).filter((c) => c.active !== false),
    [clients]
  );

  // Identify currently selected client
  const selectedClient = useMemo(
    () => activeClients.find((c) => String(c.id || c.clientId) === String(value)),
    [activeClients, value]
  );

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return activeClients;
    return activeClients.filter((c) => {
      const name = (c.name || c.clientName || '').toLowerCase();
      const code = (c.code || c.clientCode || c.id || '').toLowerCase();
      const contact = (c.contactNumber || c.contact || '').toLowerCase();
      const address = (c.address || '').toLowerCase();
      return name.includes(clean) || code.includes(clean) || contact.includes(clean) || address.includes(clean);
    });
  }, [activeClients, query]);

  // Handle outside click to close dropdown popover
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleClickOutside = (event) => {
      if (containerRef.current) {
        const domNode = containerRef.current;
        if (domNode.contains && !domNode.contains(event.target)) {
          setIsOpen(false);
          setQuery('');
        }
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus?.();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      if (prev) setQuery('');
      return !prev;
    });
  };

  const handleSelect = (client) => {
    const clientId = client.id || client.clientId;
    onSelectClient?.(client);
    onValueChange?.(clientId);
    setIsOpen(false);
    setQuery('');
  };

  const handleClearSearch = () => {
    setQuery('');
    searchInputRef.current?.focus?.();
  };

  const selectedCode = selectedClient?.code || selectedClient?.clientCode || selectedClient?.id;
  const selectedName = selectedClient?.name || selectedClient?.clientName;

  return (
    <View ref={containerRef} style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}

      {/* Select Box Trigger */}
      <Pressable
        onPress={handleToggle}
        style={({ hovered }) => [
          styles.triggerBox,
          hovered && styles.triggerBoxHovered,
          isOpen && styles.triggerBoxOpen,
          Boolean(error) && styles.triggerBoxError,
        ]}
      >
        <View style={styles.triggerContent}>
          {selectedClient ? (
            <View style={styles.selectedRow}>
              {selectedCode ? (
                <View style={styles.selectedCodeBadge}>
                  <Text style={styles.selectedCodeText}>{selectedCode}</Text>
                </View>
              ) : null}
              <Text style={styles.selectedNameText} numberOfLines={1}>
                {selectedName}
              </Text>
              {selectedClient.contactNumber ? (
                <Text style={styles.selectedSubText} numberOfLines={1}>
                  • {selectedClient.contactNumber}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.placeholderText}>{placeholder}</Text>
          )}
        </View>

        <Text style={[styles.caret, isOpen && styles.caretOpen]}>
          {isOpen ? '▲' : '▼'}
        </Text>
      </Pressable>

      {/* Error or Helper Message */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}

      {/* Dropdown Floating Popover */}
      {isOpen && (
        <View style={styles.popover}>
          {/* Search Box Header */}
          <View style={styles.searchHeader}>
            <TextInput
              ref={searchInputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Type to filter clients..."
              placeholderTextColor={colors.inkFaint}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 ? (
              <Pressable
                onPress={handleClearSearch}
                style={({ hovered }) => [
                  styles.clearBtn,
                  hovered && styles.clearBtnHovered,
                ]}
                hitSlop={6}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Scrollable Client Items List */}
          {filteredClients.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No matching clients</Text>
              <Text style={styles.emptySubText}>
                No active clients found matching &ldquo;{query}&rdquo;
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollList}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              showsVerticalScrollIndicator={true}
            >
              {filteredClients.map((client, idx) => {
                const clientId = String(client.id || client.clientId);
                const isSelected = clientId === String(value);
                const code = client.code || client.clientCode || client.id || '';
                const name = client.name || client.clientName || 'Client';
                const contact = client.contactNumber || client.contact || '';
                const address = client.address || '';
                const isLast = idx === filteredClients.length - 1;

                return (
                  <Pressable
                    key={clientId || idx}
                    onPress={() => handleSelect(client)}
                    style={({ hovered }) => [
                      styles.clientItem,
                      hovered && styles.clientItemHovered,
                      isSelected && styles.clientItemSelected,
                      !isLast && styles.clientItemDivider,
                    ]}
                  >
                    <View style={styles.itemMain}>
                      <View style={styles.itemTopRow}>
                        {code ? (
                          <View style={[styles.codeBadge, isSelected && styles.codeBadgeSelected]}>
                            <Text style={[styles.codeBadgeText, isSelected && styles.codeBadgeTextSelected]}>
                              {code}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={[styles.clientName, isSelected && styles.clientNameSelected]} numberOfLines={1}>
                          {name}
                        </Text>
                      </View>
                      {contact || address ? (
                        <Text style={styles.clientDetail} numberOfLines={1}>
                          {contact ? `Contact: ${contact}` : ''}
                          {contact && address ? '  |  ' : ''}
                          {address || ''}
                        </Text>
                      ) : null}
                    </View>

                    {isSelected ? (
                      <View style={styles.checkIndicator}>
                        <Text style={styles.checkText}>✓</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Footer with Client Counts */}
          <View style={styles.popoverFooter}>
            <Text style={styles.footerText}>
              Showing {filteredClients.length} of {activeClients.length} active clients
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: '100%',
    marginBottom: spacing.lg,
    zIndex: 1000,
  },
  label: {
    ...type.label,
    marginBottom: spacing.xs + 2,
    color: colors.ink,
  },
  required: {
    color: colors.accent,
  },
  triggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 42,
    cursor: 'pointer',
  },
  triggerBoxHovered: {
    borderColor: colors.inkSoft,
    backgroundColor: '#F5F4EE',
  },
  triggerBoxOpen: {
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  triggerBoxError: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  triggerContent: {
    flex: 1,
    marginRight: 8,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
  },
  selectedCodeBadge: {
    backgroundColor: '#EBE9E1',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  selectedCodeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  selectedNameText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.ink,
  },
  selectedSubText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
  },
  placeholderText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
  caret: {
    fontSize: 10,
    color: colors.inkSoft,
    marginLeft: 4,
  },
  caretOpen: {
    color: colors.ink,
  },
  errorText: {
    ...type.bodySmall,
    color: colors.danger,
    marginTop: spacing.xs,
    fontSize: 11,
    fontWeight: '600',
  },
  helperText: {
    ...type.bodySmall,
    color: colors.inkFaint,
    marginTop: spacing.xs,
    fontSize: 11,
  },
  popover: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 9999,
    elevation: 12,
    overflow: 'hidden',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F7F6F2',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    outlineStyle: 'none',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearBtn: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearBtnHovered: {
    opacity: 0.7,
  },
  clearBtnText: {
    fontSize: 12,
    color: colors.inkFaint,
    fontWeight: '600',
  },
  scrollList: {
    maxHeight: 260,
  },
  scrollContent: {
    paddingVertical: 2,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    cursor: 'pointer',
  },
  clientItemHovered: {
    backgroundColor: '#F3F2EB',
  },
  clientItemSelected: {
    backgroundColor: '#F7F6F0',
  },
  clientItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemMain: {
    flex: 1,
    marginRight: 8,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  codeBadge: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  codeBadgeSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  codeBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  codeBadgeTextSelected: {
    color: '#FFFFFF',
  },
  clientName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
  },
  clientNameSelected: {
    color: colors.ink,
    fontWeight: '700',
  },
  clientDetail: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: 1,
  },
  checkIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
  popoverFooter: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FBFBFA',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
  },
});
