import { Redirect } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useExpoAuth } from "../src/auth";

export default function SignInScreen() {
  const { callbackUrl, error, signInWithEmail, signInWithGoogle, status } =
    useExpoAuth();
  const [email, setEmail] = useState("hello@example.com");
  const [password, setPassword] = useState("password123");
  const [pending, setPending] = useState<null | "email" | "google">(null);

  if (status === "authenticated") {
    return <Redirect href="/home" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>convex-zen/expo</Text>
          <Text style={styles.title}>Deep-link auth without cookies.</Text>
          <Text style={styles.subtitle}>
            This example stores the session token in SecureStore and completes
            Google OAuth manually from an Expo callback URL.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="hello@example.com"
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="password123"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <Pressable
            onPress={async () => {
              setPending("email");
              try {
                await signInWithEmail({ email, password });
              } finally {
                setPending(null);
              }
            }}
            style={[styles.primaryButton, pending === "email" && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>
              {pending === "email" ? "Signing in..." : "Sign in with email"}
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              setPending("google");
              try {
                await signInWithGoogle();
              } finally {
                setPending(null);
              }
            }}
            style={[styles.secondaryButton, pending === "google" && styles.buttonDisabled]}
          >
            <Text style={styles.secondaryButtonText}>
              {pending === "google" ? "Opening browser..." : "Continue with Google"}
            </Text>
          </Pressable>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Expo callback URL</Text>
            <Text selectable style={styles.infoValue}>
              {callbackUrl}
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
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
    justifyContent: "center",
    padding: 24,
    gap: 20,
  },
  hero: {
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
    fontSize: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: "#36585d",
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: "#fffaf3",
    borderColor: "#dcc9b7",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  label: {
    color: "#17343a",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#d3c3b2",
    borderRadius: 16,
    borderWidth: 1,
    color: "#10292c",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#17343a",
    borderRadius: 16,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: "#f7f1e8",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#df6f3d",
    borderRadius: 16,
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: "#fff7ef",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  infoBlock: {
    backgroundColor: "#f2e8da",
    borderRadius: 16,
    gap: 4,
    marginTop: 8,
    padding: 14,
  },
  infoLabel: {
    color: "#8c4f31",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoValue: {
    color: "#17343a",
    fontSize: 13,
  },
  errorText: {
    color: "#9d2d18",
    fontSize: 14,
    fontWeight: "600",
  },
});
