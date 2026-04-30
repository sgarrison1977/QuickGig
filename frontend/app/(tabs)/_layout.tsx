import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import { Search, Plus, MessageCircle, User } from "lucide-react-native";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 86 : 70,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
          elevation: 12,
          shadowColor: "#0E1230",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color }) => <Search size={22} color={color} strokeWidth={2.4} />,
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Post",
          tabBarIcon: () => (
            <View style={styles.postBtn}>
              <Plus size={22} color="#fff" strokeWidth={3} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} strokeWidth={2.4} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={2.4} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  postBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
});
