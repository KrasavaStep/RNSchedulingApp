import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "tasks",
      columns: [
        { name: "title", type: "string" },
        { name: "description", type: "string" },
        { name: "due_date", type: "string" },
        { name: "address", type: "string" },
        { name: "latitude", type: "number", isOptional: true },
        { name: "longitude", type: "number", isOptional: true },
        { name: "status", type: "string" },
        { name: "created_at", type: "string" },
        { name: "sync_status", type: "string" },
      ],
    }),
    tableSchema({
      name: "attachments",
      columns: [
        { name: "task_id", type: "string", isIndexed: true },
        { name: "uri", type: "string" },
        { name: "name", type: "string" },
        { name: "type", type: "string" },
      ],
    }),
    tableSchema({
      name: "status_histories",
      columns: [
        { name: "task_id", type: "string", isIndexed: true },
        { name: "status", type: "string" },
        { name: "changed_at", type: "string" },
      ],
    }),
    tableSchema({
      name: "app_logs",
      columns: [
        { name: "timestamp", type: "string" },
        { name: "action_type", type: "string" },
        { name: "description", type: "string" },
      ],
    }),
  ],
});
