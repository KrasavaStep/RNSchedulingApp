import { Task, TaskStatus } from "./types";

// IP-адрес хоста ПК для Android-эмулятора
const API_URL = "https://6aa515b61397053d42bb7203.mockapi.io/taskapi/v1/tasks";

/**
 * Отправка новой задачи на удаленный сервер (POST)
 */
export const syncInsertTaskWithServer = async (task: Task): Promise<void> => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });

    if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
    console.log(
      "⚡ Задача успешно синхронизирована с ОБЛАЧНЫМ сервером (POST)",
    );
  } catch (error) {
    console.error("❌ Не удалось отправить задачу на сервер:", error);
    throw error;
  }
};

/**
 * Обновление задачи на удаленном сервере (PUT)
 */
export const syncUpdateTaskWithServer = async (task: Task): Promise<void> => {
  try {
    // В MockAPI / Supabase стандартный REST-путь для обновления конкретной записи: URL/id
    const response = await fetch(`${API_URL}/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });

    if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
    console.log(
      "⚡ Изменения успешно синхронизированы с ОБЛАЧНЫМ сервером (PUT)",
    );
  } catch (error) {
    console.error("❌ Не удалось обновить задачу на сервере:", error);
    throw error;
  }
};

/**
 * Быстрое обновление статуса задачи на сервере (PATCH)
 */
export const syncStatusWithServer = async (
  taskId: string,
  newStatus: TaskStatus,
): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/${taskId}`, {
      method: "PUT", // Внимание: MockAPI иногда лучше переваривает полный PUT для обновления части данных, либо PATCH, если он разрешен в настройках ресурса. Попробуйте PUT.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
    console.log(`⚡ Статус задачи успешно обновлен в облаке`);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

/**
 * Удаление задачи с сервера (DELETE)
 */
export const syncDeleteWithServer = async (taskId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/${taskId}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
    console.log(`⚡ Задача успешно удалена из облака (DELETE)`);
  } catch (error) {
    console.error(error);
    throw error;
  }
};
