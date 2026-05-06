import { extractErrorMessage } from "../services/errors";
import React, { useState, useEffect } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform } from "react-native";
import { useTheme } from "../theme/theme";
import { useAI } from "../context/ai_context";
import { useAppNavigation } from "../context/navigation_context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { slotsApi } from "../services/api";
import { showAlert } from "../services/dialogs";
import { LinearGradient } from "expo-linear-gradient";

export const DailyCheckinModal = ({ visible, onClose, selectedDate }) => {
   const { colors, fonts } = useTheme();
   const { subjects, tasks, generateSchedule, userData } = useAI();
   const { navigate } = useAppNavigation();
   const [loading, setLoading] = useState(false);
   const [slots, setSlots] = useState([]);
   const [newSlot, setNewSlot] = useState({ start: "08:00", end: "10:00" });
   const [showHourPicker, setShowHourPicker] = useState(false);
   const [activeSlotField, setActiveSlotField] = useState("start");

   const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

   useEffect(() => {
      if (visible) {
         const dateToUse = selectedDate || new Date().toISOString().split("T")[0];
         slotsApi.list(dateToUse).then(setSlots).catch(console.warn);
      }
   }, [visible, selectedDate]);

   const handleAddSlot = async () => {
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
         showAlert("No Subjects", "Add a subject first.");
         return;
      }
      setLoading(true);
      try {
         const dateToUse = selectedDate || new Date().toISOString().split("T")[0];
         await generateSchedule(dateToUse);
         onClose();
      } catch (err) {
         const detail = extractErrorMessage(err);
         showAlert("Optimization Failed", detail);
      } finally {
         setLoading(false);
      }
   };

   if (!visible) return null;

   return (
      <Modal visible={visible} transparent animationType="slide">
         <View style={styles.overlay}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
               <View style={styles.modalHeader}>
                  <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>Plan Optimizer</Text>
                  <TouchableOpacity onPress={onClose}>
                     <Ionicons name="close" size={24} color={colors.textLight} />
                  </TouchableOpacity>
               </View>

               <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
                  <Text style={[styles.subtitle, { color: colors.textLight, fontFamily: fonts.medium }]}>
                     Configure your day. Set time blocks and verify your upcoming tasks for the AI to organize.
                  </Text>

                  {/* SECTION 1: TIME BLOCKS */}
                  <View style={styles.sectionRow}>
                     <Ionicons name="time-outline" size={20} color={colors.primary} />
                     <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.bold }]}>Study Blocks</Text>
                  </View>
                  <ScrollView style={styles.slotsList} horizontal showsHorizontalScrollIndicator={false}>
                     {slots.map((s) => (
                        <View key={s.id} style={[styles.slotChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                           <Text style={{ color: colors.textDark, fontFamily: fonts.medium, fontSize: 13 }}>
                              {s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)}
                           </Text>
                           <TouchableOpacity onPress={() => handleRemoveSlot(s.id)} style={{ marginLeft: 8 }}>
                              <Ionicons name="close-circle" size={16} color={colors.textLight} />
                           </TouchableOpacity>
                        </View>
                     ))}
                  </ScrollView>

                  <View style={styles.inlineForm}>
                     <TouchableOpacity
                        style={[styles.miniTimeBtn, { backgroundColor: colors.cardAlt }]}
                        onPress={() => {
                           setActiveSlotField("start");
                           setShowHourPicker(true);
                        }}
                     >
                        <Text style={{ color: colors.textDark, fontSize: 12 }}>{newSlot.start}</Text>
                     </TouchableOpacity>
                     <Text style={{ color: colors.textLight }}>to</Text>
                     <TouchableOpacity
                        style={[styles.miniTimeBtn, { backgroundColor: colors.cardAlt }]}
                        onPress={() => {
                           setActiveSlotField("end");
                           setShowHourPicker(true);
                        }}
                     >
                        <Text style={{ color: colors.textDark, fontSize: 12 }}>{newSlot.end}</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.addBtnSmall, { backgroundColor: colors.primary }]} onPress={handleAddSlot}>
                        <Ionicons name="add" size={20} color="#FFF" />
                     </TouchableOpacity>
                  </View>

                  {/* SUBJECTS & TASKS SECTION */}
                  <View style={[styles.sectionRow, { marginTop: 20 }]}>
                     <Ionicons name="book-outline" size={20} color={colors.primary} />
                     <Text style={[styles.label, { color: colors.textDark, fontFamily: fonts.bold }]}>Subjects & Tasks</Text>
                  </View>

                  <View style={styles.subjectsReview}>
                     {subjects.map((sub) => (
                        <View key={sub.id} style={[styles.subjectReviewItem, { backgroundColor: colors.cardAlt }]}>
                           <View style={styles.subjectReviewHeader}>
                              <Text style={[styles.subjectName, { color: colors.textDark, fontFamily: fonts.bold }]}>{sub.name}</Text>
                              <Text style={[styles.subjectMeta, { color: colors.textLight, fontFamily: fonts.medium }]}>
                                 {tasks.filter((t) => t.subject_id === sub.id).length} tasks
                              </Text>
                           </View>
                           <View style={styles.taskListMini}>
                              {tasks
                                 .filter((t) => t.subject_id === sub.id)
                                 .slice(0, 2)
                                 .map((task) => (
                                    <Text
                                       key={task.id}
                                       style={[styles.taskMiniText, { color: colors.textLight, fontFamily: fonts.medium }]}
                                       numberOfLines={1}
                                    >
                                       • {task.title}
                                    </Text>
                                 ))}
                              {tasks.filter((t) => t.subject_id === sub.id).length > 2 && (
                                 <Text style={[styles.taskMiniText, { color: colors.primary, fontFamily: fonts.bold, fontSize: 10 }]}>
                                    + {tasks.filter((t) => t.subject_id === sub.id).length - 2} more
                                 </Text>
                              )}
                           </View>
                        </View>
                     ))}
                  </View>

                  <TouchableOpacity
                     style={[styles.modifyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                     onPress={() => {
                        navigate("subjects");
                        onClose();
                     }}
                  >
                     <Ionicons name="create-outline" size={18} color={colors.primary} />
                     <Text style={[styles.modifyBtnText, { color: colors.primary, fontFamily: fonts.bold }]}>Modify Subjects & Tasks</Text>
                  </TouchableOpacity>

                  <Text
                     style={{ fontSize: 11, color: colors.textLight, textAlign: "center", marginBottom: 25, fontFamily: fonts.medium, marginTop: 10 }}
                  >
                     The AI will prioritize these subjects based on your progress and exam dates.
                  </Text>

                  {/* GENERATE BUTTON */}
                  <TouchableOpacity
                     style={[styles.generateBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                     onPress={handleGenerate}
                     disabled={loading}
                  >
                     <LinearGradient colors={["rgba(255,255,255,0.2)", "transparent"]} style={styles.btnGradient} />
                     <Text style={[styles.generateText, { fontFamily: fonts.bold }]}>{loading ? "Consulting AI..." : "Generate AI Plan"}</Text>
                     <MaterialCommunityIcons name="brain" size={18} color="#FFF" style={{ marginLeft: 10 }} />
                  </TouchableOpacity>
               </ScrollView>
            </View>
         </View>

         <Modal visible={showHourPicker} transparent animationType="fade">
            <View style={styles.modalOverlaySecondary}>
               <View style={{ backgroundColor: colors.surface, width: "80%", borderRadius: 20, padding: 20, maxHeight: "60%" }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, marginBottom: 15, textAlign: "center" }}>Select Hour</Text>
                  <ScrollView>
                     {hours.map((h) => (
                        <TouchableOpacity
                           key={h}
                           style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: "center" }}
                           onPress={() => {
                              setNewSlot({ ...newSlot, [activeSlotField]: h });
                              setShowHourPicker(false);
                           }}
                        >
                           <Text style={{ color: colors.textDark, fontFamily: fonts.medium, fontSize: 16 }}>{h}</Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>
                  <TouchableOpacity
                     style={{ marginTop: 15, padding: 15, backgroundColor: colors.border, borderRadius: 10, alignItems: "center" }}
                     onPress={() => setShowHourPicker(false)}
                  >
                     <Text style={{ color: colors.textDark, fontFamily: fonts.bold }}>Cancel</Text>
                  </TouchableOpacity>
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
});
