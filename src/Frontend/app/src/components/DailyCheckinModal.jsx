import { extractErrorMessage } from "../services/errors";
import React, { useMemo, useState, useEffect, useRef } from "react";


import { ActivityIndicator, Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { useTheme } from "../theme/theme";
import { useAI } from "../context/ai_context";
import { useAppNavigation } from "../context/navigation_context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { slotsApi } from "../services/api";
import { showAlert } from "../services/dialogs";
import { LinearGradient } from "expo-linear-gradient";
import { DatePickerModal } from "./DatePickerModal";

const formatDateDisplay = (dateStr) => {
   if (!dateStr) return "";
   const dateOnly = String(dateStr).split("T")[0];
   const parts = dateOnly.split("-");
   if (parts.length !== 3) return dateStr;
   const [y, m, d] = parts;
   const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
   const monthName = months[parseInt(m, 10) - 1] || m;
   return `${monthName} ${parseInt(d, 10)}, ${y}`;
};

const getLocalTodayDateString = () => {
   const d = new Date();
   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const timeToMinutes = (value) => {
   const [hStr, mStr] = String(value || "").split(":");
   const hours = Number.parseInt(hStr, 10);
   const minutes = Number.parseInt(mStr, 10);
   if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
   return hours * 60 + minutes;
};

const formatSlotRange = (slot) => {
   const start = String(slot.startTime || slot.start_time || "").slice(0, 5);
   const end = String(slot.endTime || slot.end_time || "").slice(0, 5);
   return `${start} - ${end}`;
};

const AI_GENERATION_STEPS = [
   "Reading your recent study behavior",
   "Balancing courses, deadlines, and priorities",
   "Building today's focus flow",
];

export const DailyCheckinModal = ({ visible, onClose, selectedDate }) => {
   const { colors, fonts } = useTheme();
   const { subjects, tasks, generateSchedule, userData, addTask, addSubject } = useAI();

   const findOverlap = (dateStr, startMinutes, durationMinutes) => {
      if (startMinutes === null || startMinutes === undefined) return null;
      const newEnd = startMinutes + durationMinutes;
      for (const t of tasks) {
         let tDate;
         let tStart;
         if (t.start_time) {
            tDate = String(t.deadline || "").split("T")[0];
            const [hStr, mStr] = String(t.start_time).split(":");
            tStart = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);
         } else if (t.deadline && String(t.deadline).includes("T")) {
            // Legacy: deadline string with embedded time
            const [d, time] = String(t.deadline).split("T");
            tDate = d;
            const [hStr, mStr] = String(time || "0:0").split(":");
            tStart = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);
         } else {
            continue; // not time-blocked
         }
         if (tDate !== dateStr) continue;
         const tEnd = tStart + (Number(t.estimated_minutes) || 45);
         if (startMinutes < tEnd && newEnd > tStart) {
            return t;
         }
      }
      return null;
   };
   const { navigate } = useAppNavigation();
   const [loadingMode, setLoadingMode] = useState(null);
   const savingRef = useRef(false);
   const [slots, setSlots] = useState([]);
   const [newSlot, setNewSlot] = useState({ start: "08:00", end: "10:00" });
   const [showHourPicker, setShowHourPicker] = useState(false);
   const [activeSlotField, setActiveSlotField] = useState("start");
   const [mode, setMode] = useState("ai");
   const [showSubjectPicker, setShowSubjectPicker] = useState(false);
   const [showDurationPicker, setShowDurationPicker] = useState(false);
   const [showDatePicker, setShowDatePicker] = useState(false);
   const [showTimePicker, setShowTimePicker] = useState(false);
   const durationScrollRef = useRef(null);
   const [manualForm, setManualForm] = useState({
      title: "",
      subjectId: null,
      duration: "45",
      priority: 2,
      topic: "",
      deadline: "",
      startHour: null,
      startMinute: null,
   });

   const WHEEL_ITEM_WIDTH = 72;
   const WHEEL_VISIBLE = 5;
   const WHEEL_HEIGHT = 90;
   const WHEEL_PAD = WHEEL_ITEM_WIDTH * Math.floor(WHEEL_VISIBLE / 2);
   const DURATION_MIN = 5;
   const DURATION_MAX = 180;
   const durationOptions = useMemo(
      () => Array.from({ length: DURATION_MAX - DURATION_MIN + 1 }, (_, i) => i + DURATION_MIN),
      []
   );

   useEffect(() => {
      if (!showDurationPicker) return;
      const current = Number(manualForm.duration) || 45;
      const idx = Math.max(0, Math.min(durationOptions.length - 1, current - DURATION_MIN));
      const timeout = setTimeout(() => {
         durationScrollRef.current?.scrollTo({ x: idx * WHEEL_ITEM_WIDTH, animated: false });
      }, 60);
      return () => clearTimeout(timeout);
   }, [showDurationPicker, durationOptions.length, manualForm.duration]);

   const resolvedSubject = subjects.find((s) => s.id === manualForm.subjectId) || null;

   const handleAddManualTask = async () => {
      // Hard guard: re-entry from double-tapping the Save button before disabled state propagates
      if (savingRef.current) return;
      if (!manualForm.title.trim()) {
         showAlert("Required", "Please enter a title.");
         return;
      }
      let subjectId = manualForm.subjectId;
      if (!subjectId) {
         subjectId = subjects.find((s) => s.name?.trim().toLowerCase() === "general tasks")?.id || subjects[0]?.id;
         if (!subjectId) {
            try {
               const created = await addSubject({ name: "General Tasks", difficulty: 5, priority: 2 });
               subjectId = created?.id;
            } catch (_) {}
         }
      }
      if (!subjectId) {
         showAlert("Add a Course First", "Please add at least one course before creating study blocks.");
         return;
      }

      const dateStr = manualForm.deadline || selectedDate || getLocalTodayDateString();
      const hasTime = manualForm.startHour !== null && manualForm.startHour !== undefined;
      const durationMin = Number(manualForm.duration) || 45;

      if (hasTime) {
         const startMin = manualForm.startHour * 60 + (manualForm.startMinute || 0);
         const conflict = findOverlap(dateStr, startMin, durationMin);
         if (conflict) {
            showAlert("Time Conflict", `This block overlaps with "${conflict.title}". Pick a different time.`);
            return;
         }
      }

      savingRef.current = true;
      setLoadingMode("manual");
      try {
         const startTime = hasTime
            ? `${String(manualForm.startHour).padStart(2, "0")}:${String(manualForm.startMinute || 0).padStart(2, "0")}:00`
            : null;
         await addTask({
            subjectId,
            title: manualForm.title.trim(),
            estimatedMinutes: Number(manualForm.duration) || 45,
            priority: Number(manualForm.priority) || 2,
            difficultyRating: resolvedSubject?.difficulty || 5,
            deadline: dateStr,
            startTime,
            taskType: 0, // Study
            isManual: true,
            tag: manualForm.topic?.trim() || null,
         });
         setManualForm({ title: "", subjectId: null, duration: "45", priority: 2, topic: "", deadline: "", startHour: null, startMinute: null });
         onClose();
      } catch (err) {
         showAlert("Error", extractErrorMessage(err));
      } finally {
         setLoadingMode(null);
         savingRef.current = false;
      }
   };

   const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, h) => h), []);
   const minuteOptions = useMemo(() => [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], []);

   useEffect(() => {
      if (visible) {
         const dateToUse = selectedDate || getLocalTodayDateString();
         slotsApi.list(dateToUse).then(setSlots).catch(console.warn);
      }
   }, [visible, selectedDate]);

   const handleAddSlot = async () => {
      const startMin = timeToMinutes(newSlot.start);
      const endMin = timeToMinutes(newSlot.end);
      
      if (startMin === null || endMin === null || startMin >= endMin) {
         showAlert("Invalid Time", "End time must be after start time.");
         return;
      }

      const overlappingSlot = slots.find((s) => {
         const existingStart = timeToMinutes(s.startTime || s.start_time);
         const existingEnd = timeToMinutes(s.endTime || s.end_time);
         if (existingStart === null || existingEnd === null) return false;
         return startMin < existingEnd && endMin > existingStart;
      });
      if (overlappingSlot) {
         showAlert("Time Conflict", `This block overlaps with ${formatSlotRange(overlappingSlot)}. Pick a different time.`);
         return;
      }

      try {
         const payload = {
            startTime: newSlot.start + ":00",
            endTime: newSlot.end + ":00",
         };

         if (selectedDate) {
            payload.date = selectedDate;
         } else {
            payload.dayOfWeek = new Date().getDay();
         }

         const created = await slotsApi.create(payload);
         setSlots((prev) => [...prev, created].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      } catch (err) {
         showAlert("Error", err.response?.data?.title || err.message);
      }
   };

   const handleRemoveSlot = async (id) => {
      try {
         await slotsApi.remove(id);
         setSlots((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
         showAlert("Error", err.response?.data?.title || err.message);
      }
   };

   const handleGenerate = async () => {
      if (slots.length === 0) {
         showAlert("No Time Blocks", "Please add at least one study block to generate a plan.");
         return;
      }
      if (subjects.length === 0) {
         showAlert("No Courses", "Add a course first.");
         return;
      }
      setLoadingMode("generating");
      try {
         const dateToUse = selectedDate || getLocalTodayDateString();
         await generateSchedule(dateToUse);
         onClose();
      } catch (err) {
         const detail = extractErrorMessage(err);
         showAlert("Plan Failed", detail);
      } finally {
         setLoadingMode(null);
      }
   };

   const renderTimeColumn = (label, values, selectedValue, onSelect) => (
      <View style={styles.timePickerColumn}>
         <Text style={[styles.timePickerColumnLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>
            {label}
         </Text>
         <ScrollView
            showsVerticalScrollIndicator={false}
            style={[styles.timePickerScroll, { backgroundColor: colors.cardAlt }]}
            contentContainerStyle={styles.timePickerScrollContent}
         >
            {values.map((value) => {
               const isSelected = selectedValue === value;
               return (
                  <TouchableOpacity
                     key={value}
                     onPress={() => onSelect(value)}
                     style={[
                        styles.timePickerOption,
                        { backgroundColor: isSelected ? colors.primary + "18" : "transparent" },
                     ]}
                  >
                     <Text
                        style={[
                           styles.timePickerOptionText,
                           {
                              color: isSelected ? colors.primary : colors.textDark,
                              fontFamily: fonts.bold,
                              opacity: isSelected ? 1 : 0.72,
                           },
                        ]}
                     >
                        {String(value).padStart(2, "0")}
                     </Text>
                  </TouchableOpacity>
               );
            })}
         </ScrollView>
      </View>
   );

   if (!visible) return null;

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
               <View style={styles.modalHeader}>
                  <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Create Plan</Text>
                  <TouchableOpacity
                     onPress={onClose}
                     disabled={loadingMode === "generating"}
                     style={{ opacity: loadingMode === "generating" ? 0.35 : 1 }}
                  >
                     <Ionicons name="close" size={24} color={colors.textLight} />
                  </TouchableOpacity>
               </View>

               {loadingMode === "generating" ? (
                  <View style={styles.aiGeneratingWrap}>
                     <LinearGradient
                        colors={[colors.primary, "#8B5CF6"]}
                        style={styles.aiGeneratingIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                     >
                        <MaterialCommunityIcons name="brain" size={34} color="#FFF" />
                     </LinearGradient>
                     <Text style={[styles.aiGeneratingTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
                        Your AI plan is being created
                     </Text>
                     <Text style={[styles.aiGeneratingText, { color: colors.textLight, fontFamily: fonts.medium }]}>
                        We are reading your behavior, open blocks, courses, and deadlines.
                     </Text>
                     <View style={styles.aiSteps}>
                        {AI_GENERATION_STEPS.map((step, idx) => (
                           <View key={step} style={[styles.aiStepRow, { backgroundColor: colors.cardAlt }]}>
                              <View style={[styles.aiStepDot, { backgroundColor: idx === 0 ? colors.primary : colors.primary + "33" }]}>
                                 {idx === 0 ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                 ) : (
                                    <Ionicons name="checkmark" size={13} color={colors.primary} />
                                 )}
                              </View>
                              <Text style={[styles.aiStepText, { color: colors.textDark, fontFamily: fonts.bold }]}>
                                 {step}
                              </Text>
                           </View>
                        ))}
                     </View>
                  </View>
               ) : (
               <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
                  <View style={[styles.modeTabs, { backgroundColor: colors.cardAlt }]}>
                     <TouchableOpacity
                        onPress={() => setMode("ai")}
                        style={[styles.modeTab, mode === "ai" && { backgroundColor: colors.primary }]}
                     >
                        <Ionicons name="sparkles" size={14} color={mode === "ai" ? "#FFF" : colors.textDark} />
                        <Text style={[styles.modeTabText, { color: mode === "ai" ? "#FFF" : colors.textDark, fontFamily: fonts.bold }]}>AI Plan</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => setMode("manual")}
                        style={[styles.modeTab, mode === "manual" && { backgroundColor: colors.primary }]}
                     >
                        <Ionicons name="create-outline" size={14} color={mode === "manual" ? "#FFF" : colors.textDark} />
                        <Text style={[styles.modeTabText, { color: mode === "manual" ? "#FFF" : colors.textDark, fontFamily: fonts.bold }]}>Manual</Text>
                     </TouchableOpacity>
                  </View>

                  <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
                     {mode === "ai"
                        ? "Pick your study blocks and courses to generate your personalized AI study plan."
                        : "Add a study block manually. It won't be sent to the AI scheduler."}
                  </Text>

                  {mode === "manual" ? (
                     <View>
                        <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>TITLE</Text>
                        <TextInput
                           value={manualForm.title}
                           onChangeText={(v) => setManualForm({ ...manualForm, title: v })}
                           placeholder="e.g. Chapter 4 exercises"
                           placeholderTextColor={colors.textLight}
                           style={[styles.manualInput, { borderColor: colors.border, color: colors.textDark, fontFamily: fonts.bold }]}
                        />

                        <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 14 }]}>COURSE (OPTIONAL)</Text>
                        <TouchableOpacity
                           onPress={() => setShowSubjectPicker(true)}
                           style={[styles.manualInput, { borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                        >
                           <Text style={{ color: resolvedSubject ? colors.textDark : colors.textLight, fontFamily: fonts.bold, fontSize: 15 }}>
                              {resolvedSubject?.name || "Pick a course"}
                           </Text>
                           <Ionicons name="chevron-down" size={18} color={colors.textLight} />
                        </TouchableOpacity>

                        <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 14 }]}>DURATION</Text>
                        <TouchableOpacity
                           onPress={() => setShowDurationPicker(true)}
                           style={[styles.manualInput, { borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                        >
                           <Text style={{ color: manualForm.duration ? colors.textDark : colors.textLight, fontFamily: fonts.bold, fontSize: 15 }}>
                              {manualForm.duration ? `${manualForm.duration} min` : "Set Duration"}
                           </Text>
                           <Ionicons name="chevron-down" size={18} color={colors.textLight} />
                        </TouchableOpacity>

                        <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 14 }]}>TOPIC (OPTIONAL)</Text>
                        <TextInput
                           value={manualForm.topic}
                           onChangeText={(v) => setManualForm({ ...manualForm, topic: v })}
                           placeholder="e.g. Chapter 4 — derivatives"
                           placeholderTextColor={colors.textLight}
                           maxLength={60}
                           style={[styles.manualInput, { borderColor: colors.border, color: colors.textDark, fontFamily: fonts.bold }]}
                        />

                        <View style={styles.manualRow}>
                           <View style={{ flex: 1 }}>
                              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>DATE</Text>
                              <TouchableOpacity
                                 onPress={() => setShowDatePicker(true)}
                                 style={[styles.manualInput, { borderColor: colors.border, justifyContent: "center", height: 48 }]}
                              >
                                 <Text style={{ color: manualForm.deadline ? colors.textDark : colors.textLight, fontFamily: fonts.bold, fontSize: 13 }}>
                                    {manualForm.deadline ? formatDateDisplay(manualForm.deadline) : "Today"}
                                 </Text>
                              </TouchableOpacity>
                           </View>
                           <View style={{ flex: 1 }}>
                              <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>START TIME (OPTIONAL)</Text>
                              <TouchableOpacity
                                 onPress={() => setShowTimePicker(true)}
                                 style={[styles.manualInput, { borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48 }]}
                              >
                                 <Text style={{ color: manualForm.startHour !== null ? colors.textDark : colors.textLight, fontFamily: fonts.bold, fontSize: 13 }}>
                                    {manualForm.startHour !== null
                                       ? `${String(manualForm.startHour).padStart(2, "0")}:${String(manualForm.startMinute || 0).padStart(2, "0")}`
                                       : "Any time"}
                                 </Text>
                                 {manualForm.startHour !== null && (
                                    <TouchableOpacity onPress={() => setManualForm({ ...manualForm, startHour: null, startMinute: null })}>
                                       <Ionicons name="close-circle" size={16} color={colors.textLight} />
                                    </TouchableOpacity>
                                 )}
                              </TouchableOpacity>
                           </View>
                        </View>

                        <Text style={[styles.miniLabel, { color: colors.textLight, fontFamily: fonts.bold, marginTop: 14 }]}>PRIORITY (OPTIONAL)</Text>
                        <View style={styles.priorityRow}>
                           {[1, 2, 3].map((p) => {
                              const flagColor = p === 1 ? "#F43F5E" : p === 2 ? "#F59E0B" : "#10B981";
                              const isSel = manualForm.priority === p;
                              return (
                                 <TouchableOpacity
                                    key={p}
                                    onPress={() => setManualForm({ ...manualForm, priority: p })}
                                    style={[styles.prioBtn, { borderColor: isSel ? flagColor : colors.border, backgroundColor: isSel ? flagColor + "12" : "transparent" }]}
                                 >
                                    <Ionicons name="flag" size={16} color={flagColor} />
                                 </TouchableOpacity>
                              );
                           })}
                        </View>

                        <TouchableOpacity
                           style={[styles.generateBtn, { backgroundColor: colors.primary, opacity: loadingMode ? 0.7 : 1, marginTop: 24 }]}
                           onPress={handleAddManualTask}
                           disabled={!!loadingMode}
                        >
                           <Text style={[styles.generateText, { fontFamily: fonts.bold }]}>{loadingMode === "manual" ? "Adding..." : "Add Study Block"}</Text>
                           <Ionicons name="add-circle" size={18} color="#FFF" style={{ marginLeft: 10 }} />
                        </TouchableOpacity>
                     </View>
                  ) : (
                  <>
                  {/* SECTION 1: TIME BLOCKS */}
                  <View style={styles.sectionRow}>
                     <Ionicons name="time-outline" size={20} color={colors.primary} />
                     <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.bold }]}>Study Blocks</Text>
                  </View>
                  <ScrollView style={[styles.slotsList, { maxHeight: 60 }]} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
                     {slots.map((s) => (
                        <View key={s.id} style={[styles.slotChip, { 
                           backgroundColor: colors.primary, 
                           borderWidth: 0,
                           borderRadius: 24, 
                           paddingVertical: 10, 
                           paddingHorizontal: 14,
                           shadowColor: colors.primary,
                           shadowOpacity: 0.3,
                           shadowRadius: 6,
                           shadowOffset: { width: 0, height: 3 },
                           elevation: 3
                        }]}>
                           <Ionicons name="time" size={16} color="#FFF" style={{ marginRight: 6 }} />
                           <Text style={{ color: "#FFF", fontFamily: fonts.bold, fontSize: 15, letterSpacing: 0.5 }}>
                              {s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)}
                           </Text>
                           <TouchableOpacity 
                              onPress={() => handleRemoveSlot(s.id)} 
                              style={{ marginLeft: 12, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 4 }}
                           >
                              <Ionicons name="close" size={16} color="#FFF" />
                           </TouchableOpacity>
                        </View>
                     ))}
                  </ScrollView>

                  <View style={[styles.inlineForm, { gap: 12, marginTop: 10 }]}>
                     <TouchableOpacity
                        style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.cardAlt }}
                        onPress={() => {
                           setActiveSlotField("start");
                           setShowHourPicker(true);
                        }}
                     >
                        <Ionicons name="time-outline" size={18} color={colors.textLight} />
                        <Text style={{ color: colors.textDark, fontFamily: fonts.bold, fontSize: 16 }}>{newSlot.start}</Text>
                     </TouchableOpacity>

                     <Text style={{ color: colors.textLight, fontFamily: fonts.bold, fontSize: 12 }}>TO</Text>

                     <TouchableOpacity
                        style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.cardAlt }}
                        onPress={() => {
                           setActiveSlotField("end");
                           setShowHourPicker(true);
                        }}
                     >
                        <Ionicons name="time-outline" size={18} color={colors.textLight} />
                        <Text style={{ color: colors.textDark, fontFamily: fonts.bold, fontSize: 16 }}>{newSlot.end}</Text>
                     </TouchableOpacity>

                     <TouchableOpacity 
                        style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", elevation: 2, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }} 
                        onPress={handleAddSlot}
                     >
                        <Ionicons name="add" size={26} color="#FFF" />
                     </TouchableOpacity>
                  </View>

                  {/* SUBJECTS & TASKS SECTION */}
                  <View style={[styles.sectionRow, { marginTop: 20 }]}>
                     <Ionicons name="book-outline" size={20} color={colors.primary} />
                     <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.bold }]}>Courses & Tasks</Text>
                  </View>

                  <View style={styles.subjectsReview}>
                     {subjects.map((sub) => (
                        <View key={sub.id} style={[styles.subjectReviewItem, { backgroundColor: colors.cardAlt }]}>
                           <View style={styles.subjectReviewHeader}>
                              <Text style={[styles.subjectName, { color: colors.textDark, fontFamily: fonts.bold }]}>{sub.name}</Text>
                           </View>
                        </View>
                     ))}
                  </View>

                  <TouchableOpacity
                     style={[styles.modifyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                     onPress={() => {
                        navigate("courses");
                        onClose();
                     }}
                  >
                     <Ionicons name="create-outline" size={18} color={colors.primary} />
                     <Text style={[styles.modifyBtnText, { color: colors.primary, fontFamily: fonts.bold }]}>Edit Courses & Tasks</Text>
                  </TouchableOpacity>

                  <Text
                     style={{ fontSize: 11, color: colors.textLight, textAlign: "center", marginBottom: 25, fontFamily: fonts.medium, marginTop: 10 }}
                  >
                     The plan uses priority, difficulty, midterm/final dates, and your open tasks.
                  </Text>

                  <TouchableOpacity
                     style={[styles.generateBtn, { backgroundColor: colors.primary, opacity: loadingMode ? 0.7 : 1 }]}
                     onPress={handleGenerate}
                     disabled={!!loadingMode}
                  >
                     <LinearGradient colors={["rgba(255,255,255,0.2)", "transparent"]} style={styles.btnGradient} />
                     <Text style={[styles.generateText, { fontFamily: fonts.bold }]}>{loadingMode === "generating" ? "Generating with AI..." : "Generate AI Plan"}</Text>
                     <MaterialCommunityIcons name="brain" size={18} color="#FFF" style={{ marginLeft: 10 }} />
                  </TouchableOpacity>
                  </>
                  )}
               </ScrollView>
               )}
            </View>
         </View>

         <DatePickerModal
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            selectedDate={manualForm.deadline}
            onSelect={(date) => setManualForm({ ...manualForm, deadline: date })}
         />

         <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
            <View style={styles.timePickerOverlay}>
               <View style={[styles.timePickerContent, { backgroundColor: colors.surface }]}>
                  <View style={[styles.timePickerHeader, { borderBottomColor: colors.border }]}>
                     <Text style={[styles.timePickerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Start Time</Text>
                     <TouchableOpacity
                        onPress={() => setShowTimePicker(false)}
                        style={[styles.timePickerClose, { backgroundColor: colors.cardAlt }]}
                     >
                        <Ionicons name="close" size={22} color={colors.textDark} />
                     </TouchableOpacity>
                  </View>
                  <View style={styles.timePickerBody}>
                     {renderTimeColumn("Hour", hourOptions, manualForm.startHour ?? 9, (h) =>
                        setManualForm({ ...manualForm, startHour: h, startMinute: manualForm.startMinute || 0 })
                     )}
                     <View style={styles.timePickerSeparator}>
                        <Text style={[styles.timePickerSeparatorText, { color: colors.textDark, fontFamily: fonts.bold }]}>:</Text>
                     </View>
                     {renderTimeColumn("Min", minuteOptions, manualForm.startMinute || 0, (m) =>
                        setManualForm({ ...manualForm, startMinute: m, startHour: manualForm.startHour ?? 9 })
                     )}
                  </View>
                  <View style={styles.timePickerFooter}>
                     <TouchableOpacity
                        onPress={() => setShowTimePicker(false)}
                        style={[styles.generateBtn, styles.timePickerDone, { backgroundColor: colors.primary }]}
                     >
                        <Text style={[styles.generateText, { fontFamily: fonts.bold }]}>Done</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         </Modal>

         <Modal visible={showDurationPicker} transparent animationType="slide" onRequestClose={() => setShowDurationPicker(false)}>
            <View style={styles.overlay}>
               <View style={[styles.durationPickerContent, { backgroundColor: colors.surface }]}>
                  <View style={styles.durationHeader}>
                     <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold, marginBottom: 0 }]}>Select Duration</Text>
                     <TouchableOpacity onPress={() => setShowDurationPicker(false)}>
                        <Ionicons name="close" size={26} color={colors.textDark} />
                     </TouchableOpacity>
                  </View>

                  <View style={{
                     width: WHEEL_VISIBLE * WHEEL_ITEM_WIDTH,
                     height: WHEEL_HEIGHT,
                     alignSelf: "center",
                     marginVertical: 22,
                  }}>
                     <View
                        pointerEvents="none"
                        style={[styles.wheelLens, {
                           left: WHEEL_PAD,
                           width: WHEEL_ITEM_WIDTH,
                           top: 0,
                           bottom: 0,
                           borderColor: colors.primary + "40",
                           backgroundColor: colors.primary + "0C",
                        }]}
                     />
                     <ScrollView
                        ref={durationScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        snapToInterval={WHEEL_ITEM_WIDTH}
                        decelerationRate="fast"
                        contentContainerStyle={{ paddingHorizontal: WHEEL_PAD }}
                        onMomentumScrollEnd={(e) => {
                           const idx = Math.round(e.nativeEvent.contentOffset.x / WHEEL_ITEM_WIDTH);
                           const value = durationOptions[Math.max(0, Math.min(durationOptions.length - 1, idx))];
                           if (value) setManualForm((f) => ({ ...f, duration: String(value) }));
                        }}
                     >
                        {durationOptions.map((m) => {
                           const isSel = Number(manualForm.duration) === m;
                           return (
                              <View key={m} style={{ width: WHEEL_ITEM_WIDTH, height: WHEEL_HEIGHT, justifyContent: "center", alignItems: "center" }}>
                                 <Text style={{
                                    color: isSel ? colors.primary : colors.textDark,
                                    fontFamily: fonts.bold,
                                    fontSize: isSel ? 28 : 19,
                                    opacity: isSel ? 1 : 0.45,
                                 }}>{m}</Text>
                              </View>
                           );
                        })}
                     </ScrollView>
                  </View>

                  <Text style={{ textAlign: "center", color: colors.textLight, fontFamily: fonts.medium, fontSize: 12, marginBottom: 8 }}>
                     minutes
                  </Text>

                  <TouchableOpacity
                     onPress={() => setShowDurationPicker(false)}
                     style={[styles.generateBtn, { backgroundColor: colors.primary, marginHorizontal: 26, marginBottom: 26, marginTop: 0 }]}
                  >
                     <Text style={[styles.generateText, { fontFamily: fonts.bold }]}>Done</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>

         <Modal visible={showSubjectPicker} transparent animationType="fade">
            <View style={styles.modalOverlaySecondary}>
               <View style={{ backgroundColor: colors.surface, width: "80%", borderRadius: 20, padding: 20, maxHeight: "60%" }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, marginBottom: 15, textAlign: "center", color: colors.textDark }}>Pick a Course</Text>
                  <ScrollView>
                     {subjects.length === 0 ? (
                        <Text style={{ color: colors.textLight, textAlign: "center", padding: 20, fontFamily: fonts.medium }}>
                           No courses yet. Add one from Profile → Manage Courses.
                        </Text>
                     ) : subjects.map((sub) => {
                        const isSel = manualForm.subjectId === sub.id;
                        return (
                           <TouchableOpacity
                              key={sub.id}
                              style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, backgroundColor: isSel ? colors.primary + "15" : "transparent" }}
                              onPress={() => {
                                 setManualForm({ ...manualForm, subjectId: sub.id });
                                 setShowSubjectPicker(false);
                              }}
                           >
                              <Text style={{ color: isSel ? colors.primary : colors.textDark, fontFamily: fonts.bold, fontSize: 16 }}>{sub.name}</Text>
                              {isSel && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                           </TouchableOpacity>
                        );
                     })}
                  </ScrollView>
                  <TouchableOpacity
                     style={{ marginTop: 15, padding: 12, backgroundColor: colors.border, borderRadius: 10, alignItems: "center" }}
                     onPress={() => setShowSubjectPicker(false)}
                  >
                     <Text style={{ color: colors.textDark, fontFamily: fonts.bold }}>Cancel</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>

         <Modal visible={showHourPicker} transparent animationType="slide" onRequestClose={() => setShowHourPicker(false)}>
            <View style={styles.timePickerOverlay}>
               <View style={[styles.timePickerContent, { backgroundColor: colors.surface }]}>
                  <View style={[styles.timePickerHeader, { borderBottomColor: colors.border }]}>
                     <Text style={[styles.timePickerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>
                        {activeSlotField === "start" ? "Start Time" : "End Time"}
                     </Text>
                     <TouchableOpacity
                        onPress={() => setShowHourPicker(false)}
                        style={[styles.timePickerClose, { backgroundColor: colors.cardAlt }]}
                     >
                        <Ionicons name="close" size={22} color={colors.textDark} />
                     </TouchableOpacity>
                  </View>
                  <View style={styles.timePickerBody}>
                     {renderTimeColumn("Hour", hourOptions, parseInt(newSlot[activeSlotField].split(":")[0], 10), (h) => {
                        const m = newSlot[activeSlotField].split(":")[1];
                        setNewSlot({ ...newSlot, [activeSlotField]: `${String(h).padStart(2, "0")}:${m}` });
                     })}
                     <View style={styles.timePickerSeparator}>
                        <Text style={[styles.timePickerSeparatorText, { color: colors.textDark, fontFamily: fonts.bold }]}>:</Text>
                     </View>
                     {renderTimeColumn("Min", minuteOptions, parseInt(newSlot[activeSlotField].split(":")[1], 10), (m) => {
                        const h = newSlot[activeSlotField].split(":")[0];
                        setNewSlot({ ...newSlot, [activeSlotField]: `${h}:${String(m).padStart(2, "0")}` });
                     })}
                  </View>
                  <View style={styles.timePickerFooter}>
                     <TouchableOpacity
                        onPress={() => setShowHourPicker(false)}
                        style={[styles.generateBtn, styles.timePickerDone, { backgroundColor: colors.primary }]}
                     >
                        <Text style={[styles.generateText, { fontFamily: fonts.bold }]}>Done</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         </Modal>
      </Modal>
   );
};

const styles = StyleSheet.create({
   overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
   },
   container: {
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      maxHeight: "90%",
      marginTop: "auto",
   },
   title: {
      fontSize: 24,
      marginBottom: 8,
   },
   aiGeneratingWrap: {
      paddingHorizontal: 28,
      paddingTop: 30,
      paddingBottom: 44,
      alignItems: "center",
   },
   aiGeneratingIcon: {
      width: 78,
      height: 78,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
      shadowColor: "#6B5CE7",
      shadowOpacity: 0.24,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
   },
   aiGeneratingTitle: {
      fontSize: 24,
      textAlign: "center",
      marginBottom: 8,
   },
   aiGeneratingText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      maxWidth: 310,
      marginBottom: 22,
   },
   aiSteps: {
      width: "100%",
      gap: 10,
   },
   aiStepRow: {
      minHeight: 54,
      borderRadius: 16,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
   },
   aiStepDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
   },
   aiStepText: {
      flex: 1,
      fontSize: 13,
   },
   subtitle: {
      fontSize: 15,
      marginBottom: 24,
      lineHeight: 22,
   },
   label: {
      fontSize: 16,
      marginBottom: 12,
   },
   slotsList: {
      maxHeight: 45,
      marginBottom: 16,
   },
   slotChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      marginRight: 8,
   },
   subjectsList: {
      maxHeight: 50,
      marginBottom: 16,
   },
   chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      marginRight: 10,
   },
   inputGroup: { padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
   inputHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
   inputBoxText: { fontSize: 18, paddingLeft: 30, outlineStyle: "none" },
   addBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
   },
   subjectsReview: {
      gap: 10,
      marginBottom: 15,
   },
   subjectReviewItem: {
      padding: 12,
      borderRadius: 12,
   },
   subjectReviewHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
   },
   subjectName: {
      fontSize: 14,
   },
   subjectMeta: {
      fontSize: 11,
   },
   taskListMini: {
      marginLeft: 4,
   },
   taskMiniText: {
      fontSize: 11,
      lineHeight: 16,
   },
   modifyBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      gap: 8,
   },
   modifyBtnText: {
      fontSize: 13,
   },
   generateBtn: {
      flexDirection: "row",
      padding: 18,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
      overflow: "hidden",
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
   },
   generateText: {
      color: "#fff",
      fontSize: 18,
   },
   aiBtn: {
      height: 50,
      borderRadius: 16,
      borderWidth: 1.5,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
   },
   aiBtnText: {
      fontSize: 14,
   },
   formContainer: {
      marginBottom: 20,
      padding: 16,
      backgroundColor: "rgba(0,0,0,0.03)",
      borderRadius: 16,
   },
   fieldLabel: {
      fontSize: 12,
      letterSpacing: 0.5,
      marginBottom: 12,
   },
   miniLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 10, opacity: 0.7 },
   modalOverlaySecondary: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
   modalInputBox: {
      height: 50,
      borderRadius: 12,
      paddingHorizontal: 15,
      marginBottom: 15,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#E2E8F0",
   },
   modalRow: { flexDirection: "row", marginBottom: 5 },
   priorityGrid: { flexDirection: "row", gap: 10 },
   prioSelect: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
   diffBarRow: { flexDirection: "row", gap: 5, marginTop: 5 },
   diffBit: { flex: 1, height: 8, borderRadius: 4 },
   mainBtn: { height: 50, borderRadius: 16, justifyContent: "center", alignItems: "center" },
   modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(0,0,0,0.05)",
   },
   sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 15 },
   inlineForm: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
   miniTimeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
   addBtnSmall: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
   subjectSection: { marginBottom: 15, padding: 15, borderRadius: 16, borderLeftWidth: 4, backgroundColor: "rgba(0,0,0,0.02)", borderStyle: "solid" },
   subjectHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
   subjectName: { fontSize: 15 },
   taskItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 10 },
   taskText: { flex: 1, fontSize: 13 },
   inlineTaskForm: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: "rgba(0,0,0,0.05)",
      paddingTop: 10,
   },
   taskInput: { flex: 1, fontSize: 12, borderBottomWidth: 1, paddingVertical: 5 },
   addSubjectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 15,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      justifyContent: "center",
      marginBottom: 25,
   },
   btnGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
   modifyBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 12,
   },
   modifyBtnText: { fontSize: 15 },
   modeTabs: { flexDirection: "row", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 },
   modeTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
   modeTabText: { fontSize: 13 },
   manualInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15, height: 48 },
   manualRow: { flexDirection: "row", gap: 12, marginTop: 14 },
   durationPickerContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 20 },
   durationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 26, paddingBottom: 6 },
   wheelLens: { position: "absolute", borderRadius: 14, borderLeftWidth: 1, borderRightWidth: 1 },
   timePickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.56)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 24,
   },
   timePickerContent: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "82%",
      borderRadius: 24,
      overflow: "hidden",
   },
   timePickerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
   },
   timePickerTitle: { fontSize: 20 },
   timePickerClose: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
   },
   timePickerBody: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 12,
      height: 300,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
   },
   timePickerColumn: { flex: 1, minWidth: 0 },
   timePickerColumnLabel: {
      fontSize: 11,
      textAlign: "center",
      marginBottom: 8,
      textTransform: "uppercase",
   },
   timePickerScroll: {
      flex: 1,
      borderRadius: 16,
   },
   timePickerScrollContent: { padding: 6 },
   timePickerOption: {
      minHeight: 42,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginVertical: 2,
   },
   timePickerOptionText: { fontSize: 17 },
   timePickerSeparator: {
      width: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 20,
   },
   timePickerSeparatorText: { fontSize: 24 },
   timePickerFooter: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 20,
   },
   timePickerDone: {
      marginTop: 0,
      marginHorizontal: 0,
      marginBottom: 0,
   },
   priorityRow: { flexDirection: "row", gap: 8 },
   prioBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
