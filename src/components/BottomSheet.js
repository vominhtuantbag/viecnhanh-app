import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/colors';

export function BottomSheet({ visible, title, onClose, children, footer }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
          {footer}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetFooter({ onReset, onApply }) {
  return (
    <View style={styles.footer}>
      <Pressable style={styles.reset} onPress={onReset}>
        <Text style={styles.resetText}>Đặt lại</Text>
      </Pressable>
      <Pressable style={styles.apply} onPress={onApply}>
        <Text style={styles.applyText}>Áp dụng</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '78%',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  reset: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetText: {
    fontWeight: '700',
    color: Colors.text,
  },
  apply: {
    flex: 1.3,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyText: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
