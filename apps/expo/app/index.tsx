import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useExpoAuth } from "../src/auth";

export default function IndexScreen() {
  const { status } = useExpoAuth();

  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: "#f4efe7",
        }}
      >
        <ActivityIndicator size="large" color="#1d5c63" />
        <Text style={{ fontSize: 18, color: "#17343a" }}>Restoring session...</Text>
      </View>
    );
  }

  if (status === "authenticated") {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/sign-in" />;
}
