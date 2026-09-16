// hooks/database.ts
import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import {
    AppLogModel,
    AttachmentModel,
    StatusHistoryModel,
    TaskModel,
} from "./db/models";
import { schema } from "./db/schems";

const adapter = new SQLiteAdapter({
  schema,
  // Отключение JSI, если используете Expo Go.
  // Если делаете кастомный Dev Client (prebuild), рекомендуется true
  jsi: false,
  onSetUpError: (error) => {
    console.error("Ошибка инициализации WatermelonDB:", error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [TaskModel, AttachmentModel, StatusHistoryModel, AppLogModel],
});
