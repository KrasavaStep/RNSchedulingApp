import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import { SQLiteProvider } from "expo-sqlite";
import { initDatabaseStructure } from "../hooks/db";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <SQLiteProvider
        databaseName="rnscheduling.db"
        onInit={initDatabaseStructure}
      >
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colorScheme === "dark" ? "#121212" : "#fff",
            },
            headerTintColor: colorScheme === "dark" ? "#fff" : "#333",
            headerTitleStyle: { fontWeight: "bold" },
          }}
        >
          {/* 1. Главный экран списка задач (бывший two.tsx) */}
          <Stack.Screen name="index" options={{ title: "Список задач" }} />

          {/* 2. Экран формы создания и редактирования */}
          <Stack.Screen
            name="taskCreationFragment"
            options={{ title: "Задача" }}
          />

          {/* 3. Экран подробной информации */}
          <Stack.Screen
            name="taskDetailFragment"
            options={{ title: "Детали задачи" }}
          />

          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Информация" }}
          />

          <Stack.Screen
            name="historyFragment"
            options={{ title: "Журнал событий" }}
          />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
