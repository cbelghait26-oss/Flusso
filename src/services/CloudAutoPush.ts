import { auth } from "./firebase";
import { cloudPushAll } from "./CloudSync";
import { loadData, type StorageSchema } from "./FlussoStore";
import { loadLocalEvents } from "../data/storage"; // adjust if needed

let pushing = false;

export async function cloudAutoPushNow() {
  const uid = auth.currentUser?.uid;
  if (!uid) return; // not logged in -> do nothing
  if (pushing) return;

  pushing = true;
  try {
    const schema: StorageSchema = await loadData();
    const events = (await loadLocalEvents()) ?? [];

    // TODO: replace these with your real computed values
    const achievements: any[] = [];
    const settings: any = { theme: "system" };
    const stats: any = {
      streak: 0,
      minutesFocused: 0,
      tasksCompletedTotal: schema.tasks.filter(t => t.status === "completed").length,
      objectivesCompletedTotal: schema.objectives.filter(o => o.status === "completed").length,
    };

    await cloudPushAll({ schema, events: events as any, achievements, settings, stats });
  } finally {
    pushing = false;
  }
}
