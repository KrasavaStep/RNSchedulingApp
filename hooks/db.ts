import * as SQLite from "expo-sqlite";
import { AppLog, LogActionType, Task, TaskStatus } from "./types";

export interface HistoryLog {
  id: string;
  status: TaskStatus;
  changedAt: string;
}

// 1. Синглтон подключения
let dbInstance: SQLite.SQLiteDatabase | null = null;

const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("rnscheduling.db");
  }
  return dbInstance;
};

// 2. Механизм Mutex для предотвращения конкурентного доступа (NPE) на Android
let dbMutexPromise = Promise.resolve();

const runWithMutex = <T>(operation: () => Promise<T>): Promise<T> => {
  // Ставим операцию в очередь за предыдущей
  const nextPromise = dbMutexPromise.then(async () => {
    return await operation();
  });
  // Обновляем глобальный указатель на последний промис в очереди
  dbMutexPromise = nextPromise.then(
    () => {},
    () => {}, // Игнорируем ошибки, чтобы очередь не блокировалась навсегда
  );
  return nextPromise;
};

/**
 * Инициализация таблиц при старте приложения
 */
export const initDatabase = async () => {
  return runWithMutex(async () => {
    const db = await getDB();
    await db.execAsync("PRAGMA foreign_keys = ON;");

    await db.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        uri TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS status_history (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        changedAt TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_logs (
        id TEXT PRIMARY KEY NOT NULL,
        timestamp TEXT NOT NULL,
        actionType TEXT NOT NULL,
        description TEXT NOT NULL
      );
    `);

    console.log("--- БАЗА ДАННЫХ И ТАБЛИЦЫ УСПЕШНО ИНИЦИАЛИЗИРОВАНЫ ---");
  });
};

/**
 * Сохранение новой задачи
 */
export const insertTask = async (task: Task): Promise<void> => {
  return runWithMutex(async () => {
    const db = await getDB();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO tasks (id, title, description, dueDate, address, latitude, longitude, status, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          task.id,
          task.title,
          task.description,
          task.dueDate,
          task.location.address,
          null,
          null,
          task.status,
          now,
        ],
      );

      await db.runAsync(
        `INSERT INTO status_history (id, task_id, status, changedAt) VALUES (?, ?, ?, ?);`,
        [Math.random().toString(36).substring(7), task.id, task.status, now],
      );

      for (const attach of task.attachments) {
        await db.runAsync(
          `INSERT INTO attachments (id, task_id, uri, name, type) VALUES (?, ?, ?, ?, ?);`,
          [attach.id, task.id, attach.uri, attach.name, attach.type],
        );
      }
    });
  });
};

/**
 * Обновление существующей задачи
 */
export const updateTask = async (
  task: Task,
  oldStatus: TaskStatus,
): Promise<void> => {
  return runWithMutex(async () => {
    const db = await getDB();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE tasks SET title = ?, description = ?, dueDate = ?, address = ?, status = ? WHERE id = ?;`,
        [
          task.title,
          task.description,
          task.dueDate,
          task.location.address,
          task.status,
          task.id,
        ],
      );

      if (task.status !== oldStatus) {
        await db.runAsync(
          `INSERT INTO status_history (id, task_id, status, changedAt) VALUES (?, ?, ?, ?);`,
          [Math.random().toString(36).substring(7), task.id, task.status, now],
        );
      }

      await db.runAsync("DELETE FROM attachments WHERE task_id = ?;", [
        task.id,
      ]);
      for (const attach of task.attachments) {
        await db.runAsync(
          `INSERT INTO attachments (id, task_id, uri, name, type) VALUES (?, ?, ?, ?, ?);`,
          [attach.id, task.id, attach.uri, attach.name, attach.type],
        );
      }
    });
  });
};

/**
 * Быстрое обновление статуса (из экрана деталей)
 */
export const updateTaskStatus = async (
  taskId: string,
  newStatus: TaskStatus,
): Promise<void> => {
  return runWithMutex(async () => {
    const db = await getDB();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`UPDATE tasks SET status = ? WHERE id = ?;`, [
        newStatus,
        taskId,
      ]);
      await db.runAsync(
        `INSERT INTO status_history (id, task_id, status, changedAt) VALUES (?, ?, ?, ?);`,
        [Math.random().toString(36).substring(7), taskId, newStatus, now],
      );
    });
  });
};

/**
 * Каскадное удаление
 */
export const deleteTask = async (taskId: string): Promise<void> => {
  return runWithMutex(async () => {
    const db = await getDB();
    await db.runAsync("DELETE FROM tasks WHERE id = ?;", [taskId]);
  });
};

/**
 * Получение истории логов для задачи
 */
export const getTaskHistory = async (taskId: string): Promise<HistoryLog[]> => {
  return runWithMutex(async () => {
    const db = await getDB();
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM status_history WHERE task_id = ? ORDER BY changedAt DESC;",
      [taskId],
    );
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      changedAt: r.changedAt,
    }));
  });
};

/**
 * Чтение всех задач из БД (Обернуто в runWithMutex)
 */
export const getAllTasks = async (): Promise<
  (Task & { createdAt: string })[]
> => {
  return runWithMutex(async () => {
    const db = await getDB();
    const tasksRows = await db.getAllAsync<any>(
      "SELECT * FROM tasks ORDER BY createdAt DESC;",
    );
    const tasks: any[] = [];

    for (const row of tasksRows) {
      const attachRows = await db.getAllAsync<any>(
        "SELECT * FROM attachments WHERE task_id = ?;",
        [row.id],
      );
      const attachments = attachRows.map((att) => ({
        id: att.id,
        uri: att.uri,
        name: att.name,
        type: att.type,
      }));

      tasks.push({
        id: row.id,
        title: row.title,
        description: row.description,
        dueDate: row.dueDate,
        createdAt: row.createdAt,
        location: { address: row.address },
        attachments,
        status: row.status,
      });
    }
    return tasks;
  });
};

/**
 * Запись нового события в глобальный журнал истории (ТЗ)
 */
export const insertLog = async (log: AppLog): Promise<void> => {
  return runWithMutex(async () => {
    const db = await SQLite.openDatabaseAsync("rnscheduling.db");
    await db.runAsync(
      `INSERT INTO app_logs (id, timestamp, actionType, description) 
       VALUES (?, ?, ?, ?);`,
      [
        log.id || Math.random().toString(36).substring(7),
        log.timestamp || new Date().toISOString(),
        log.actionType,
        log.description,
      ],
    );
    console.log(
      `[Журнал] Зафиксировано действие: ${log.actionType} - ${log.description}`,
    );
  });
};

/**
 * Чтение всех логов из журнала истории (ТЗ)
 */
export const getAllLogs = async (): Promise<AppLog[]> => {
  return runWithMutex(async () => {
    const db = await SQLite.openDatabaseAsync("rnscheduling.db");
    // Сортируем ORDER BY timestamp DESC, чтобы новые события проверяющий видел вверху списка
    const rows = await db.getAllAsync<any>(
      "SELECT * FROM app_logs ORDER BY timestamp DESC;",
    );

    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      actionType: r.actionType as LogActionType,
      description: r.description,
    }));
  });
};

/**
 * Обновление статуса синхронизации задачи с сервером
 */
export const updateTaskSyncStatus = async (
  taskId: string,
  newSyncStatus: "Synced" | "Pending Sync" | "Sync Failed",
): Promise<void> => {
  return runWithMutex(async () => {
    const db = await SQLite.openDatabaseAsync("rnscheduling.db");
    await db.runAsync(`UPDATE tasks SET syncStatus = ? WHERE id = ?;`, [
      newSyncStatus,
      taskId,
    ]);
    console.log(
      `[БД] Статус синхронизации задачи ${taskId} изменен на: ${newSyncStatus}`,
    );
  });
};
