import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite"; // 1. Импортируем нативный контекст
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
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
  updateTaskIdInLocalDB,
  updateTaskSyncStatus,
} from "../hooks/db";
import { scheduleTaskNotification } from "../hooks/notifications";
import { Task, TaskAttachment, TaskStatus } from "../hooks/types";

const STATUSES: TaskStatus[] = ["New", "In Progress", "Completed", "Canceled"];

export default function TaskFormScreen() {
  const db = useSQLiteContext(); // 2. Инициализируем нативный инстанс БД
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
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

  const [isNetworkLoading, setIsNetworkLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (editId) {
        const loadTaskData = async () => {
          try {
            // Передаем db в метод чтения
            const allTasks = await getAllTasks(db);
            const currentTask = allTasks.find((t) => t.id === editId);

            if (currentTask) {
              setTitle(currentTask.title);
              setDescription(currentTask.description);
              setAddress(currentTask.location.address);
              setDueDate(new Date(currentTask.dueDate));
              setStatus(currentTask.status);
              setOriginalStatus(currentTask.status);
              setAttachments(currentTask.attachments);
              if (currentTask.location.latitude)
                setLat(String(currentTask.location.latitude));
              if (currentTask.location.longitude)
                setLon(String(currentTask.location.longitude));
            }
          } catch (e) {
            console.error("Ошибка предзагрузки задачи:", e);
          }
        };
        loadTaskData();
      }
    }, [editId, db]),
  );

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAddress("");
    setDueDate(new Date());
    setStatus("New");
    setAttachments([]);
    setErrors({});
    setLat("");
    setLon("");
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
      syncStatus: "Pending Sync",
    };

    try {
      setIsNetworkLoading(true);

      if (isEditMode) {
        // Режим Редактирования (передаем db)
        await updateTask(db, taskData);

        await insertLog(db, {
          id: Math.random().toString(),
          timestamp: new Date().toISOString(),
          actionType: "EDIT",
          description: `Локально отредактирована задача "${taskData.title}"`,
        });

        try {
          await syncUpdateTaskWithServer(taskData);
          await updateTaskSyncStatus(db, taskData.id, "Synced");
          await insertLog(db, {
            id: Math.random().toString(),
            timestamp: new Date().toISOString(),
            actionType: "SYNC",
            description: `Успешный PUT. Изменения задачи "${taskData.title}" синхронизированы.`,
          });
        } catch (netError) {
          await updateTaskSyncStatus(db, taskData.id, "Sync Failed");
        }
      } else {
        // Режим Создания (передаем db)
        await insertTask(db, taskData);

        await insertLog(db, {
          id: Math.random().toString(),
          timestamp: new Date().toISOString(),
          actionType: "CREATE",
          description: `Локально создана задача "${taskData.title}" (Временный ID: ${taskData.id})`,
        });

        try {
          const serverId = await syncInsertTaskWithServer(taskData);
          await updateTaskIdInLocalDB(db, taskData.id, serverId);
          await scheduleTaskNotification(
            serverId,
            taskData.title,
            taskData.dueDate,
            isDemoMode,
          );
          await updateTaskSyncStatus(db, serverId, "Synced");

          await insertLog(db, {
            id: Math.random().toString(),
            timestamp: new Date().toISOString(),
            actionType: "SYNC",
            description: `Успешный POST. Задача "${taskData.title}" переведена на серверный ID: ${serverId}`,
          });
        } catch (netError) {
          await updateTaskSyncStatus(db, taskData.id, "Sync Failed");
          await scheduleTaskNotification(
            taskData.id,
            taskData.title,
            taskData.dueDate,
            isDemoMode,
          );
          await insertLog(db, {
            id: Math.random().toString(),
            timestamp: new Date().toISOString(),
            actionType: "SYNC",
            description: `Сбой сети при создании задачи "${taskData.title}". ID остался временным.`,
          });
        }
      }

      Alert.alert("Успех", "Задача успешно сохранена!");
      setTimeout(() => {
        router.back();
      }, 150);
    } catch (error) {
      console.error(error);
      Alert.alert("Ошибка", "Критическая ошибка БД");
    } finally {
      setIsNetworkLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Оверлей загрузки перекрывает экран при синхронизации */}
      {isNetworkLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Синхронизация с сервером...</Text>
        </View>
      )}

      {/* Поле: Название */}
      <Text style={styles.label}>Название *</Text>
      <TextInput
        style={[styles.input, errors.title ? styles.inputError : null]}
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
          errors.description ? styles.inputError : null,
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

      {/* Поле: Адрес */}
      <Text style={styles.label}>Адрес местоположения *</Text>
      <TextInput
        style={[styles.input, errors.address ? styles.inputError : null]}
        value={address}
        onChangeText={setAddress}
        placeholder="Укажите адрес вручную"
      />
      {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}

      {/* Поля: Координаты */}
      <Text style={styles.label}>Координаты (необязательно)</Text>
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

      {/* Поле: Выбор даты дедлайна */}
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

      {/* Поле: Статус задачи */}
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

      {/* Поле: Демо-режим пушей */}
      <View style={styles.switchRow}>
        <Text style={[styles.label, { marginTop: 0 }]}>
          Тест пуша через 30 секунд (Демо)
        </Text>
        <Switch value={isDemoMode} onValueChange={setIsDemoMode} />
      </View>

      {/* Блок вложений */}
      <Text style={styles.label}>Вложения (Изображения / PDF)</Text>
      <View style={styles.attachButtonsRow}>
        <View style={styles.flexBtn}>
          <Button title="+ Фото" color="#4A90E2" onPress={pickImage} />
        </View>
        <View style={styles.flexBtn}>
          <Button title="+ PDF" color="#4A90E2" onPress={pickDocument} />
        </View>
      </View>

      {/* Вывод списка прикрепленных файлов с возможностью удаления по кнопке (крестик) */}
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

      {/* Финальная кнопка отправки формы */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSave}
        disabled={isNetworkLoading}
      >
        <Text style={styles.saveButtonText}>
          {isEditMode ? "Сохранить изменения" : "Создать задачу"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  contentContainer: { padding: 20, paddingBottom: 40 },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 4,
    color: "#444",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  inputError: { borderColor: "#ff4d4d" },
  textArea: { height: 80, textAlignVertical: "top" },
  errorText: { color: "#ff4d4d", fontSize: 13, marginTop: 2 },
  rowGap: { flexDirection: "row", gap: 10, marginTop: 4 },
  dateButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  dateButtonText: { fontSize: 16, color: "#333" },
  statusContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  attachButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  flexBtn: { flex: 1 },
  attachmentsList: {
    marginTop: 10,
    backgroundColor: "#eef2f7",
    padding: 8,
    borderRadius: 8,
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
  saveButton: {
    backgroundColor: "#3498db",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
    elevation: 2,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
});
