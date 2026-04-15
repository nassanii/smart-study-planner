import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Image } from 'react-native';
import { useTheme } from '../theme/theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const ProfileScreen = () => {
  const { colors, fonts, isDarkMode, toggleTheme } = useTheme();

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 60 }}
    >
      <View style={styles.header}>
         <Text style={[styles.headerTitle, { color: colors.textDark, fontFamily: fonts.bold }]}>Settings</Text>
         <Ionicons name="settings-outline" size={26} color={colors.textDark} />
      </View>

      <View style={[styles.profileHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.profileLeft}>
           <LinearGradient
             colors={[colors.primary, '#A29BFE']}
             style={styles.avatarGradient}
           >
              <Text style={[styles.avatarText, { fontFamily: fonts.bold }]}>IH</Text>
           </LinearGradient>
           <View>
              <Text style={[styles.nameText, { color: colors.textDark, fontFamily: fonts.bold }]}>Ibrahim Hilvani</Text>
              <Text style={[styles.emailText, { color: colors.textLight, fontFamily: fonts.medium }]}>ibrahim@university.edu</Text>
           </View>
        </View>
        <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.cardAlt }]}>
           <Ionicons name="pencil" size={16} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textLight, fontFamily: fonts.bold }]}>ACCOUNT</Text>
      <View style={[styles.menuGrp, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         {[
           { icon: 'person-outline', title: 'Edit Profile', sub: 'Name, email, photo', val: null },
           { icon: 'lock-closed-outline', title: 'Change Password', sub: null, val: null },
           { icon: 'link-outline', title: 'Connected Accounts', sub: 'Google, Apple', val: '2' }
         ].map((item, idx) => (
           <TouchableOpacity 
             key={idx} 
             style={[styles.menuRow, idx < 2 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
           >
              <View style={[styles.iconBox, { backgroundColor: colors.cardAlt }]}>
                 <Ionicons name={item.icon} size={18} color={colors.textDark} />
              </View>
              <View style={{flex: 1}}>
                 <Text style={[styles.menuText, { color: colors.textDark, fontFamily: fonts.semiBold }]}>{item.title}</Text>
                 {item.sub && <Text style={[styles.menuSubText, { color: colors.textLight, fontFamily: fonts.medium }]}>{item.sub}</Text>}
              </View>
              {item.val && <Text style={[styles.menuValue, { color: colors.textLight, fontFamily: fonts.bold }]}>{item.val}  </Text>}
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
           </TouchableOpacity>
         ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textLight, fontFamily: fonts.bold }]}>APPEARANCE</Text>
      <View style={[styles.menuGrp, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <View style={[styles.menuRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
               <Ionicons name="moon-outline" size={18} color={colors.textDark} />
            </View>
            <View style={{flex: 1}}>
               <Text style={[styles.menuText, { color: colors.textDark, fontFamily: fonts.semiBold }]}>Dark Mode</Text>
               <Text style={[styles.menuSubText, { color: colors.textLight, fontFamily: fonts.medium }]}>Adjust the overall theme</Text>
            </View>
            <Switch
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={"#FFF"}
              ios_backgroundColor={colors.border}
              onValueChange={toggleTheme}
              value={isDarkMode}
            />
         </View>
         <TouchableOpacity style={styles.menuRow}>
            <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
               <Ionicons name="language-outline" size={18} color={colors.textDark} />
            </View>
            <View style={{flex: 1}}>
               <Text style={[styles.menuText, { color: colors.textDark, fontFamily: fonts.semiBold }]}>Language</Text>
            </View>
            <Text style={[styles.menuValue, { color: colors.textLight, fontFamily: fonts.medium }]}>English  </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
         </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textLight, fontFamily: fonts.bold }]}>STUDY PREFERENCES</Text>
      <View style={[styles.menuGrp, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <TouchableOpacity style={[styles.menuRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={[styles.iconBox, { backgroundColor: '#FFE4E6' }]}>
               <Ionicons name="timer-outline" size={18} color={colors.textDark} />
            </View>
            <View style={{flex: 1}}>
               <Text style={[styles.menuText, { color: colors.textDark, fontFamily: fonts.semiBold }]}>Focus Duration</Text>
               <Text style={[styles.menuSubText, { color: colors.textLight, fontFamily: fonts.medium }]}>Pomodoro session length</Text>
            </View>
            <Text style={[styles.menuValue, { color: colors.textLight, fontFamily: fonts.bold }]}>25 min  </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
         </TouchableOpacity>
         <View style={styles.menuRow}>
            <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
               <MaterialCommunityIcons name="robot" size={18} color={colors.textDark} />
            </View>
            <View style={{flex: 1}}>
               <Text style={[styles.menuText, { color: colors.textDark, fontFamily: fonts.semiBold }]}>AI Optimization</Text>
               <Text style={[styles.menuSubText, { color: colors.textLight, fontFamily: fonts.medium }]}>Auto-adjust schedule</Text>
            </View>
            <Switch 
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
              value={true} 
            />
         </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.accent.exam, fontFamily: fonts.bold }]}>DANGER ZONE</Text>
      <View style={[styles.menuGrp, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <TouchableOpacity style={styles.menuRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
               <Ionicons name="trash-outline" size={18} color={colors.accent.exam} />
            </View>
            <View style={{flex: 1}}>
               <Text style={[styles.menuText, { color: colors.accent.exam, fontFamily: fonts.bold }]}>Delete Account</Text>
               <Text style={[styles.menuSubText, { color: colors.textLight, fontFamily: fonts.medium }]}>This action cannot be undone</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
         </TouchableOpacity>
      </View>
      
      <View style={styles.footer}>
         <MaterialCommunityIcons name="book-open-variant" size={24} color={colors.textLight} />
         <Text style={[styles.footerTitle, { color: colors.textLight, fontFamily: fonts.bold }]}>StudyPlan v1.0.0</Text>
         <Text style={[styles.footerText, { color: colors.textLight, fontFamily: fonts.medium }]}>Made with <Ionicons name="heart" size={14} color="#FF6B8B" /> for students</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 35,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 15,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  avatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 22,
  },
  nameText: {
    fontSize: 19,
    marginBottom: 4,
  },
  emailText: {
    fontSize: 13,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 14,
    marginLeft: 6,
  },
  menuGrp: {
    borderRadius: 24,
    marginBottom: 35,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  menuText: {
    fontSize: 16,
    marginBottom: 2,
  },
  menuSubText: {
    fontSize: 12,
  },
  menuValue: {
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  footerTitle: {
    fontSize: 14,
    marginTop: 4,
  },
  footerText: {
    fontSize: 12,
  }
});
