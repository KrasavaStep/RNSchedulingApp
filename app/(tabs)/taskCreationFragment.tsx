import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getAllTasks, insertTask } from "../../hooks/db";
import { Task, TaskAttachment, TaskStatus } from "../../hooks/types";

export default function CreateTaskScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [status, setStatus] = useState<TaskStatus>("New");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);

  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handlePickerValueChange = (event: any, selectedDate?: Date) => {
    if (!selectedDate) {
      setPickerMode(null);
      return;
    }

    if (pickerMode === "date") {
      const updatedDate = new Date(dueDate);
      updatedDate.setFullYear(selectedDate.getFullYear());
      updatedDate.setMonth(selectedDate.getMonth());
      updatedDate.setDate(selectedDate.getDate());
      setDueDate(updatedDate);

      setPickerMode("time");
    } else if (pickerMode === "time") {
      const updatedDate = new Date(dueDate);
      updatedDate.setHours(selectedDate.getHours());
      updatedDate.setMinutes(selectedDate.getMinutes());
      setDueDate(updatedDate);

      setPickerMode(null);
    }
  };

  const handlePickerDismiss = () => {
    setPickerMode(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const newAttachment: TaskAttachment = {
        id: Math.random().toString(),
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: "image",
      };
      setAttachments([...attachments, newAttachment]);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const newAttachment: TaskAttachment = {
        id: Math.random().toString(),
        uri: asset.uri,
        name: asset.name,
        type: "pdf",
      };
      setAttachments([...attachments, newAttachment]);
    }
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

    setErrors({});

    // Формируем объект
    const newTask: Task = {
      id: Math.random().toString(36).substring(7),
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate.toISOString(),
      location: { address: address.trim() },
      attachments,
      status,
    };

    try {
      await insertTask(newTask);

      Alert.alert("Успех", `Задача успешно сохранена в базу данных!`);
      const savedTasks = await getAllTasks();
      console.log("--- ВСЕ ЗАДАЧИ В БД НА ДАННЫЙ МОМЕНТ: ---", savedTasks);

      setTitle("");
      setDescription("");
      setAddress("");
      setDueDate(new Date());
      setAttachments([]);
      setStatus("New");
    } catch (error) {
      console.error("Ошибка сохранения задачи:", error);
      Alert.alert(
        "Ошибка",
        "Не удалось сохранить задачу в локальное хранилище.",
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.header}>Создание задачи</Text>

      {/* Поле: Название */}
      <Text style={styles.label}>Название *</Text>
      <TextInput
        style={[styles.input, errors.title ? styles.inputError : null]}
        value={title}
        onChangeText={setTitle}
        placeholder="Введите название задачи"
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
        placeholder="Введите описание задачи"
        multiline
        numberOfLines={4}
      />
      {errors.description && (
        <Text style={styles.errorText}>{errors.description}</Text>
      )}

      {/* Поле: Местоположение */}
      <Text style={styles.label}>Адрес *</Text>
      <TextInput
        style={[styles.input, errors.address ? styles.inputError : null]}
        value={address}
        onChangeText={setAddress}
        placeholder="Укажите адрес вручную"
      />
      {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}

      {/* Поле: Срок выполнения */}
      <Text style={styles.label}>Срок выполнения *</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setPickerMode("date")} // Начинаем с выбора даты
      >
        <Text style={styles.dateButtonText}>{dueDate.toLocaleString()}</Text>
      </TouchableOpacity>

      {/* Рендерим пикер, только если задан режим 'date' или 'time' */}
      {pickerMode !== null && (
        <DateTimePicker
          value={dueDate}
          mode={pickerMode}
          display="default"
          is24Hour={true}
          onValueChange={handlePickerValueChange}
          onDismiss={handlePickerDismiss}
        />
      )}

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
            <Text key={item.id} style={styles.attachmentItem} numberOfLines={1}>
              📎 {item.type.toUpperCase()}: {item.name}
            </Text>
          ))}
        </View>
      )}

      {/* Кнопка Сохранить */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Создать задачу</Text>
      </TouchableOpacity>
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
  saveButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
