import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';

export const DatePickerModal = ({ visible, onClose, onSelect, selectedDate }) => {
  const { colors, fonts } = useTheme();
  
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (visible) {
      const parts = selectedDate ? String(selectedDate).split('T')[0].split('-') : [];
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const date = new Date(y, m, d);
        setCurrentDate(isNaN(date.getTime()) ? new Date() : date);
      } else {
        setCurrentDate(new Date());
      }
    }
  }, [visible, selectedDate]);

  if (!visible) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonthDays = Array.from({ length: firstDayOfMonth }, (_, i) => daysInPrevMonth - firstDayOfMonth + i + 1);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const nextMonthDays = Array.from({ length: 42 - (daysInMonth + firstDayOfMonth) }, (_, i) => i + 1);

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const changeMonth = (offset) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + offset);
    setCurrentDate(next);
  };

  const handleSelectDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSelect(dateStr);
    onClose();
  };

  const formatLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleQuickSelect = (offsetDays) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    target.setHours(0, 0, 0, 0);
    onSelect(formatLocalDate(target));
    onClose();
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    const parts = String(selectedDate).split('T')[0].split('-');
    if (parts.length !== 3) return false;
    return parseInt(parts[0], 10) === year && parseInt(parts[1], 10) === (month + 1) && parseInt(parts[2], 10) === day;
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <View style={[styles.content, { backgroundColor: colors.surface }]}>
        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]} onPress={() => handleQuickSelect(0)}>
            <Ionicons name="today-outline" size={15} color={colors.primary} />
            <Text style={[styles.quickBtnText, { color: colors.primary, fontFamily: fonts.bold }]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]} onPress={() => handleQuickSelect(1)}>
            <Ionicons name="arrow-forward-circle-outline" size={15} color={colors.textDark} />
            <Text style={[styles.quickBtnText, { color: colors.textDark, fontFamily: fonts.bold }]}>Tomorrow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]} onPress={() => handleQuickSelect(7)}>
            <Ionicons name="calendar-number-outline" size={15} color={colors.textDark} />
            <Text style={[styles.quickBtnText, { color: colors.textDark, fontFamily: fonts.bold }]}>Next week</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={[styles.navBtn, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="chevron-back" size={18} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={[styles.navBtn, { backgroundColor: colors.cardAlt }]}>
            <Ionicons name="chevron-forward" size={18} color={colors.textDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekHeader}>
          {weekDays.map(d => (
            <Text key={d} style={[styles.weekDayText, { color: colors.textLight, fontFamily: fonts.semiBold }]}>{d}</Text>
          ))}
        </View>

        <View style={styles.daysContainer}>
          {prevMonthDays.map((d, i) => (
            <View key={`prev-${i}`} style={styles.dayCell}>
              <Text style={[styles.dayTextOff, { color: colors.border, fontFamily: fonts.medium }]}>{d}</Text>
            </View>
          ))}
          
          {days.map(d => {
            const active = isSelected(d);
            return (
              <TouchableOpacity 
                key={d} 
                style={[styles.dayCell, active && [styles.selectedDayCell, { backgroundColor: colors.primary }]]}
                onPress={() => handleSelectDay(d)}
              >
                <Text style={[styles.dayText, { color: active ? '#FFF' : colors.textDark, fontFamily: fonts.bold }]}>{d}</Text>
              </TouchableOpacity>
            );
          })}

          {nextMonthDays.map((d, i) => (
            <View key={`next-${i}`} style={styles.dayCell}>
              <Text style={[styles.dayTextOff, { color: colors.border, fontFamily: fonts.medium }]}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.footerBtn, { borderColor: colors.border }]} onPress={() => { onSelect(null); onClose(); }}>
            <Text style={[styles.footerBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Clear Date</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.footerBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
            <Text style={[styles.footerBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { width: '85%', borderRadius: 24, padding: 20, elevation: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerTitle: { fontSize: 18, flex: 1, textAlign: 'center' },
  navRow: { flexDirection: 'row', gap: 8 },
  navBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  weekHeader: { flexDirection: 'row', marginBottom: 8 },
  weekDayText: { flex: 1, textAlign: 'center', fontSize: 12 },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  dayText: { fontSize: 14 },
  dayTextOff: { fontSize: 12, opacity: 0.3 },
  selectedDayCell: { borderRadius: 10 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 15, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 15 },
  footerBtn: { flex: 1, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  footerBtnText: { fontSize: 14 },
  quickRow: { flexDirection: 'row', gap: 6, marginBottom: 15 },
  quickBtn: { flex: 1, height: 38, borderRadius: 12, flexDirection: 'row', gap: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, paddingHorizontal: 4 },
  quickBtnText: { fontSize: 12 },
});
