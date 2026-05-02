import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

export default function Index() {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <View style={styles.container} testID="splash-screen">
        <Text style={styles.logo}>
          QUICK<Text style={{ color: colors.primary }}>GIG</Text>
        </Text>
        <ActivityIndicator color={colors.text} size="large" />
      </View>
    );
  }

  return user ? <Redirect href="/(tabs)/browse" /> : <Redirect href="/(auth)/welcome" />;
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
