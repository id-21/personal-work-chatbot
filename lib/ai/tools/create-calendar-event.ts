import { tool } from "ai";
import { google } from "googleapis";
import { z } from "zod";

function getCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN",
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

const addOneHour = (isoDatetime: string): string => {
  const date = new Date(isoDatetime);
  date.setHours(date.getHours() + 1);
  return date.toISOString();
};

export const createCalendarEvent = tool({
  description:
    "Create an event or reminder on the user's Google Calendar. Use this when the user explicitly asks to schedule, book, add, create a reminder, or block time on their calendar.",
  inputSchema: z.object({
    title: z.string().describe("Title/summary of the event"),
    startDateTime: z
      .string()
      .describe("Start in ISO 8601 format, e.g. 2026-03-20T14:00:00+05:30"),
    endDateTime: z
      .string()
      .optional()
      .describe("End in ISO 8601 format. Defaults to 1 hour after start."),
    timezone: z
      .string()
      .optional()
      .describe(
        "IANA timezone, e.g. 'America/New_York' or 'Asia/Kolkata'. Infer from the user's city/country context. Defaults to UTC.",
      ),
    description: z.string().optional().describe("Optional notes for the event"),
    location: z.string().optional().describe("Optional location string"),
  }),
  needsApproval: true,
  execute: async (input) => {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
    const resolvedTimezone = input.timezone ?? "UTC";
    const resolvedEnd = input.endDateTime ?? addOneHour(input.startDateTime);

    let calendar: ReturnType<typeof google.calendar>;
    try {
      calendar = getCalendarClient();
    } catch (err) {
      console.error("[createCalendarEvent] client init failed:", err);
      return {
        error:
          err instanceof Error
            ? err.message
            : "Failed to initialise Google Calendar client.",
      };
    }

    try {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: input.title,
          description: input.description,
          location: input.location,
          start: { dateTime: input.startDateTime, timeZone: resolvedTimezone },
          end: { dateTime: resolvedEnd, timeZone: resolvedTimezone },
        },
      });

      const event = response.data;
      return {
        id: event.id,
        title: event.summary,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        timezone: resolvedTimezone,
        link: event.htmlLink,
      };
    } catch (err) {
      console.error("[createCalendarEvent] API call failed:", err);
      return {
        error:
          err instanceof Error
            ? `Google Calendar API error: ${err.message}`
            : "Unknown error creating calendar event.",
      };
    }
  },
});
