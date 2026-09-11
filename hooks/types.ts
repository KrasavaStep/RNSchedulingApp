export type TaskStatus = "New" | "In Progress" | "Completed" | "Canceled";

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
  location: TaskLocation;
  attachments: TaskAttachment[];
  status: TaskStatus;
}
