import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import { Search, PlusSquare, MessageCircle, User } from "lucide-react-native";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#000",
        tabBarInactiveTintColor: "#666",
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 2,
          borderTopColor: "#000",
          height: Platform.OS === "ios" ? 86 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color}>
              <Search size={20} color={color} strokeWidth={2.5} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Post",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} highlight>
              <PlusSquare size={22} color={color} strokeWidth={2.5} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color}>
              <MessageCircle size={20} color={color} strokeWidth={2.5} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color}>
              <User size={20} color={color} strokeWidth={2.5} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ children, focused, highlight }: any) {
  return (
    <View
      style={[
        styles.tabIcon,
        focused && styles.tabIconActive,
        highlight && { backgroundColor: colors.primary },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconActive: {
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: "#000",
  },
});
