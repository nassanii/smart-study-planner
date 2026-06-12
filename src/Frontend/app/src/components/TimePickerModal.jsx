import React from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/theme";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);
const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const TimePickerModal = ({
  visible,
  title = "Select Time",
  hour = 9,
  minute = 0,
  onChange,
  onClose,
}) => {
  const { colors, fonts } = useTheme();

  const selectHour = (nextHour) => {
    onChange?.({ hour: nextHour, minute });
  };

  const selectMinute = (nextMinute) => {
    onChange?.({ hour, minute: nextMinute });
  };

  const renderColumn = (label, values, selectedValue, onSelect) => (
    <View style={styles.column}>
      <Text style={[styles.columnLabel, { color: colors.textLight, fontFamily: fonts.bold }]}>
        {label}
      </Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.columnScroll, { backgroundColor: colors.cardAlt }]}
        contentContainerStyle={styles.columnContent}
      >
        {values.map((value) => {
          const isSelected = selectedValue === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => onSelect(value)}
              style={[
                styles.option,
                { backgroundColor: isSelected ? colors.primary + "18" : "transparent" },
              ]}
            >
              <Text
                style={[
                  styles.optionText,
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.textDark, fontFamily: fonts.bold }]}>
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.cardAlt }]}
            >
              <Ionicons name="close" size={22} color={colors.textDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {renderColumn("Hour", HOUR_OPTIONS, hour, selectHour)}
            <View style={styles.separator}>
              <Text style={[styles.separatorText, { color: colors.textDark, fontFamily: fonts.bold }]}>:</Text>
            </View>
            {renderColumn("Min", MINUTE_OPTIONS, minute, selectMinute)}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.doneText, { fontFamily: fonts.bold }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.56)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  content: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "82%",
    borderRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  body: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    height: 300,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  column: { flex: 1, minWidth: 0 },
  columnLabel: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  columnScroll: {
    flex: 1,
    borderRadius: 16,
  },
  columnContent: { padding: 6 },
  option: {
    minHeight: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 2,
  },
  optionText: { fontSize: 17 },
  separator: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },
  separatorText: { fontSize: 24 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  doneButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    color: "#FFF",
    fontSize: 18,
  },
});
