import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet, // Добавлено
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  syncInsertTaskWithServer,
  syncUpdateTaskWithServer,
} from "../hooks/api";
import {
  getAllTasks,
  insertLog,
  insertTask,
  updateTask,
  updateTaskSyncStatus,
} from "../hooks/db"; // Проверьте пути
import { scheduleTaskNotification } from "../hooks/notifications"; // Импорт сервиса пушей
import { Task, TaskAttachment, TaskStatus } from "../hooks/types";

const STATUSES: TaskStatus[] = ["New", "In Progress", "Completed", "Canceled"];

export default function TaskFormScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>(); // Получаем ID, если пришли редактировать
  const isEditMode = !!editId;

  // Состояния полей формы
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [status, setStatus] = useState<TaskStatus>("New");
  const [originalStatus, setOriginalStatus] = useState<TaskStatus>("New");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);

  // Контроль UI
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [isNetworkLoading, setIsNetworkLoading] = useState(false); // Для лоадера сохранения
  const [isDemoMode, setIsDemoMode] = useState(false); // Чекбокс демо-пуша
  const [lat, setLat] = useState(""); // Координаты вручную
  const [lon, setLon] = useState("");

  // Каждый раз при заходе на экран проверяем, не пришли ли мы редактировать
  useFocusEffect(
    useCallback(() => {
      if (editId) {
        const loadTaskData = async () => {
          try {
            const allTasks = await getAllTasks();
            const currentTask = allTasks.find((t) => t.id === editId);

            if (currentTask) {
              setTitle(currentTask.title);
              setDescription(currentTask.description);
              setAddress(currentTask.location.address);
              setDueDate(new Date(currentTask.dueDate));
              setStatus(currentTask.status);
              setOriginalStatus(currentTask.status);
              setAttachments(currentTask.attachments);
            }
          } catch (e) {
            console.error("Ошибка предзагрузки задачи:", e);
          }
        };
        loadTaskData();
      }
    }, [editId]),
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAddress("");
    setDueDate(new Date());
    setStatus("New");
    setAttachments([]);
    setErrors({});
    // Важно: очищаем параметры роута, чтобы выйти из режима редактирования при следующем заходе
    router.setParams({ editId: undefined });
  };

  const handlePickerValueChange = (event: any, selectedDate?: Date) => {
    if (!selectedDate) {
      setPickerMode(null);
      return;
    }
    const updatedDate = new Date(dueDate);

    if (pickerMode === "date") {
      updatedDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
      setDueDate(updatedDate);
      setPickerMode("time");
    } else if (pickerMode === "time") {
      updatedDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setDueDate(updatedDate);
      setPickerMode(null);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setAttachments([
        ...attachments,
        {
          id: Math.random().toString(),
          uri: asset.uri,
          name: asset.fileName || `img_${Date.now()}.jpg`,
          type: "image",
        },
      ]);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setAttachments([
        ...attachments,
        {
          id: Math.random().toString(),
          uri: asset.uri,
          name: asset.name,
          type: "pdf",
        },
      ]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    const currentErrors: { [key: string]: string } = {};
    if (!title.trim()) currentErrors.title = "Название задачи обязательно";
    if (!description.trim())
      currentErrors.description = "Описание задачи обязательно";
    if (!address.trim())
      currentErrors.address = "Адрес местоположения обязателен";

    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      return;
    }

    const taskData: Task = {
      id:
        isEditMode && editId ? editId : Math.random().toString(36).substring(7),
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate.toISOString(),
      createdAt: new Date().toISOString(),
      location: {
        address: address.trim(),
        latitude: lat ? parseFloat(lat) : undefined,
        longitude: lon ? parseFloat(lon) : undefined,
      },
      attachments,
      status,
      syncStatus: "Pending Sync", // По умолчанию ставим статус ожидания
    };

    try {
      // 1. Блокируем UI, показываем ActivityIndicator по ТЗ
      setIsNetworkLoading(true);

      // 2. Сохраняем локально в SQLite (работает мгновенно в оффлайне)
      if (isEditMode) {
        await updateTask(taskData, originalStatus);
      } else {
        await insertTask(taskData);
      }

      await insertLog({
        id: Math.random().toString(),
        timestamp: new Date().toISOString(),
        actionType: isEditMode ? "EDIT" : "CREATE",
        description: `Пользователь ${isEditMode ? "отредактировал" : "создал"} задачу "${taskData.title}"`,
      });

      // 3. Планируем нативный push-уведомление
      await scheduleTaskNotification(
        taskData.id,
        taskData.title,
        taskData.dueDate,
        isDemoMode,
      );

      // 4. Пробуем отправить по сети на MockAPI
      try {
        if (isEditMode) {
          await syncUpdateTaskWithServer(taskData);
        } else {
          await syncInsertTaskWithServer(taskData);
        }
        // Если сеть успешна — обновляем статус на Synced
        await updateTaskSyncStatus(taskData.id, "Synced");
        await insertLog({
          id: Math.random().toString(),
          timestamp: new Date().toISOString(),
          actionType: "SYNC",
          description: `Успешная синхронизация задачи "${taskData.title}" с MockAPI`,
        });
      } catch (netError) {
        // Оффлайн режим по ТЗ: если сеть упала, статус остается 'Pending Sync', приложение не падает
        await updateTaskSyncStatus(taskData.id, "Sync Failed");
        await insertLog({
          id: Math.random().toString(),
          timestamp: new Date().toISOString(),
          actionType: "SYNC",
          description: `Сбой сети при отправке "${taskData.title}". Переведено в режим ожидания.`,
        });
      }

      Alert.alert("Успех", "Задача сохранена!");
      router.back();
    } catch (error) {
      Alert.alert("Ошибка", "Критическая ошибка БД");
    } finally {
      setIsNetworkLoading(false); // Выключаем лоадер
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Если идет отправка на сервер — перекрываем экран лоадером по ТЗ */}
      {isNetworkLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Синхронизация с сервером...</Text>
        </View>
      )}

      <Text style={styles.header}>
        {isEditMode ? "Редактирование задачи" : "Создание задачи"}
      </Text>

      {/* Поле: Название */}
      <Text style={styles.label}>Название *</Text>
      <TextInput
        style={[styles.input, errors.title && styles.inputError]}
        value={title}
        onChangeText={setTitle}
        placeholder="Введите название"
      />
      {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

      {/* Поле: Описание */}
      <Text style={styles.label}>Описание *</Text>
      <TextInput
        style={[
          styles.input,
          styles.textArea,
          errors.description && styles.inputError,
        ]}
        value={description}
        onChangeText={setDescription}
        placeholder="Введите описание"
        multiline
        numberOfLines={4}
      />
      {errors.description && (
        <Text style={styles.errorText}>{errors.description}</Text>
      )}

      {/* Поле: Местоположение */}
      <Text style={styles.label}>Адрес *</Text>
      <TextInput
        style={[styles.input, errors.address && styles.inputError]}
        value={address}
        onChangeText={setAddress}
        placeholder="Укажите адрес вручную"
      />
      {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}

      {/* ТЗ: Ввод координат вручную (преимущество к ТЗ) */}
      <Text style={styles.label}>Координаты места (необязательно)</Text>
      <View style={styles.rowGap}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Широта (Lat)"
          value={lat}
          onChangeText={setLat}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Долгота (Lon)"
          value={lon}
          onChangeText={setLon}
          keyboardType="numeric"
        />
      </View>

      {/* Поле: Срок выполнения */}
      <Text style={styles.label}>Срок выполнения *</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setPickerMode("date")}
      >
        <Text style={styles.dateButtonText}>{dueDate.toLocaleString()}</Text>
      </TouchableOpacity>

      {pickerMode !== null && (
        <DateTimePicker
          value={dueDate}
          mode={pickerMode}
          display="default"
          is24Hour={true}
          onValueChange={handlePickerValueChange}
          onDismiss={() => setPickerMode(null)}
        />
      )}

      {/* Выбор Статуса — Показываем селектор всегда, но для новой задачи по умолчанию 'New' */}
      <Text style={styles.label}>Статус задачи</Text>
      <View style={styles.statusContainer}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.statusButton,
              status === s ? styles.statusButtonActive : null,
            ]}
            onPress={() => setStatus(s)}
          >
            <Text
              style={[
                styles.statusButtonText,
                status === s ? styles.statusButtonTextActive : null,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Тест пуша через 30 секунд (Демо)</Text>
        <Switch value={isDemoMode} onValueChange={setIsDemoMode} />
      </View>

      {/* Вложения */}
      <Text style={styles.label}>Вложения (Изображения / PDF)</Text>
      <View style={styles.attachButtonsRow}>
        <View style={styles.flexBtn}>
          <Button title="+ Фото" color="#4A90E2" onPress={pickImage} />
        </View>
        <View style={styles.flexBtn}>
          <Button title="+ PDF" color="#4A90E2" onPress={pickDocument} />
        </View>
      </View>

      {attachments.length > 0 && (
        <View style={styles.attachmentsList}>
          {attachments.map((item) => (
            <View key={item.id} style={styles.attachmentRowItem}>
              <Text style={{ flex: 1 }} numberOfLines={1}>
                📎 {item.name}
              </Text>
              <TouchableOpacity onPress={() => removeAttachment(item.id)}>
                <Text
                  style={{
                    color: "#e74c3c",
                    fontWeight: "bold",
                    paddingHorizontal: 10,
                  }}
                >
                  ❌
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Кнопка Сохранить/Обновить */}
      <TouchableOpacity
        style={[styles.saveButton, isEditMode && styles.updateButton]}
        onPress={handleSave}
        disabled={isNetworkLoading}
      >
        <Text style={styles.saveButtonText}>
          {isEditMode ? "Сохранить изменения" : "Создать задачу"}
        </Text>
      </TouchableOpacity>

      {isEditMode && (
        <TouchableOpacity style={styles.cancelEditButton} onPress={resetForm}>
          <Text style={styles.cancelEditButtonText}>
            Отменить редактирование
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  contentContainer: { padding: 20, paddingTop: 40 },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 15,
    marginBottom: 5,
    color: "#444",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: { borderColor: "#ff4d4d" },
  textArea: { height: 100, textAlignVertical: "top" },
  errorText: { color: "#ff4d4d", fontSize: 14, marginTop: 4 },
  dateButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
  },
  dateButtonText: { fontSize: 16, color: "#333" },
  statusContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 5,
  },
  statusButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  statusButtonActive: { backgroundColor: "#2ecc71", borderColor: "#2ecc71" },
  statusButtonText: { color: "#555", fontSize: 13, fontWeight: "600" },
  statusButtonTextActive: { color: "#fff" },
  attachButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 5,
  },
  flexBtn: { flex: 1 },
  attachmentsList: {
    marginTop: 10,
    backgroundColor: "#eef2f7",
    padding: 10,
    borderRadius: 8,
  },
  attachmentItem: { fontSize: 14, color: "#555", marginVertical: 2 },
  saveButton: {
    backgroundColor: "#2ecc71",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 30,
    elevation: 2,
  },
  updateButton: { backgroundColor: "#3498db" },
  saveButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  cancelEditButton: { padding: 15, alignItems: "center", marginTop: 10 },
  cancelEditButtonText: { color: "#e74c3c", fontSize: 16, fontWeight: "600" },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
  rowGap: { flexDirection: "row", gap: 10, marginTop: 5 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
  },
  attachmentRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: "#eee",
  },
});
