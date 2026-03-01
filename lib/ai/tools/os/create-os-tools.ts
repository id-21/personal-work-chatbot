import { tool } from "ai";
import { z } from "zod";
import {
  createProject,
  createPursuitThought,
  createTask,
  getProjectById,
  getProjectsByPursuitId,
  getPursuitWithDetail,
  getTasksByProjectId,
  updatePursuitById,
  updateTaskById,
} from "@/lib/db/queries";

/**
 * Factory that returns all OS AI tools scoped to a specific user and pursuit.
 * Tools have access to write operations (create/update tasks, projects, thoughts).
 */
export function createOSTools({
  userId,
  pursuitId,
}: {
  userId: string;
  pursuitId: string;
}) {
  return {
    /**
     * Fetch fresh pursuit detail — projects, tasks, and recent thoughts.
     * Call this if context feels stale mid-conversation.
     */
    getPursuitDetail: tool({
      description:
        "Fetch the current state of the pursuit including all projects, open tasks, and recent thoughts. Use this to refresh your context mid-conversation.",
      inputSchema: z.object({}),
      execute: async () => {
        const data = await getPursuitWithDetail({ id: pursuitId });
        if (!data || data.userId !== userId) {
          return { error: "Pursuit not found or access denied" };
        }
        return {
          name: data.name,
          vision: data.vision,
          currentState: data.currentState,
          constraints: data.constraints,
          opportunities: data.opportunities,
          projects: data.projects.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            openTasks: p.tasks.filter(
              (t) => t.status === "open" || t.status === "in_progress"
            ).length,
            tasks: p.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              source: t.source,
            })),
          })),
          contextSummary: data.contextSummary,
        };
      },
    }),

    /**
     * Create a task under an existing project in this pursuit.
     */
    createTask: tool({
      description:
        "Create a new task under a project in this pursuit. Use this when the user mentions something that should become an action item. source is always 'ai_suggested'.",
      inputSchema: z.object({
        projectId: z
          .string()
          .describe("The project ID to create the task under"),
        title: z
          .string()
          .max(200)
          .describe("Short, action-oriented task title"),
        detail: z.string().optional().describe("Optional additional context"),
      }),
      execute: async ({ projectId, title, detail }) => {
        // Verify project belongs to this pursuit
        const proj = await getProjectById({ id: projectId });
        if (!proj || proj.pursuitId !== pursuitId) {
          return { error: "Project not found in this pursuit" };
        }
        const created = await createTask({
          projectId,
          title,
          detail,
          source: "ai_suggested",
        });
        return { id: created.id, title: created.title, projectId };
      },
    }),

    /**
     * Update an existing task's status or detail.
     */
    updateTask: tool({
      description:
        "Update an existing task's status or detail. Use when the user says something is done, in progress, or wants to change the detail.",
      inputSchema: z.object({
        taskId: z.string().describe("The task ID to update"),
        status: z
          .enum(["open", "in_progress", "done", "dismissed"])
          .optional()
          .describe("New status"),
        detail: z.string().optional().describe("Updated detail text"),
      }),
      execute: async ({ taskId, status, detail }) => {
        const updated = await updateTaskById({ id: taskId, updates: { status, detail } });
        return { id: updated.id, status: updated.status };
      },
    }),

    /**
     * Create a new project under this pursuit.
     */
    createProject: tool({
      description:
        "Create a new project under this pursuit. Use when the user describes an initiative that doesn't fit any existing project.",
      inputSchema: z.object({
        name: z.string().max(200).describe("Short project name"),
        description: z
          .string()
          .optional()
          .describe("Brief description of what this project is about"),
      }),
      execute: async ({ name, description }) => {
        const created = await createProject({
          pursuitId,
          name,
          description,
        });
        return { id: created.id, name: created.name };
      },
    }),

    /**
     * Update the pursuit's vision, current state, constraints, or opportunities.
     */
    updatePursuit: tool({
      description:
        "Update the pursuit's current state, vision, constraints, or opportunities. Use when the user reveals new information about where things stand.",
      inputSchema: z.object({
        currentState: z.string().optional().describe("Updated current state"),
        vision: z.string().optional().describe("Updated vision statement"),
        constraints: z
          .array(z.string())
          .optional()
          .describe("Updated list of constraints"),
        opportunities: z
          .array(z.string())
          .optional()
          .describe("Updated list of opportunities"),
      }),
      execute: async ({ currentState, vision, constraints, opportunities }) => {
        const updates: Record<string, unknown> = {};
        if (currentState !== undefined) updates.currentState = currentState;
        if (vision !== undefined) updates.vision = vision;
        if (constraints !== undefined) updates.constraints = constraints;
        if (opportunities !== undefined) updates.opportunities = opportunities;

        const updated = await updatePursuitById({
          id: pursuitId,
          userId,
          updates,
        });
        return { id: updated.id, updated: Object.keys(updates) };
      },
    }),

    /**
     * Log a thought to the pursuit's thought log.
     * Call this at the end of every meaningful exchange to build long-term memory.
     */
    logThought: tool({
      description:
        "Append a summary to the pursuit's thought log. Call this after every substantive exchange — summarise what was discussed and any decisions made. This is how long-term memory is built.",
      inputSchema: z.object({
        content: z
          .string()
          .max(2000)
          .describe(
            "1-3 sentence summary of what was just discussed or decided"
          ),
      }),
      execute: async ({ content }) => {
        const thought = await createPursuitThought({
          pursuitId,
          author: "ai",
          content,
        });
        return { id: thought.id, logged: true };
      },
    }),

    /**
     * Get tasks for a specific project.
     */
    getProjectTasks: tool({
      description:
        "Get the current task list for a specific project. Use to check what's already there before creating duplicates.",
      inputSchema: z.object({
        projectId: z.string().describe("The project ID"),
      }),
      execute: async ({ projectId }) => {
        const proj = await getProjectById({ id: projectId });
        if (!proj || proj.pursuitId !== pursuitId) {
          return { error: "Project not found in this pursuit" };
        }
        const tasks = await getTasksByProjectId({ projectId });
        return tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          source: t.source,
        }));
      },
    }),
  };
}

export type OSTool = ReturnType<typeof createOSTools>;
