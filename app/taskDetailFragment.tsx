import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as SQLite from "expo-sqlite"; // Импортируем expo-sqlite
import { useCallback, useState } from "react";
import {
  Alert,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { syncDeleteWithServer, syncStatusWithServer } from "../hooks/api";
import {
  deleteTask,
  getAllTasks,
  getTaskHistory,
  HistoryLog,
  insertLog,
  updateTaskStatus,
} from "../hooks/db";
import { Task, TaskStatus } from "../hooks/types";

export default function TaskDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Получаем доступ к контексту базы данных SQLite
  const db = SQLite.useSQLiteContext();

  const [task, setTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<HistoryLog[]>([]);

  const loadTaskData = async () => {
    if (!id) return;
    try {
      // Передаем экземпляр db в функции базы данных
      const allTasks = await getAllTasks(db);
      const foundTask = allTasks.find((t) => t.id === id);

      if (foundTask) {
        setTask(foundTask);
        const histData = await getTaskHistory(db, id);
        setHistory(histData);
      } else {
        Alert.alert("Ошибка", "Задача не найдена");
        router.back();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTaskData();
    }, [id]),
  );

  const handleChangeStatus = async (newStatus: TaskStatus) => {
    if (!task) return;
    try {
      // 1. Сначала пишем локально в SQLite и лог истории, передавая db
      await updateTaskStatus(db, task.id, newStatus);

      // 2. Сразу отправляем по сети на json-server
      await syncStatusWithServer(task.id, newStatus);

      loadTaskData(); // Перезагружаем экран, чтобы обновить UI
    } catch (e) {
      // Если упала только сеть — локально данные уже сохранены, уведомляем
      console.error(e);
      Alert.alert(
        "Офлайн-режим",
        "Статус изменен локально, но не синхронизирован с сервером.",
      );
      loadTaskData(); // Всё равно обновляем UI из SQLite
    }
  };

  const handleDelete = () => {
    Alert.alert("Удаление", "Вы уверены, что хотите удалить эту задачу?", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          if (task) {
            try {
              // 1. Удаляем локально из SQLite и логируем изменения через db
              await deleteTask(db, task.id);
              await insertLog(db, {
                id: Math.random().toString(),
                timestamp: new Date().toISOString(),
                actionType: "DELETE",
                description: `Удалена задача с ID: ${task.id}`,
              });

              // 2. Удаляем с удаленного сервера
              await syncDeleteWithServer(task.id);
              router.back();
            } catch (e) {
              console.error(e);
              // Если сервер недоступен, локально мы её уже удалили, поэтому просто уходим назад
              router.back();
            }
          }
        },
      },
    ]);
  };

  if (!task)
    return (
      <View style={styles.centered}>
        <Text>Загрузка...</Text>
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Заголовок и Статус */}
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.statusText}>Статус: {task.status}</Text>
        </View>

        {/* Описание */}
        <Text style={styles.sectionTitle}>Описание</Text>
        <Text style={styles.description}>{task.description}</Text>

        {/* Срок и Локация */}
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>
            📅 Срок: {new Date(task.dueDate).toLocaleString()}
          </Text>
          <Text style={styles.infoText}>
            📍 Местоположение: {task.location.address}
          </Text>
        </View>

        {/* Вложения */}
        <Text style={styles.sectionTitle}>Вложения</Text>
        {task.attachments.length === 0 ? (
          <Text style={styles.emptyText}>Нет прикрепленных файлов</Text>
        ) : (
          <View style={styles.attachmentsContainer}>
            {task.attachments.map((file) => (
              <View key={file.id} style={styles.fileCard}>
                {file.type === "image" ? (
                  <Image
                    source={{ uri: file.uri }}
                    style={styles.imagePreview}
                    defaultSource={require("../assets/images/icon.png")}
                  />
                ) : (
                  <Text style={styles.pdfIcon}>📄 PDF</Text>
                )}
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Изменение Статуса */}
        <Text style={styles.sectionTitle}>Управление статусом</Text>
        <View style={styles.statusButtonsRow}>
          {(["In Progress", "Completed", "Canceled"] as TaskStatus[]).map(
            (st) => (
              <TouchableOpacity
                key={st}
                style={[
                  styles.actionStatusBtn,
                  task.status === st && styles.disabledBtn,
                ]}
                disabled={task.status === st}
                onPress={() => handleChangeStatus(st)}
              >
                <Text style={styles.actionStatusBtnText}>{st}</Text>
              </TouchableOpacity>
            ),
          )}
        </View>

        {/* История изменений */}
        <Text style={styles.sectionTitle}>История изменений статуса</Text>
        <View style={styles.historyBlock}>
          {history.map((log) => (
            <Text key={log.id} style={styles.historyItem}>
              ⏱️ {new Date(log.changedAt).toLocaleTimeString()} — Смена статуса
              на [{log.status}]
            </Text>
          ))}
        </View>

        {/* Опции редактирования / удаления */}
        <View style={styles.footerActions}>
          <Button
            title="Редактировать полностью"
            onPress={() =>
              router.push({
                pathname: "/taskCreationFragment",
                params: { editId: task.id },
              })
            }
          />
          <View style={{ marginTop: 10 }}>
            <Button
              title="Удалить задачу"
              color="#e74c3c"
              onPress={handleDelete}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 20 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    marginRight: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#3498db",
    backgroundColor: "#e1f5fe",
    padding: 6,
    borderRadius: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 8,
    color: "#555",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingTop: 5,
  },
  description: { fontSize: 15, color: "#444", lineHeight: 22 },
  infoBlock: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  infoText: { fontSize: 14, color: "#666" },
  attachmentsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 5,
  },
  fileCard: {
    width: "47%",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  imagePreview: {
    width: "100%",
    height: 100,
    borderRadius: 6,
    marginBottom: 5,
  },
  pdfIcon: { fontSize: 14 },
  fileName: { fontSize: 12, marginTop: 4, width: "100%", textAlign: "center" },
  emptyText: { fontSize: 14, color: "#999", fontStyle: "italic" },
  statusButtonsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionStatusBtn: {
    backgroundColor: "#34495e",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  disabledBtn: { backgroundColor: "#bdc3c7" },
  actionStatusBtnText: { color: "#fff", fontWeight: "600" },
  historyBlock: { backgroundColor: "#fdfefe", marginTop: 5 },
  historyItem: { fontSize: 13, color: "#7f8c8d", marginVertical: 2 },
  footerActions: { marginTop: 30 },
});
