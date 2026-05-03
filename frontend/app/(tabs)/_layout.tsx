import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, Briefcase, MessageCircle, User } from "lucide-react-native";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 64 + bottomPad,
          paddingTop: 10,
          paddingBottom: bottomPad,
          elevation: 12,
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
          title: "Post a Job",
          tabBarIcon: ({ color }) => (
            <Briefcase size={22} color={color} strokeWidth={2.4} />
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
