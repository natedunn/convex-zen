import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ExpoAuthProvider } from "../src/auth";

export default function RootLayout() {
  return (
    <ExpoAuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#f4efe7",
          },
        }}
      />
    </ExpoAuthProvider>
  );
}
