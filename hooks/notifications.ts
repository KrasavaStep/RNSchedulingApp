import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";

// Настройка отображения пушей на Android, когда приложение открыто
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Показывает всплывающий баннер на Android/iOS
    shouldShowList: true, // Отображает в шторке уведомлений
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Запрос разрешений на пуши (вызывается при старте)
 */
export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    Alert.alert(
      "Уведомления",
      "Разрешение на отправку пушей не получено. Вы можете пропустить сроки выполнения задач.",
    );
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
};

/**
 * Планирование уведомления для задачи
 */
export const scheduleTaskNotification = async (
  taskId: string,
  title: string,
  dueDateStr: string,
  isDemoMode: boolean = false,
) => {
  const dueDate = new Date(dueDateStr);
  const now = new Date();

  let triggerDate: Date;
  let bodyMessage = `До крайнего срока выполнения задачи "${title}" осталось 30 минут!`;

  if (isDemoMode) {
    // ДЕМО-РЕЖИМ для видеодемонстрации проверяющим: пуш через 30 секунд
    triggerDate = new Date(now.getTime() + 30 * 1000);
    bodyMessage = `[ДЕМО 30с] Срок задачи "${title}" подходит к концу!`;
  } else {
    // Стандартная логика по ТЗ: за 30 минут до дедлайна
    triggerDate = new Date(dueDate.getTime() - 30 * 60 * 1000);

    // Резервный вариант (fallback) по ТЗ: если до дедлайна уже меньше 30 минут
    if (triggerDate.getTime() <= now.getTime()) {
      if (dueDate.getTime() > now.getTime()) {
        // Запланировать через 10 секунд как напоминание "Вдогонку"
        triggerDate = new Date(now.getTime() + 10 * 1000);
        bodyMessage = `⚠️ [СРОЧНО] Менее 30 минут осталось до выполнения задачи "${title}"!`;
      } else {
        // Задача уже просрочена
        return null;
      }
    }
  }

  // Отменяем старое уведомление по ID, если оно было (для режима редактирования)
  await cancelTaskNotification(taskId);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "⏰ Напоминание о дедлайне",
      body: bodyMessage,
      data: { taskId },
      sound: true,
    },
    // Передаем дату внутри специального объекта, как требуют новые типы
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return notificationId;
};

export const cancelTaskNotification = async (taskId: string) => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const triggerToCancel = scheduled.find(
    (n) => n.content.data?.taskId === taskId,
  );
  if (triggerToCancel) {
    await Notifications.cancelScheduledNotificationAsync(
      triggerToCancel.identifier,
    );
  }
};
