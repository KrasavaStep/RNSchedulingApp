import { Task, TaskStatus } from "./types";

// IP-адрес хоста ПК для Android-эмулятора
const API_URL = "http://10.0.2.2";

/**
 * Отправка новой задачи на удаленный сервер (POST)
 */
export const syncInsertTaskWithServer = async (task: Task): Promise<void> => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }
    console.log("⚡ Задача успешно синхронизирована с сервером (POST)");
  } catch (error) {
    console.error("❌ Не удалось отправить задачу на сервер:", error);
    // По ТЗ мы можем просто логировать ошибку или обрабатывать оффлайн-режим
    throw error;
  }
};

/**
 * Обновление задачи на удаленном сервере (PUT)
 */
export const syncUpdateTaskWithServer = async (task: Task): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/${task.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }
    console.log(
      "⚡ Изменения задачи успешно синхронизированы с сервером (PUT)",
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
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: newStatus }), // Меняем только поле status
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }
    console.log(
      `⚡ Статус задачи ${taskId} синхронизирован с сервером (PATCH: ${newStatus})`,
    );
  } catch (error) {
    console.error("❌ Не удалось обновить статус на сервере:", error);
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

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }
    console.log(`⚡ Задача ${taskId} успешно удалена с сервера (DELETE)`);
  } catch (error) {
    console.error("❌ Не удалось удалить задачу с сервера:", error);
    throw error;
  }
};
