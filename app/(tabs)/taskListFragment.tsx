import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAllTasks } from "../../hooks/db";
import { Task } from "../../hooks/types";

type SortOption = "createdAt" | "dueDate" | "status";

export default function TasksListScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<(Task & { createdAt: string })[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("createdAt");
  const [isLoading, setIsLoading] = useState(true);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const data = await getAllTasks();
      setTasks(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, []),
  );

  // Функция сортировки на стороне клиента (JS/TS)
  const getSortedTasks = () => {
    return [...tasks].sort((a, b) => {
      if (sortBy === "createdAt") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ); // Сначала новые
      }
      if (sortBy === "dueDate") {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); // Сначала срочные
      }
      if (sortBy === "status") {
        return a.status.localeCompare(b.status); // Сгруппировать по алфавиту статуса
      }
      return 0;
    });
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Список задач</Text>

      {/* Панель сортировки */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Сортировка:</Text>
        {(["createdAt", "dueDate", "status"] as SortOption[]).map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.sortButton,
              sortBy === option && styles.sortButtonActive,
            ]}
            onPress={() => setSortBy(option)}
          >
            <Text
              style={[
                styles.sortButtonText,
                sortBy === option && styles.sortButtonTextActive,
              ]}
            >
              {option === "createdAt"
                ? "Создан"
                : option === "dueDate"
                  ? "Срок"
                  : "Статус"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {getSortedTasks().length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Задач нет. Создайте первую на соседней вкладке!
          </Text>
        </View>
      ) : (
        <FlatList
          data={getSortedTasks()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.taskCard}
              onPress={() => {
                router.push({
                  pathname: "/taskDetailFragment",
                  params: { id: item.id },
                });
              }}
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
                <Text style={styles.footerText}>
                  📅 Срок: {new Date(item.dueDate).toLocaleString()}
                </Text>
                <Text style={styles.footerText} numberOfLines={1}>
                  📍 {item.location.address}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          refreshing={isLoading}
          onRefresh={loadTasks}
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
    marginTop: 15,
    textAlign: "center",
    color: "#333",
  },
  sortContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginVertical: 10,
    gap: 6,
  },
  sortLabel: { fontSize: 13, color: "#666", fontWeight: "600" },
  sortButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#e0e0e0",
  },
  sortButtonActive: { backgroundColor: "#3498db" },
  sortButtonText: { fontSize: 12, color: "#555", fontWeight: "bold" },
  sortButtonTextActive: { color: "#fff" },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    marginRight: 10,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  taskDescription: { fontSize: 14, color: "#666", marginBottom: 10 },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
    gap: 2,
  },
  footerText: { fontSize: 12, color: "#888" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: { fontSize: 15, color: "#999", textAlign: "center" },
});
