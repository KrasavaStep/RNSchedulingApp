import { Alert, Platform } from "react-native";

// Динамически импортируем только то, что безопасно для локальных пушей
let Notifications: any = null;
try {
  Notifications = require("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.log("Уведомления запущены в ограниченном режиме Expo Go");
}

export const requestNotificationPermissions = async () => {
  if (!Notifications) return false;
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      Alert.alert("Уведомления", "Разрешение на пуши не получено.");
      return false;
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("task-reminders", {
        name: "Напоминания о задачах",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
    return true;
  } catch (err) {
    return false;
  }
};

export const scheduleTaskNotification = async (
  taskId: string,
  title: string,
  dueDateStr: string,
  isDemoMode: boolean = false,
) => {
  if (!Notifications) {
    console.log(`[ОФФЛАЙН ПУШ] Имитация планирования для задачи "${title}"`);
    return "mock-id";
  }

  const dueDate = new Date(dueDateStr);
  const now = new Date();
  let triggerDate = isDemoMode
    ? new Date(now.getTime() + 30 * 1000)
    : new Date(dueDate.getTime() - 30 * 60 * 1000);
  let bodyMessage = isDemoMode
    ? `[ДЕМО] Срок задачи "${title}" подходит к концу!`
    : `До крайнего срока "${title}" осталось 30 минут!`;

  if (
    !isDemoMode &&
    triggerDate.getTime() <= now.getTime() &&
    dueDate.getTime() > now.getTime()
  ) {
    triggerDate = new Date(now.getTime() + 10 * 1000);
    bodyMessage = `⚠️ [СРОЧНО] Менее 30 минут до выполнения "${title}"!`;
  }

  try {
    await cancelTaskNotification(taskId);
    const secondsFromNow = Math.floor(
      (triggerDate.getTime() - Date.now()) / 1000,
    );

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Напоминание о дедлайне",
        body: bodyMessage,
        data: { taskId },
        sound: true,
      },
      trigger: {
        seconds: secondsFromNow > 0 ? secondsFromNow : 1,
        repeats: false,
      },
    });
  } catch (e) {
    return null;
  }
};

export const cancelTaskNotification = async (taskId: string) => {
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const triggerToCancel = scheduled.find(
      (n: any) => n.content.data?.taskId === taskId,
    );
    if (triggerToCancel) {
      await Notifications.cancelScheduledNotificationAsync(
        triggerToCancel.identifier,
      );
    }
  } catch (e) {}
};
