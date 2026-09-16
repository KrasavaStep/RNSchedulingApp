import { Database, Q } from "@nozbe/watermelondb";
import { AppLog, LogActionType, SyncStatus, Task, TaskStatus } from "../types";
import {
    AppLogModel,
    AttachmentModel,
    StatusHistoryModel,
    TaskModel,
} from "./models";

export interface HistoryLog {
  id: string;
  status: TaskStatus;
  changedAt: string;
}

/**
 * Получение истории логов для задачи
 */
export const getTaskHistory = async (
  db: Database,
  taskId: string,
): Promise<HistoryLog[]> => {
  const histories = await db
    .get<StatusHistoryModel>("status_histories")
    .query(Q.where("task_id", taskId), Q.sortBy("changed_at", Q.desc))
    .fetch();

  return histories.map((h) => ({
    id: h.id,
    status: h.status as TaskStatus,
    changedAt: h.changedAt,
  }));
};

/**
 * Замена локального ID на новый ID от сервера
 */
export const updateTaskIdInLocalDB = async (
  db: Database,
  oldId: string,
  newServerId: string,
): Promise<void> => {
  await db.write(async () => {
    const tasksAdapter = db.get<TaskModel>("tasks");
    const attachmentsAdapter = db.get<AttachmentModel>("attachments");
    const historiesAdapter = db.get<StatusHistoryModel>("status_histories");

    const task = await tasksAdapter.find(oldId).catch(() => null);
    if (!task) return;

    const attachments = await attachmentsAdapter
      .query(Q.where("task_id", oldId))
      .fetch();
    const histories = await historiesAdapter
      .query(Q.where("task_id", oldId))
      .fetch();

    // 1. Создаем новую задачу с явным серверам ID
    const newTask = await tasksAdapter.create((record) => {
      record._raw.id = newServerId; // WatermelonDB позволяет явно задать ID при создании
      record.title = task.title;
      record.description = task.description;
      record.dueDate = task.dueDate;
      record.address = task.address;
      record.latitude = task.latitude;
      record.longitude = task.longitude;
      record.status = task.status;
      record.createdAt = task.createdAt;
      record.appSyncStatus = "Synced";
    });

    // 2. Переносим вложения
    const newAttachments = attachments.map((att) =>
      attachmentsAdapter.prepareCreate((record) => {
        record.taskId = newTask.id;
        record.uri = att.uri;
        record.name = att.name;
        record.type = att.type;
      }),
    );

    // 3. Переносим историю
    const newHistories = histories.map((hist) =>
      historiesAdapter.prepareCreate((record) => {
        record.taskId = newTask.id;
        record.status = hist.status;
        record.changedAt = hist.changedAt;
      }),
    );

    // 4. Удаляем старые записи
    const markAsDeleted = [
      task.prepareDestroyPermanently(),
      ...attachments.map((a) => a.prepareDestroyPermanently()),
      ...histories.map((h) => h.prepareDestroyPermanently()),
    ];

    // Выполняем все операции одним батчем в потоке C++
    await db.batch(
      ...markAsDeleted,
      newTask,
      ...newAttachments,
      ...newHistories,
    );
  });
};

/**
 * Вставка задачи с вложениями
 */
export const insertTask = async (db: Database, task: Task): Promise<void> => {
  const now = new Date().toISOString();

  await db.write(async () => {
    const tasksAdapter = db.get<TaskModel>("tasks");
    const attachmentsAdapter = db.get<AttachmentModel>("attachments");

    const newTask = await tasksAdapter.create((record) => {
      if (task.id) record._raw.id = task.id;
      record.title = task.title;
      record.description = task.description;
      record.dueDate = task.dueDate;
      record.address = task.location.address;
      record.latitude = task.location.latitude;
      record.longitude = task.location.longitude;
      record.status = task.status;
      record.createdAt = now;
      record.appSyncStatus = task.syncStatus;
    });

    const attachmentRecords = (task.attachments || []).map((attach) =>
      attachmentsAdapter.prepareCreate((record) => {
        if (attach.id) record._raw.id = attach.id;
        record.taskId = newTask.id;
        record.uri = attach.uri;
        record.name = attach.name;
        record.type = attach.type;
      }),
    );

    if (attachmentRecords.length > 0) {
      await db.batch(...attachmentRecords);
    }
  });
};

/**
 * Обновление задачи и пересоздание ее вложений
 */
export const updateTask = async (db: Database, task: Task): Promise<void> => {
  await db.write(async () => {
    const tasksAdapter = db.get<TaskModel>("tasks");
    const attachmentsAdapter = db.get<AttachmentModel>("attachments");

    const taskRecord = await tasksAdapter.find(task.id);

    // Подготовка обновления задачи
    const updateTaskOp = taskRecord.prepareUpdate((record) => {
      record.title = task.title;
      record.description = task.description;
      record.dueDate = task.dueDate;
      record.address = task.location.address;
      record.latitude = task.location.latitude;
      record.longitude = task.location.longitude;
      record.status = task.status;
      record.appSyncStatus = task.syncStatus;
    });

    // Удаление старых вложений
    const oldAttachments = await attachmentsAdapter
      .query(Q.where("task_id", task.id))
      .fetch();
    const deleteOps = oldAttachments.map((a) => a.prepareDestroyPermanently());

    // Создание новых вложений
    const createOps = (task.attachments || []).map((attach) =>
      attachmentsAdapter.prepareCreate((record) => {
        if (attach.id) record._raw.id = attach.id;
        record.taskId = task.id;
        record.uri = attach.uri;
        record.name = attach.name;
        record.type = attach.type;
      }),
    );

    await db.batch(updateTaskOp, ...deleteOps, ...createOps);
  });
};

/**
 * Обновление статуса задачи
 */
export const updateTaskStatus = async (
  db: Database,
  taskId: string,
  newStatus: TaskStatus,
): Promise<void> => {
  await db.write(async () => {
    const task = await db.get<TaskModel>("tasks").find(taskId);
    await task.update((record) => {
      record.status = newStatus;
    });
  });
};

/**
 * Обновление статуса синхронизации
 */
export const updateTaskSyncStatus = async (
  db: Database,
  taskId: string,
  newSyncStatus: string,
): Promise<void> => {
  await db.write(async () => {
    const task = await db.get<TaskModel>("tasks").find(taskId);
    await task.update((record) => {
      record.appSyncStatus = newSyncStatus;
    });
  });
};

/**
 * Каскадное удаление задачи и связанных сущностей
 */
export const deleteTask = async (
  db: Database,
  taskId: string,
): Promise<void> => {
  await db.write(async () => {
    const task = await db.get<TaskModel>("tasks").find(taskId);
    const attachments = await db
      .get<AttachmentModel>("attachments")
      .query(Q.where("task_id", taskId))
      .fetch();
    const histories = await db
      .get<StatusHistoryModel>("status_histories")
      .query(Q.where("task_id", taskId))
      .fetch();

    const preparedDeletes = [
      task.prepareDestroyPermanently(),
      ...attachments.map((a) => a.prepareDestroyPermanently()),
      ...histories.map((h) => h.prepareDestroyPermanently()),
    ];

    await db.batch(...preparedDeletes);
  });
};

/**
 * Запись системного лога
 */
export const insertLog = async (db: Database, log: AppLog): Promise<void> => {
  await db.write(async () => {
    await db.get<AppLogModel>("app_logs").create((record) => {
      if (log.id) record._raw.id = log.id;
      record.timestamp = log.timestamp || new Date().toISOString();
      record.actionType = log.actionType;
      record.description = log.description;
    });
  });
};

/**
 * Получение всех логов
 */
export const getAllLogs = async (db: Database): Promise<AppLog[]> => {
  const logs = await db
    .get<AppLogModel>("app_logs")
    .query(Q.sortBy("timestamp", Q.desc))
    .fetch();

  return logs.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    actionType: l.actionType as LogActionType,
    description: l.description,
  }));
};

/**
 * Получение всех задач с загруженными вложениями
 */
export const getAllTasks = async (
  db: Database,
): Promise<(Task & { createdAt: string })[]> => {
  const tasks = await db
    .get<TaskModel>("tasks")
    .query(Q.sortBy("created_at", Q.desc))
    .fetch();

  const result = await Promise.all(
    tasks.map(async (task) => {
      const attachments = await task.attachments.fetch();

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        location: {
          address: task.address,
          latitude: task.latitude,
          longitude: task.longitude,
        },
        attachments: attachments.map((att: AttachmentModel) => ({
          id: att.id,
          uri: att.uri,
          name: att.name,
          type: att.type,
        })),
        status: task.status as TaskStatus,
        syncStatus: task.appSyncStatus as SyncStatus,
      };
    }),
  );

  return result;
};
