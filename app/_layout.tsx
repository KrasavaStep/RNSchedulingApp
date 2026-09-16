import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";

// 1. Импортируем провайдер и инициализированную базу WatermelonDB
import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { database } from "../hooks/database";

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
      {/* 2. Заменяем SQLiteProvider на DatabaseProvider */}
      <DatabaseProvider database={database}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colorScheme === "dark" ? "#121212" : "#fff",
            },
            headerTintColor: colorScheme === "dark" ? "#fff" : "#333",
            headerTitleStyle: { fontWeight: "bold" },
          }}
        >
          {/* Главный экран списка задач */}
          <Stack.Screen name="index" options={{ title: "Список задач" }} />

          {/* Экран формы создания и редактирования */}
          <Stack.Screen
            name="taskCreationFragment"
            options={{ title: "Задача" }}
          />

          {/* Экран подробной информации */}
          <Stack.Screen
            name="taskDetailFragment"
            options={{ title: "Детали задачи" }}
          />

          {/* Модальное окно */}
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Информация" }}
          />

          {/* Журнал логов */}
          <Stack.Screen
            name="historyFragment"
            options={{ title: "Журнал событий" }}
          />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
