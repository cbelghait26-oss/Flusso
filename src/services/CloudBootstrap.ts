import { auth } from "./firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cloudEnsureUserDoc, cloudPullAll, cloudPushAll, type CloudAchievement, type CloudSettings, type CloudStats } from "./CloudSync";
import { loadData, saveData, recomputeObjectives, type StorageSchema } from "./FlussoStore";

// You must implement these 2 adapters to match YOUR calendar storage module.
// If you already have loadLocalEvents/saveLocalEvents, use them here.
import { loadLocalEvents, saveLocalEvents } from "../data/storage"; // adjust path if needed

function bootstrapKey(uid: string) {
  return `flusso:cloud:bootstrapped:${uid}`;
}

/**
 * Call once after successful login.
 * - If cloud is empty: seed cloud from local (first device wins)
 * - If cloud has data: overwrite local with cloud (cloud is source of truth)
 */
export async function bootstrapCloudForUser(params: {
  name: string;
  email: string;
  // supply your computed lists here (if you have them)
  achievements?: CloudAchievement[];
  settings?: CloudSettings;
  stats?: CloudStats;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("bootstrapCloudForUser: missing uid.");

  await cloudEnsureUserDoc({ name: params.name, email: params.email });

  const bootedRaw = await AsyncStorage.getItem(bootstrapKey(uid));
  const alreadyBootstrapped = bootedRaw === "1";

  // Pull cloud
  const cloud = await cloudPullAll();

  const cloudHasAny =
    (cloud.tasks?.length ?? 0) > 0 ||
    (cloud.objectives?.length ?? 0) > 0 ||
    (cloud.events?.length ?? 0) > 0 ||
    (cloud.achievements?.length ?? 0) > 0;

  // Read local
  const localSchema = await loadData();
  const localEvents = (await loadLocalEvents()) ?? [];

  // If first time on this device:
  if (!alreadyBootstrapped) {
    if (!cloudHasAny) {
      // Seed cloud from local
      await cloudPushAll({
        schema: localSchema,
        events: localEvents as any,
        achievements: params.achievements ?? [],
        settings: params.settings ?? { theme: "system" },
        stats: params.stats ?? {
          streak: 0,
          minutesFocused: 0,
          tasksCompletedTotal: localSchema.tasks.filter(t => t.status === "completed").length,
          objectivesCompletedTotal: localSchema.objectives.filter(o => o.status === "completed").length,
        },
      });
    } else {
      // Overwrite local from cloud
      const next: StorageSchema = {
        objectives: (cloud.objectives ?? []).filter(x => !x.deleted) as any,
        tasks: (cloud.tasks ?? []).filter(x => !x.deleted) as any,
        settings: localSchema.settings ?? { activeObjectiveId: null, todayTasksCompleted: 0 },
      };
      next.objectives = recomputeObjectives(next.objectives as any, next.tasks as any);

      await saveData(next);

      const cloudEvents = (cloud.events ?? []).filter(x => !x.deleted);
      await saveLocalEvents(cloudEvents as any);
    }

    await AsyncStorage.setItem(bootstrapKey(uid), "1");
    return;
  }

  // After bootstrap: always treat cloud as source-of-truth for "other device updates"
  // Minimal approach: you can periodically call cloudPullSinceLast() and apply merges.
}
