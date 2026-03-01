import type { Task } from "@/lib/db/schema";
import { TaskItem } from "./task-item";

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground text-sm">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} />
      ))}
    </div>
  );
}
