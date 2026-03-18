import { google } from "googleapis";

try {
  process.loadEnvFile(".env.local");
} catch {
  // env vars already set in environment
}

async function testCalendarApi() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

  console.log("--- Env var check ---");
  console.log("GOOGLE_CLIENT_ID:", clientId ? "SET" : "MISSING");
  console.log("GOOGLE_CLIENT_SECRET:", clientSecret ? "SET" : "MISSING");
  console.log(
    "GOOGLE_CALENDAR_REFRESH_TOKEN:",
    refreshToken ? "SET" : "MISSING",
  );

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("Aborting: missing env vars.");
    process.exit(1);
  }

  console.log("\n--- OAuth2 token exchange ---");
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  try {
    const { token } = await auth.getAccessToken();
    console.log("Access token obtained:", token ? "YES" : "NO");
  } catch (err) {
    console.error("Token exchange failed:", err);
    process.exit(1);
  }

  console.log("\n--- Calendar API: list upcoming events ---");
  const calendar = google.calendar({ version: "v3", auth });
  try {
    const res = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
      maxResults: 3,
      orderBy: "startTime",
      singleEvents: true,
      timeMin: new Date().toISOString(),
    });
    console.log("Events fetched:", res.data.items?.length ?? 0);
    for (const event of res.data.items ?? []) {
      console.log(" -", event.summary, event.start?.dateTime);
    }
    console.log("\nAll checks passed.");
  } catch (err) {
    console.error("Calendar API call failed:", err);
    process.exit(1);
  }
}

testCalendarApi();
