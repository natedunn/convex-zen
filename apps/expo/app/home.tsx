import { Redirect } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useExpoAuth } from "../src/auth";

export default function HomeScreen() {
  const { currentUser, session, signOut, status } = useExpoAuth();

  if (status === "loading") {
    return null;
  }

  if (status !== "authenticated" || !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Session restored</Text>
          <Text style={styles.title}>Expo auth is live.</Text>
          <Text style={styles.subtitle}>
            The session token came from SecureStore and the current user came from a
            generated `core.currentUser({})` call.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Session</Text>
          <Text style={styles.row}>userId: {session.userId}</Text>
          <Text style={styles.row}>sessionId: {session.sessionId}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Current User</Text>
          <Text selectable style={styles.codeBlock}>
            {JSON.stringify(currentUser, null, 2)}
          </Text>
        </View>

        <Pressable onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4efe7",
  },
  container: {
    flexGrow: 1,
    gap: 18,
    padding: 24,
  },
  header: {
    gap: 10,
  },
  kicker: {
    color: "#8c4f31",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#10292c",
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: "#36585d",
    fontSize: 16,
    lineHeight: 24,
  },
  panel: {
    backgroundColor: "#fffaf3",
    borderColor: "#dcc9b7",
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  panelTitle: {
    color: "#17343a",
    fontSize: 17,
    fontWeight: "800",
  },
  row: {
    color: "#17343a",
    fontSize: 15,
  },
  codeBlock: {
    color: "#17343a",
    fontFamily: "Courier",
    fontSize: 13,
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: "#17343a",
    borderRadius: 16,
    paddingVertical: 15,
  },
  signOutText: {
    color: "#f7f1e8",
    fontSize: 15,
    fontWeight: "700",
  },
});
