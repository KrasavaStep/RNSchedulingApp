import { Model } from "@nozbe/watermelondb";
import { children, field, text } from "@nozbe/watermelondb/decorators";

export class TaskModel extends Model {
  static table = "tasks";
  static associations = {
    attachments: { type: "has_many" as const, foreignKey: "task_id" },
    status_histories: { type: "has_many" as const, foreignKey: "task_id" },
  };

  @text("title") title!: string;
  @text("description") description!: string;
  @text("due_date") dueDate!: string;
  @text("address") address!: string;
  @field("latitude") latitude?: number;
  @field("longitude") longitude?: number;
  @text("status") status!: string;
  @text("created_at") createdAt!: string;
  @text("sync_status") appSyncStatus!: string;
  @children("attachments") attachments!: any;
  @children("status_histories") statusHistories!: any;
}

export class AttachmentModel extends Model {
  static table = "attachments";
  static associations = {
    tasks: { type: "belongs_to" as const, key: "task_id" },
  };

  @text("task_id") taskId!: string;
  @text("uri") uri!: string;
  @text("name") name!: string;
  @text("type") type!: string;
}

export class StatusHistoryModel extends Model {
  static table = "status_histories";

  @text("task_id") taskId!: string;
  @text("status") status!: string;
  @text("changed_at") changedAt!: string;
}

export class AppLogModel extends Model {
  static table = "app_logs";

  @text("timestamp") timestamp!: string;
  @text("action_type") actionType!: string;
  @text("description") description!: string;
}
