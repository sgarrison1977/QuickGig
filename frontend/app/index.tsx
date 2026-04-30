import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

export default function Index() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    if (user) {
      router.replace("/(tabs)/browse");
    } else {
      router.replace("/(auth)/welcome");
    }
  }, [user, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Text style={styles.logo}>QUICK<Text style={{ color: colors.primary }}>GIG</Text></Text>
      <ActivityIndicator color={colors.text} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  logo: {
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -2,
    color: colors.text,
  },
});
