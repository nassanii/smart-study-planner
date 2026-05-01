import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { subscribe } from '../services/dialog_bus';

export const AppDialogHost = () => {
  const { colors, fonts } = useTheme();
  const [pending, setPending] = useState(null);

  useEffect(() => subscribe(({ opts, resolve }) => {
    // Only handle blocking dialogs here. Toasts are handled by react-native-toast-message.
    if (opts.kind !== 'toast') {
      setPending({ opts, resolve });
    }
  }), []);

  const close = (result) => {
    if (pending) pending.resolve(result);
    setPending(null);
  };

  if (!pending) return null;

  const { opts } = pending;
  const isConfirm = opts.kind === 'confirm';
  const destructive = !!opts.destructive;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: destructive ? '#FEE2E2' : 'rgba(107, 92, 231, 0.12)' }]}>
            <Ionicons
              name={destructive ? 'warning' : isConfirm ? 'help-circle' : 'information-circle'}
              size={28}
              color={destructive ? '#DC2626' : colors.primary}
            />
          </View>

          <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>
            {opts.title || (isConfirm ? 'Confirm' : (destructive ? 'Error' : 'Notice'))}
          </Text>
          {opts.message ? (
            <Text style={[styles.message, { color: colors.textLight, fontFamily: fonts.medium }]}>{opts.message}</Text>
          ) : null}

          <View style={styles.actions}>
            {isConfirm ? (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
                  onPress={() => close(false)}
                >
                  <Text style={[styles.btnText, { color: colors.textDark, fontFamily: fonts.bold }]}>{opts.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { overflow: 'hidden' }]}
                  onPress={() => close(true)}
                  activeOpacity={0.8}
                >
                  {destructive ? (
                    <View style={[styles.btnSolid, { backgroundColor: '#DC2626' }]}>
                      <Text style={[styles.btnText, { color: '#FFF', fontFamily: fonts.bold }]}>{opts.confirmText || 'Confirm'}</Text>
                    </View>
                  ) : (
                    <LinearGradient colors={[colors.primary, '#8575F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnSolid}>
                      <Text style={[styles.btnText, { color: '#FFF', fontFamily: fonts.bold }]}>{opts.confirmText || 'Confirm'}</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.btn, { flex: 1, overflow: 'hidden' }]} onPress={() => close(true)} activeOpacity={0.8}>
                <LinearGradient colors={[colors.primary, '#8575F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnSolid}>
                  <Text style={[styles.btnText, { color: '#FFF', fontFamily: fonts.bold }]}>OK</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 11, 36, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 28, borderWidth: 1, padding: 28, alignItems: 'center', elevation: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24, opacity: 0.85 },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: { flex: 1, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnSecondary: { borderWidth: 1.5 },
  btnSolid: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  btnText: { fontSize: 14 }
});
