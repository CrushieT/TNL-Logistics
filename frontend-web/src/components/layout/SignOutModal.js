import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { colors, fonts, spacing } from '../../theme';

function LogoutIcon({ size = 16, color = colors.accent }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function SignOutModal({
  visible = false,
  user = {},
  onConfirm,
  onClose,
}) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
          {/* Header with Icon Anchor & Divider */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <LogoutIcon size={16} color={colors.accent} />
            </View>
            <Text style={styles.title}>Sign Out</Text>
            <Pressable
              onPress={onClose}
              style={({ hovered }) => [
                styles.closeBtn,
                hovered && styles.closeBtnHovered,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close sign out confirmation"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Body Content */}
          <View style={styles.body}>
            <Text style={styles.message}>
              Are you sure you want to sign out?
            </Text>
          </View>

          {/* Footer Actions with Divider */}
          <View style={styles.footer}>
            <Pressable
              style={({ hovered }) => [
                styles.cancelBtn,
                hovered && styles.cancelBtnHovered,
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel sign out"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ hovered }) => [
                styles.confirmBtn,
                hovered && styles.confirmBtnHovered,
              ]}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirm Sign Out"
            >
              <Text style={styles.confirmBtnText}>Sign Out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    zIndex: 1200,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 4,
    cursor: 'pointer',
  },
  closeBtnHovered: {
    backgroundColor: '#F3F2EB',
  },
  closeBtnText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  message: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F5',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  },
  cancelBtnHovered: {
    backgroundColor: '#F3F2EB',
  },
  cancelBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  confirmBtn: {
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.accent,
    cursor: 'pointer',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnHovered: {
    opacity: 0.88,
  },
  confirmBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
