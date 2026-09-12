import * as SQLite from "expo-sqlite";
import { AppLog, LogActionType, Task, TaskStatus } from "./types";

export interface HistoryLog {
  id: string;
  status: TaskStatus;
  changedAt: string;
}

/**
 * Функция первичной инициализации (вызывается один раз нативно через SQLiteProvider)
 */
export const initDatabaseStructure = async (db: SQLite.SQLiteDatabase) => {
  // Включаем Foreign Keys на уровне ядра SQLite
  await db.execAsync("PRAGMA foreign_keys = ON;");

  await db.execAsync("DROP TABLE IF EXISTs attachments");
  await db.execAsync("DROP TABLE IF EXISTs tasks");
  await db.execAsync("DROP TABLE IF EXISTs app_logs");

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
    CREATE TABLE IF NOT EXISTS app_logs (
      id TEXT PRIMARY KEY NOT NULL,
      timestamp TEXT NOT NULL,
      actionType TEXT NOT NULL,
      description TEXT NOT NULL
    );
  `);

  console.log("--- [Нативный Слой] Структура SQLite успешно проверена ---");
};

/**
 * Получение истории логов для задачи
 */
export const getTaskHistory = async (
  db: SQLite.SQLiteDatabase,
  taskId: string,
): Promise<HistoryLog[]> => {
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM status_history WHERE task_id = ? ORDER BY changedAt DESC;",
    [taskId],
  );

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    changedAt: r.changedAt,
  }));
};

export const updateTaskIdInLocalDB = async (
  db: SQLite.SQLiteDatabase,
  oldId: string,
  newServerId: string,
): Promise<void> => {
  await db.withTransactionAsync(async () => {
    // 1. Получаем саму задачу, чтобы скопировать её данные
    const taskRow = await db.getFirstAsync<any>(
      "SELECT * FROM tasks WHERE id = ?;",
      [oldId],
    );
    if (!taskRow) return;

    // 2. Получаем её локальные вложения и историю, чтобы перевязать их на новый ID
    const attachRows = await db.getAllAsync<any>(
      "SELECT * FROM attachments WHERE task_id = ?;",
      [oldId],
    );
    const historyRows = await db.getAllAsync<any>(
      "SELECT * FROM status_history WHERE task_id = ?;",
      [oldId],
    );

    // 3. Удаляем старую задачу (благодаря ON DELETE CASCADE связанные вложения и история очистятся сами)
    await db.runAsync("DELETE FROM tasks WHERE id = ?;", [oldId]);

    // 4. Вставляем задачу заново, но уже с НОВЫМ серверным ID
    await db.runAsync(
      `INSERT INTO tasks (id, title, description, dueDate, address, latitude, longitude, status, createdAt, syncStatus) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        newServerId, // Наш новый ID от сервера (например, "1")
        taskRow.title,
        taskRow.description,
        taskRow.dueDate,
        taskRow.address,
        taskRow.latitude,
        taskRow.longitude,
        taskRow.status,
        taskRow.createdAt,
        "Synced", // Сразу ставим статус "Синхронизировано"
      ],
    );

    // 5. Записываем обратно вложения, привязав к новому серверному ID
    for (const att of attachRows) {
      await db.runAsync(
        `INSERT INTO attachments (id, task_id, uri, name, type) VALUES (?, ?, ?, ?, ?);`,
        [att.id, newServerId, att.uri, att.name, att.type],
      );
    }

    // 6. Записываем обратно историю статусов с новым серверным ID
    for (const hist of historyRows) {
      await db.runAsync(
        `INSERT INTO status_history (id, task_id, status, changedAt) VALUES (?, ?, ?, ?);`,
        [hist.id, newServerId, hist.status, hist.changedAt],
      );
    }
  });

  console.log(
    `[БД Успех] Задача полностью переведена на серверный ID: "${newServerId}"`,
  );
};

export const insertTask = async (
  db: SQLite.SQLiteDatabase,
  task: Task,
): Promise<void> => {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO tasks (id, title, description, dueDate, address, latitude, longitude, status, createdAt, syncStatus) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        task.id,
        task.title,
        task.description,
        task.dueDate,
        task.location.address,
        task.location.latitude ?? null,
        task.location.longitude ?? null,
        task.status,
        now,
        task.syncStatus,
      ],
    );

    for (const attach of task.attachments) {
      await db.runAsync(
        `INSERT INTO attachments (id, task_id, uri, name, type) VALUES (?, ?, ?, ?, ?);`,
        [attach.id, task.id, attach.uri, attach.name, attach.type],
      );
    }
  });
};

export const updateTask = async (
  db: SQLite.SQLiteDatabase,
  task: Task,
): Promise<void> => {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE tasks 
       SET title = ?, description = ?, dueDate = ?, address = ?, latitude = ?, longitude = ?, status = ?, syncStatus = ? 
       WHERE id = ?;`,
      [
        task.title,
        task.description,
        task.dueDate,
        task.location.address,
        task.location.latitude ?? null,
        task.location.longitude ?? null,
        task.status,
        task.syncStatus,
        task.id,
      ],
    );

    await db.runAsync("DELETE FROM attachments WHERE task_id = ?;", [task.id]);
    for (const attach of task.attachments) {
      await db.runAsync(
        `INSERT INTO attachments (id, task_id, uri, name, type) VALUES (?, ?, ?, ?, ?);`,
        [attach.id, task.id, attach.uri, attach.name, attach.type],
      );
    }
  });
};

export const updateTaskStatus = async (
  db: SQLite.SQLiteDatabase,
  taskId: string,
  newStatus: TaskStatus,
): Promise<void> => {
  await db.runAsync(`UPDATE tasks SET status = ? WHERE id = ?;`, [
    newStatus,
    taskId,
  ]);
};

export const updateTaskSyncStatus = async (
  db: SQLite.SQLiteDatabase,
  taskId: string,
  newSyncStatus: string,
): Promise<void> => {
  await db.runAsync(`UPDATE tasks SET syncStatus = ? WHERE id = ?;`, [
    newSyncStatus,
    taskId,
  ]);
};

export const deleteTask = async (
  db: SQLite.SQLiteDatabase,
  taskId: string,
): Promise<void> => {
  await db.runAsync("DELETE FROM tasks WHERE id = ?;", [taskId]);
};

export const insertLog = async (
  db: SQLite.SQLiteDatabase,
  log: AppLog,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO app_logs (id, timestamp, actionType, description) VALUES (?, ?, ?, ?);`,
    [
      log.id || Math.random().toString(36).substring(7),
      log.timestamp || new Date().toISOString(),
      log.actionType,
      log.description,
    ],
  );
};

export const getAllLogs = async (
  db: SQLite.SQLiteDatabase,
): Promise<AppLog[]> => {
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM app_logs ORDER BY timestamp DESC;",
  );
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    actionType: r.actionType as LogActionType,
    description: r.description,
  }));
};

export const getAllTasks = async (
  db: SQLite.SQLiteDatabase,
): Promise<(Task & { createdAt: string })[]> => {
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
      location: {
        address: row.address,
        latitude: row.latitude ?? undefined,
        longitude: row.longitude ?? undefined,
      },
      attachments,
      status: row.status,
      syncStatus: row.syncStatus,
    });
  }
  return tasks;
};
