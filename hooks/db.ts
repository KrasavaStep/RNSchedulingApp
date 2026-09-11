import * as SQLite from "expo-sqlite";
import { Task, TaskAttachment, TaskStatus } from "./types";

const getDB = async () => {
  return await SQLite.openDatabaseAsync("rnscheduling.db");
};

export const initDatabase = async () => {
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
      status TEXT NOT NULL
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

  console.log("SQLite база данных успешно инициализирована");
};

export const insertTask = async (task: Task): Promise<void> => {
  const db = await getDB();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO tasks (id, title, description, dueDate, address, latitude, longitude, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        task.id,
        task.title,
        task.description,
        task.dueDate,
        task.location.address,
        task.location.latitude ?? null,
        task.location.longitude ?? null,
        task.status,
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

/**
 * Получение всех задач из базы данных (с вложениями)
 */
export const getAllTasks = async (): Promise<Task[]> => {
  const db = await SQLite.openDatabaseAsync("rnscheduling.db");

  const tasksRows = await db.getAllAsync<any>("SELECT * FROM tasks;");
  const tasks: Task[] = [];

  for (const row of tasksRows) {
    const attachRows = await db.getAllAsync<any>(
      "SELECT * FROM attachments WHERE task_id = ?;",
      [row.id],
    );

    const attachments: TaskAttachment[] = attachRows.map((att) => ({
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
      location: {
        address: row.address,
        latitude: row.latitude ?? undefined,
        longitude: row.longitude ?? undefined,
      },
      attachments,
      status: row.status as TaskStatus,
    });
  }

  return tasks;
};
