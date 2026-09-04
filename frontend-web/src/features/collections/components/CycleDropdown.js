import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors, fonts, radius } from '../../../theme';

/**
 * Expandable Thursday collection cycle dropdown.
 * Expands up to a maximum of 5 collection cycles. If more than 5 cycles
 * exist or are added, enables smooth vertical scrolling.
 */
export default function CycleDropdown({
  cycles = [],
  selectedCycle = '',
  onSelectCycle,
  placeholder = 'Select Cycle',
  minWidth = 220,
  style,
  buttonStyle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click in web environments
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleClickOutside = (event) => {
      if (containerRef.current) {
        const domNode = containerRef.current;
        if (domNode.contains && !domNode.contains(event.target)) {
          setIsOpen(false);
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

  const selectedCycleItem = cycles.find((cycle) => cycle.isoDate === selectedCycle);
  const displayLabel = selectedCycleItem?.label || selectedCycle || placeholder;

  const handleToggle = () => {
    setIsOpen((previous) => !previous);
  };

  const handleSelect = (cycleDate) => {
    setIsOpen(false);
    onSelectCycle?.(cycleDate);
  };

  return (
    <View ref={containerRef} style={[styles.container, { minWidth }, style]}>
      {/* Trigger Button */}
      <Pressable
        onPress={handleToggle}
        style={({ hovered }) => [
          styles.triggerButton,
          hovered && styles.triggerButtonHovered,
          isOpen && styles.triggerButtonOpen,
          buttonStyle,
        ]}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {displayLabel}
        </Text>
        <Text style={styles.caret}>{isOpen ? '▲' : '▼'}</Text>
      </Pressable>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <View style={styles.menuPopover}>
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={true}
          >
            {cycles.map((cycle, index) => {
              const isSelected = cycle.isoDate === selectedCycle;
              const isLast = index === cycles.length - 1;

              return (
                <Pressable
                  key={cycle.isoDate || index}
                  onPress={() => handleSelect(cycle.isoDate)}
                  style={({ hovered }) => [
                    styles.menuItem,
                    isSelected && styles.menuItemSelected,
                    hovered && styles.menuItemHovered,
                    !isLast && styles.menuItemDivider,
                  ]}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      isSelected && styles.menuItemTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {cycle.label || cycle.isoDate}
                  </Text>
                  {isSelected && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  triggerButton: {
    height: 40,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerButtonHovered: {
    borderColor: colors.inkMuted,
    backgroundColor: '#F3F2EB',
  },
  triggerButtonOpen: {
    borderColor: colors.ink,
    backgroundColor: '#FFFFFF',
  },
  triggerText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
  },
  caret: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkMuted,
    marginLeft: 4,
  },
  menuPopover: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1001,
    overflow: 'hidden',
  },
  scrollArea: {
    // 38px per item * 5 items = 190px maximum height
    maxHeight: 190,
  },
  scrollContent: {
    flexGrow: 0,
  },
  menuItem: {
    height: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  menuItemHovered: {
    backgroundColor: '#F3F2EB',
  },
  menuItemSelected: {
    backgroundColor: colors.canvas,
  },
  menuItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink,
    flex: 1,
  },
  menuItemTextSelected: {
    fontWeight: '700',
    color: '#111111',
  },
  checkmark: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: 6,
  },
});
