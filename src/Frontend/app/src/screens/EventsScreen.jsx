import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/theme';
import { useAI } from '../context/ai_context';
import { useAppNavigation } from '../context/navigation_context';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showConfirm } from '../services/dialogs';
import { extractErrorMessage } from '../services/errors';

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatHour = (h) => `${String(h).padStart(2, '0')}:00`;

const getWeekDates = (anchor) => {
  const day = anchor.getDay();
  const daysFromMonday = (day + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

const parseEventTime = (e) => {
  if (!e || !e.start_time) return { date: e?.date || '', hour: 0, minute: 0 };
  const [hStr = '0', mStr = '0'] = String(e.start_time).split(':');
  return { date: e.date, hour: parseInt(hStr, 10) || 0, minute: parseInt(mStr, 10) || 0 };
};

const priorityColor = (p) => Number(p) === 1 ? '#F43F5E' : Number(p) === 3 ? '#10B981' : '#F59E0B';
const prioritySurface = (p) => Number(p) === 1 ? '#FFF1F2' : Number(p) === 3 ? '#ECFDF5' : '#FFFBEB';

const HOUR_ROW_HEIGHT = 70;
const DAY_CELL_WIDTH = 56;
const TIMELINE_LEFT = 78;
const TIMELINE_RIGHT = 18;

const eventStartMinutes = (event) => {
  const parsed = parseEventTime(event);
  return parsed.hour * 60 + parsed.minute;
};

const formatMinutes = (minutes) => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

const eventRangeText = (event) => {
  const start = eventStartMinutes(event);
  const duration = Number(event.estimated_minutes) || 60;
  return `${formatMinutes(start)} - ${formatMinutes(start + duration)}`;
};

export const EventsScreen = () => {
  const { colors, fonts } = useTheme();
  const { events: aiEvents, addEvent, updateEvent, removeEvent, reloadAll } = useAI();
  const { navigate } = useAppNavigation();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState('scheduled');
  const timelineRef = useRef(null);
  const dayStripRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState('start');
  const [editingEvent, setEditingEvent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    startHour: 9,
    startMinute: 0,
    endHour: 10,
    endMinute: 0,
    priority: 2,
    description: '',
  });

  useEffect(() => {
    reloadAll().catch(() => {});
  }, [reloadAll]);

  const dayStripDates = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => {
      const d = new Date(year, month, i + 1);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

  const selectedDateStr = toLocalDate(selectedDate);

  useEffect(() => {
    const idx = dayStripDates.findIndex((d) => toLocalDate(d) === selectedDateStr);
    if (idx < 0) return;
    const offset = Math.max(0, idx * DAY_CELL_WIDTH - DAY_CELL_WIDTH * 3);
    setTimeout(() => dayStripRef.current?.scrollTo({ x: offset, animated: true }), 60);
  }, [selectedDateStr, dayStripDates]);

  const shiftMonth = (offset) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(1);
    newDate.setMonth(newDate.getMonth() + offset);
    const lastDay = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
    newDate.setDate(Math.min(selectedDate.getDate(), lastDay));
    setSelectedDate(newDate);
  };

  const displayEvents = useMemo(() => {
    return aiEvents.filter((e) => {
      if (e.date !== selectedDateStr) return false;
      if (tab === 'completed') return e.is_completed;
      return !e.is_completed;
    }).sort((a, b) => eventStartMinutes(a) - eventStartMinutes(b));
  }, [aiEvents, selectedDateStr, tab]);

  const openEventModal = (event = null, hour = null) => {
    setEditingEvent(event);
    if (event) {
      const parsed = parseEventTime(event) || { hour: 9, minute: 0 };
      const startMin = parsed.hour * 60 + parsed.minute;
      const endMin = Math.min(startMin + (event.estimated_minutes || 60), 24 * 60 - 1);
      setEventForm({
        title: event.title || '',
        startHour: parsed.hour,
        startMinute: parsed.minute,
        endHour: Math.floor(endMin / 60),
        endMinute: endMin % 60,
        priority: event.priority || 2,
        description: event.description || '',
      });
    } else {
      const defaultHour = hour ?? new Date().getHours();
      const startMin = Math.min(defaultHour * 60, 23 * 60);
      const endMin = Math.min(startMin + 60, 23 * 60 + 55);
      setEventForm({
        title: '',
        startHour: Math.floor(startMin / 60),
        startMinute: 0,
        endHour: Math.floor(endMin / 60),
        endMinute: endMin % 60,
        priority: 2,
        description: '',
      });
    }
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) return showAlert('Required', 'Please enter an event name.');

    const startMin = eventForm.startHour * 60 + eventForm.startMinute;
    const endMin = eventForm.endHour * 60 + eventForm.endMinute;
    if (endMin <= startMin) return showAlert('Invalid Time', 'End time must be after start time.');

    const conflict = aiEvents.find((event) => {
      if (event.date !== selectedDateStr || event.is_completed) return false;
      if (editingEvent && event.id === editingEvent.id) return false;
      const existingStart = eventStartMinutes(event);
      const existingEnd = existingStart + (Number(event.estimated_minutes) || 60);
      return startMin < existingEnd && endMin > existingStart;
    });
    if (conflict) {
      return showAlert('Time Conflict', `"${conflict.title}" already uses ${eventRangeText(conflict)}. Pick another time.`);
    }

    setBusy(true);
    try {
      const hh = String(eventForm.startHour).padStart(2, '0');
      const mm = String(eventForm.startMinute).padStart(2, '0');
      const startTime = `${hh}:${mm}:00`;
      
      const payload = {
        title: eventForm.title.trim(),
        description: eventForm.description,
        date: selectedDateStr,
        startTime,
        estimatedMinutes: endMin - startMin,
        priority: Number(eventForm.priority) || 2,
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload);
      } else {
        await addEvent(payload);
      }
      setShowEventModal(false);
    } catch (err) {
      showAlert('Error', extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEvent = (event) => {
    showConfirm({
      title: 'Delete Event',
      message: `Delete "${event.title}"?`,
      confirmText: 'Delete',
      destructive: true,
      onConfirm: () => removeEvent(event.id).catch((err) => showAlert('Error', extractErrorMessage(err))),
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigate('tasks')} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Events</Text>
        <TouchableOpacity onPress={() => openEventModal()} style={styles.iconBtn}>
          <Ionicons name="add" size={28} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthArrow}>
          <Ionicons name="chevron-back" size={20} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.textDark, fontFamily: fonts.bold }]}>
          {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
        </Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthArrow}>
          <Ionicons name="chevron-forward" size={20} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={dayStripRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.weekStripWrapper}
        contentContainerStyle={styles.weekRow}
      >
        {dayStripDates.map((d) => {
          const dStr = toLocalDate(d);
          const isSelected = dStr === selectedDateStr;
          const isCurrentDay = dStr === toLocalDate(now);
          const dayLabelIdx = (d.getDay() + 6) % 7;
          return (
            <TouchableOpacity key={dStr} onPress={() => setSelectedDate(d)} style={styles.weekCell}>
              <Text style={[styles.weekDayLabel, { color: colors.textLight, fontFamily: fonts.medium }]}>{DAYS_OF_WEEK[dayLabelIdx]}</Text>
              <View style={[
                styles.weekDateCircle,
                isCurrentDay && !isSelected && { borderWidth: 1.5, borderColor: '#F87171' },
                isSelected && { backgroundColor: '#F87171' },
              ]}>
                <Text style={[styles.weekDateNum, { color: isSelected ? '#FFF' : colors.textDark, fontFamily: fonts.bold }]}>{d.getDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setTab('scheduled')} style={[styles.tab, tab === 'scheduled' && { borderBottomColor: colors.primary }]}>
          <Text style={[styles.tabText, { color: tab === 'scheduled' ? colors.primary : colors.textLight, fontFamily: fonts.bold }]}>Scheduled</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('completed')} style={[styles.tab, tab === 'completed' && { borderBottomColor: colors.primary }]}>
          <Text style={[styles.tabText, { color: tab === 'completed' ? colors.primary : colors.textLight, fontFamily: fonts.bold }]}>Completed</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={timelineRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        onLayout={() => {
          if (toLocalDate(now) !== selectedDateStr) return;
          const offset = Math.max(0, (now.getHours() - 1) * HOUR_ROW_HEIGHT);
          setTimeout(() => timelineRef.current?.scrollTo({ y: offset, animated: false }), 80);
        }}
      >
        <View style={styles.timelineWrap}>
        {Array.from({ length: 24 }, (_, h) => {
          const isToday = toLocalDate(now) === selectedDateStr;
          const isCurrentHour = isToday && h === now.getHours();
          const nowOffset = (now.getMinutes() / 60) * HOUR_ROW_HEIGHT;
          return (
            <View key={h} style={[styles.hourRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.hourLabel, {
                color: isCurrentHour ? '#F87171' : colors.textLight,
                fontFamily: isCurrentHour ? fonts.bold : fonts.medium,
              }]}>{formatHour(h)}</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => openEventModal(null, h)}
                style={styles.hourBody}
              >
                {isCurrentHour && (
                  <View pointerEvents="none" style={[styles.nowIndicator, { top: nowOffset }]}>
                    <View style={styles.nowDot} />
                    <View style={styles.nowLine} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
        <View pointerEvents="box-none" style={styles.eventsLayer}>
          {displayEvents.map((event) => {
            const color = priorityColor(event.priority);
            const start = eventStartMinutes(event);
            const duration = Number(event.estimated_minutes) || 60;
            const top = (start / 60) * HOUR_ROW_HEIGHT + 4;
            const height = Math.max(52, (duration / 60) * HOUR_ROW_HEIGHT - 8);
            return (
              <TouchableOpacity
                key={event.id}
                activeOpacity={0.88}
                onPress={() => openEventModal(event)}
                style={[
                  styles.eventBlock,
                  {
                    top,
                    height,
                    borderLeftColor: color,
                    borderColor: color + '40',
                    backgroundColor: prioritySurface(event.priority),
                    shadowColor: color,
                  },
                ]}
              >
                <View style={[styles.eventAccent, { backgroundColor: color }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.eventTitle, { color, fontFamily: fonts.bold }]} numberOfLines={1}>{event.title}</Text>
                  <Text style={[styles.eventMeta, { color: colors.textLight, fontFamily: fonts.bold }]} numberOfLines={1}>
                    {eventRangeText(event)} · {event.estimated_minutes || 60} min
                  </Text>
                  {event.description ? (
                    <Text style={[styles.eventDesc, { color: colors.textLight, fontFamily: fonts.medium }]} numberOfLines={1}>
                      {event.description}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        </View>
      </ScrollView>

      <Modal visible={showEventModal} transparent animationType="slide" onRequestClose={() => setShowEventModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
                {editingEvent ? 'Edit Event' : 'New Event'}
              </Text>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>EVENT NAME</Text>
              <TextInput
                value={eventForm.title}
                onChangeText={(v) => setEventForm({ ...eventForm, title: v })}
                placeholder="e.g. Meeting with professor"
                placeholderTextColor={colors.textLight}
                style={[styles.input, { color: colors.textDark, fontFamily: fonts.bold, borderColor: colors.border }]}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>START TIME</Text>
                  <TouchableOpacity
                    onPress={() => { setPickerTarget('start'); setShowTimePicker(true); }}
                    style={[styles.input, { borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  >
                    <Text style={{ color: colors.textDark, fontFamily: fonts.bold, fontSize: 15 }}>
                      {String(eventForm.startHour).padStart(2, '0')}:{String(eventForm.startMinute).padStart(2, '0')}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>END TIME</Text>
                  <TouchableOpacity
                    onPress={() => { setPickerTarget('end'); setShowTimePicker(true); }}
                    style={[styles.input, { borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  >
                    <Text style={{ color: colors.textDark, fontFamily: fonts.bold, fontSize: 15 }}>
                      {String(eventForm.endHour).padStart(2, '0')}:{String(eventForm.endMinute).padStart(2, '0')}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 14 }]}>PRIORITY</Text>
              <View style={styles.segmentRow}>
                {[1, 2, 3].map((p) => {
                  const flagColor = priorityColor(p);
                  const isSel = eventForm.priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.smallSegment, { borderColor: isSel ? flagColor : colors.border, backgroundColor: isSel ? flagColor + '12' : 'transparent' }]}
                      onPress={() => setEventForm({ ...eventForm, priority: p })}
                    >
                      <Ionicons name="flag" size={18} color={flagColor} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 14 }]}>DESCRIPTION</Text>
              <TextInput
                value={eventForm.description}
                onChangeText={(v) => setEventForm({ ...eventForm, description: v })}
                placeholder="Optional details"
                placeholderTextColor={colors.textLight}
                multiline
                style={[styles.input, {
                  color: colors.textDark,
                  fontFamily: fonts.bold,
                  borderColor: colors.border,
                  minHeight: 64,
                  textAlignVertical: 'top',
                }]}
              />

              <View style={styles.modalFooter}>
                {editingEvent && (
                  <TouchableOpacity
                    style={[styles.modalBtn, { borderColor: '#F43F5E', borderWidth: 1, flex: 0, paddingHorizontal: 18 }]}
                    onPress={() => { setShowEventModal(false); handleDeleteEvent(editingEvent); }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#F43F5E" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => setShowEventModal(false)}>
                  <Text style={[styles.modalBtnText, { color: colors.textLight, fontFamily: fonts.bold }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleSaveEvent} disabled={busy}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.modalBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.timePickerContent, { backgroundColor: colors.surface }]}>
                <View style={styles.pickerHeader}>
                  <Text style={[styles.modalTitle, { color: colors.textDark, fontFamily: fonts.bold, marginBottom: 0 }]}>
                    Select {pickerTarget === 'start' ? 'Start' : 'End'} Time
                  </Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Ionicons name="close" size={26} color={colors.textDark} />
                  </TouchableOpacity>
                </View>
                <View style={styles.timePickerBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timePickerLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>HOUR</Text>
                    <ScrollView showsVerticalScrollIndicator={false} style={styles.timeColumn}>
                      {Array.from({ length: 24 }, (_, h) => h).map((h) => {
                        const currentHour = pickerTarget === 'start' ? eventForm.startHour : eventForm.endHour;
                        const isSel = currentHour === h;
                        return (
                          <TouchableOpacity
                            key={h}
                            onPress={() => setEventForm({
                              ...eventForm,
                              [pickerTarget === 'start' ? 'startHour' : 'endHour']: h,
                            })}
                            style={[styles.timeOption, isSel && { backgroundColor: colors.primary + '20' }]}
                          >
                            <Text style={{ color: isSel ? colors.primary : colors.textDark, fontFamily: fonts.bold, fontSize: 17 }}>
                              {String(h).padStart(2, '0')}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                  <Text style={{ color: colors.textDark, fontFamily: fonts.bold, fontSize: 22, marginHorizontal: 8 }}>:</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timePickerLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>MIN</Text>
                    <ScrollView showsVerticalScrollIndicator={false} style={styles.timeColumn}>
                      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                        const currentMinute = pickerTarget === 'start' ? eventForm.startMinute : eventForm.endMinute;
                        const isSel = currentMinute === m;
                        return (
                          <TouchableOpacity
                            key={m}
                            onPress={() => setEventForm({
                              ...eventForm,
                              [pickerTarget === 'start' ? 'startMinute' : 'endMinute']: m,
                            })}
                            style={[styles.timeOption, isSel && { backgroundColor: colors.primary + '20' }]}
                          >
                            <Text style={{ color: isSel ? colors.primary : colors.textDark, fontFamily: fonts.bold, fontSize: 17 }}>
                              {String(m).padStart(2, '0')}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(false)}
                  style={[styles.modalBtn, { backgroundColor: colors.primary, marginHorizontal: 26, marginBottom: 26 }]}
                >
                  <Text style={[styles.modalBtnText, { color: '#FFF', fontFamily: fonts.bold }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 4 },
  iconBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22 },
  monthRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, marginVertical: 8 },
  monthArrow: { padding: 4 },
  monthLabel: { textAlign: 'center', fontSize: 15 },
  weekStripWrapper: { marginBottom: 6, height: 92, minHeight: 92, flexGrow: 0 },
  weekRow: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 14, alignItems: 'center' },
  weekCell: { width: DAY_CELL_WIDTH, height: 72, alignItems: 'center', justifyContent: 'center' },
  weekDayLabel: { fontSize: 12, lineHeight: 16, height: 16, marginBottom: 8, textAlign: 'center' },
  weekDateCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  weekDateNum: { fontSize: 15, lineHeight: 18, textAlign: 'center' },
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: 14, marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14 },
  timelineWrap: { position: 'relative', minHeight: HOUR_ROW_HEIGHT * 24 },
  hourRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, minHeight: HOUR_ROW_HEIGHT, borderTopWidth: 1 },
  hourLabel: { width: 50, fontSize: 12, paddingTop: 6 },
  hourBody: { flex: 1, minHeight: HOUR_ROW_HEIGHT, paddingVertical: 4, position: 'relative' },
  nowIndicator: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 0 },
  nowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F87171', marginLeft: -5 },
  nowLine: { flex: 1, height: 2, backgroundColor: '#F87171', opacity: 0.85 },
  eventsLayer: { position: 'absolute', top: 0, left: TIMELINE_LEFT, right: TIMELINE_RIGHT, bottom: 0, zIndex: 2 },
  eventBlock: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1.5, borderLeftWidth: 5, borderRadius: 14, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2, zIndex: 3 },
  eventAccent: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  eventTitle: { fontSize: 14 },
  eventDesc: { fontSize: 12, marginTop: 2 },
  eventMeta: { fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { padding: 26, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '85%' },
  modalTitle: { fontSize: 22, marginBottom: 18 },
  miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 6, opacity: 0.75 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15 },
  formRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  smallSegment: { flex: 1, height: 42, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalFooter: { flexDirection: 'row', gap: 12, paddingBottom: 12, marginTop: 18 },
  modalBtn: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 16 },
  timePickerContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 20, maxHeight: '70%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, paddingBottom: 6 },
  timePickerBody: { flexDirection: 'row', paddingHorizontal: 26, marginVertical: 14, alignItems: 'center', height: 260 },
  timePickerLabel: { fontSize: 10, letterSpacing: 1, textAlign: 'center', marginBottom: 6 },
  timeColumn: { flex: 1 },
  timeOption: { paddingVertical: 12, alignItems: 'center', borderRadius: 8, marginVertical: 1 },
});
