import { Task, TaskStatus } from "./types";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://6aa515b61397053d42bb7203.mockapi.io/taskapi/v1/tasks";
const TIMEOUT_MS = 10000;

// Вспомогательный метод fetch с таймаутом и обработкой ошибок
const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Ошибка ${response.status}: ${errorText || response.statusText}`,
      );
    }

    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === "AbortError") {
      throw new Error("Превышено время ожидания ответа от сервера (Timeout)");
    }
    throw error;
  }
};

/**
 * Отправка новой задачи (POST)
 */
export const syncInsertTaskWithServer = async (task: Task): Promise<string> => {
  // Исключаем локальный id и служебный syncStatus из тела запроса
  const { id: _, syncStatus: __, ...payload } = task;

  const response = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const serverTask = await response.json();
  return String(serverTask.id);
};

/**
 * Полное обновление задачи (PUT)
 */
export const syncUpdateTaskWithServer = async (task: Task): Promise<void> => {
  const { syncStatus: _, ...payload } = task;

  await fetchWithTimeout(`${API_URL}/${task.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};

/**
 * Быстрое обновление статуса задачи (PATCH)
 */
export const syncStatusWithServer = async (
  taskId: string,
  newStatus: TaskStatus,
): Promise<void> => {
  // Использование PATCH вместо PUT сохраняет остальные поля объекта на сервере
  await fetchWithTimeout(`${API_URL}/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus }),
  });
};

/**
 * Удаление задачи (DELETE)
 */
export const syncDeleteWithServer = async (taskId: string): Promise<void> => {
  await fetchWithTimeout(`${API_URL}/${taskId}`, {
    method: "DELETE",
  });
};
