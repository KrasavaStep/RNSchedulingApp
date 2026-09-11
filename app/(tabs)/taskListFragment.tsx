import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getAllTasks } from "../../hooks/db";
import { Task } from "../../hooks/types";

export default function TasksListScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Аналог onResume() в Android
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const fetchTasks = async () => {
        try {
          setIsLoading(true);
          const data = await getAllTasks();
          if (isMounted) {
            setTasks(data);
          }
        } catch (error) {
          console.error("Ошибка при загрузке задач из SQLite:", error);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      };

      fetchTasks();

      return () => {
        isMounted = false;
      };
    }, []),
  );

  // Функция для отрисовки хелперов статуса (цветовые маркеры)
  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "#4A90E2";
      case "In Progress":
        return "#F5A623";
      case "Completed":
        return "#2ECC71";
      case "Canceled":
        return "#95A5A6";
      default:
        return "#333";
    }
  };

  //Аналог ViewHolder в RecyclerView
  const renderTaskItem = ({ item }: { item: Task }) => {
    const formattedDate = new Date(item.dueDate).toLocaleString();

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => console.log("Нажата задача:", item.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.taskTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.taskDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>📅 {formattedDate}</Text>
          <Text style={styles.footerText} numberOfLines={1}>
            📍 {item.location.address}
          </Text>
        </View>

        {item.attachments.length > 0 && (
          <Text style={styles.attachmentsCount}>
            📎 Вложений: {item.attachments.length}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Список задач</Text>

      {tasks.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Задач пока нет. Создайте первую на соседней вкладке!
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTaskItem}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={async () => {
            const data = await getAllTasks();
            setTasks(data);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginVertical: 20,
    textAlign: "center",
    color: "#333",
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    marginRight: 10,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  taskDescription: { fontSize: 14, color: "#666", marginBottom: 12 },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
    flexDirection: "column",
    gap: 4,
  },
  footerText: { fontSize: 13, color: "#888" },
  attachmentsCount: {
    fontSize: 12,
    color: "#4A90E2",
    marginTop: 6,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    lineHeight: 22,
  },
});
