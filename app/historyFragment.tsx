import { useDatabase } from "@nozbe/watermelondb/react";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAllLogs } from "../hooks/db/dbService";
import { AppLog } from "../hooks/types";

export default function HistoryScreen() {
  const database = useDatabase(); // 1. Получаем экземпляр WatermelonDB из контекста
  const [logs, setLogs] = useState<AppLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      // 2. Вызываем переписанный метод getAllLogs, передавая экземпляр WatermelonDB
      const data = await getAllLogs(database);
      setLogs(data);
    } catch (error) {
      console.error("Ошибка при чтении логов:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [database]),
  );

  const getActionBadgeColor = (type: string) => {
    switch (type) {
      case "CREATE":
        return "#2ecc71";
      case "EDIT":
        return "#3498db";
      case "STATUS_CHANGE":
        return "#f1c40f";
      case "DELETE":
        return "#e74c3c";
      case "SYNC":
        return "#9b59b6";
      default:
        return "#7f8c8d";
    }
  };

  const renderLogItem = ({ item }: { item: AppLog }) => {
    const formattedTime = new Date(item.timestamp).toLocaleString();

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <View
            style={[
              styles.badge,
              { backgroundColor: getActionBadgeColor(item.actionType) },
            ]}
          >
            <Text style={styles.badgeText}>{item.actionType}</Text>
          </View>
          <Text style={styles.logTime}>⏱️ {formattedTime}</Text>
        </View>
        <Text style={styles.logDescription}>{item.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {logs.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Журнал событий пока пуст. Совершите любое действие в приложении!
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderLogItem}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={loadLogs}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  listContent: { padding: 16 },
  logCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#ddd",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  logTime: { fontSize: 12, color: "#95a5a6" },
  logDescription: { fontSize: 14, color: "#34495e", lineHeight: 20 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyText: { fontSize: 15, color: "#95a5a6", textAlign: "center" },
});
