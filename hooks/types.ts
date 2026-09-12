export type TaskStatus = "New" | "In Progress" | "Completed" | "Canceled";

export type SyncStatus = "Synced" | "Pending Sync" | "Sync Failed";

export type LogActionType =
  | "CREATE"
  | "EDIT"
  | "STATUS_CHANGE"
  | "ATTACHMENT_CHANGE"
  | "DELETE"
  | "SYNC";

export interface AppLog {
  id: string;
  timestamp: string;
  actionType: LogActionType;
  description: string;
}

export interface TaskAttachment {
  id: string;
  uri: string;
  name: string;
  type: "image" | "pdf" | "other";
}

export interface TaskLocation {
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  createdAt: string;
  location: TaskLocation;
  attachments: TaskAttachment[];
  status: TaskStatus;
  syncStatus: SyncStatus;
}
