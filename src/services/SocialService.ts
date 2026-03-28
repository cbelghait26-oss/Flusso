// src/services/SocialService.ts
// ─── Social Graph + Leaderboard + Shared Workspace ──────────────────────────
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  uid: string;
  displayName: string;
  pfpUrl: string | null;
  friendTag: string;      // 6-char uppercase alphanumeric, stored without #
  createdAt?: any;
  pushToken?: string;     // Expo push token for remote notifications
};

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: any;
  from_display_name: string;
  from_tag: string;
  to_display_name: string;
  to_tag: string;
};

export type UserMetrics = {
  uid: string;
  focusMinutesToday: number;
  tasksCompletedToday: number;
  streak: number;
  lastUpdated?: any;
};

export type DailyMetrics = {
  date: string; // YYYY-MM-DD
  focusMinutes: number;
  tasksCompleted: number;
};

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  friendTag: string;
  pfpUrl: string | null;
  focusMinutes: number;
  tasksCompleted: number;
  streak: number;
  isMe: boolean;
};

export type SharedMember = {
  uid: string;
  role: "owner" | "member";
  displayName: string;
};

export type SharedObjective = {
  id: string;
  title: string;
  description?: string;
  deadline?: string;       // YYYY-MM-DD
  objectiveType?: string;  // e.g. Academic, Career, Health…
  owner_id: string;
  owner_name: string;
  memberUids: string[]; // flat array for Firestore array-contains queries
  members: SharedMember[];
  completedUids?: string[]; // members who pressed "Mark completed"
  status?: "active" | "completed";
  hideMembers?: boolean;
  created_at: any;
};

export type SharedTaskStatus = "not-started" | "in-progress" | "completed";

export type SharedTask = {
  id: string;
  objective_id: string;
  title: string;
  assigned_user_id: string;
  assigned_display_name: string;
  status: SharedTaskStatus;
  created_at: any;
};

export type SharedParticipant = { uid: string; displayName: string };

export type SharedInviteType = "event" | "objective";

export type SharedInvite = {
  id: string;
  type: SharedInviteType;
  refId: string;         // sharedEvent.id or sharedObjective.id
  title: string;
  date?: string;         // filled for event invites (YYYY-MM-DD)
  fromUid: string;
  fromName: string;
  toUid: string;
  status: "pending" | "accepted" | "declined";
  created_at: any;
};

export type SharedEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  creator_id: string;
  creator_name: string;
  participantUids: string[]; // flat for queries
  participants: SharedParticipant[];
  hideParticipants?: boolean;
  created_at: any;
};

export type LeaderboardRange = "daily" | "weekly" | "monthly" | "yearly";

// ── Internal helpers ─────────────────────────────────────────────────────────

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("SocialService: user not authenticated.");
  return uid;
}

function friendshipDocId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join("_");
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeStartDate(range: LeaderboardRange, today: Date): string {
  const d = new Date(today);
  switch (range) {
    case "daily":
      return fmtDate(d);
    case "weekly":
      d.setDate(d.getDate() - 6);
      return fmtDate(d);
    case "monthly":
      d.setDate(d.getDate() - 29);
      return fmtDate(d);
    case "yearly":
      d.setDate(d.getDate() - 364);
      return fmtDate(d);
  }
}

function nanoid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// ── User Profile ─────────────────────────────────────────────────────────────

// ── Tag generation ────────────────────────────────────────────────────────────

const TAG_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TAG_LENGTH = 6;

/**
 * Derive a stable 6-char alphanumeric tag from the user's UID.
 * Deterministic: same UID always produces the same tag. No Firestore
 * calls required — the tag can be displayed instantly without any loading state.
 */
export function tagFromUid(uid: string): string {
  // DJB2 variant hash over the uid string
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) + hash) ^ uid.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  let result = "";
  let n = hash;
  for (let i = 0; i < TAG_LENGTH; i++) {
    result += TAG_CHARS[n % 36];
    n = Math.floor(n / 36);
  }
  return result;
}

// Profile: users/{uid}  — root doc, rules: read if signedIn(), write if isSelf()
function profileRef(uid: string) {
  return doc(db, "users", uid);
}

// Reverse-lookup: friendTags/{TAG}  →  { uid }
// Doc-ID IS the tag. Rules: create with keys ['uid','createdAt'] only; update/delete blocked.
function friendTagDocRef(tag: string) {
  return doc(db, "friendTags", tag);
}

/**
 * Upserts a public profile for the current user in Firestore.
 * The friendTag is deterministically derived from the UID, so it is
 * instantly available before this call completes.
 * Call after sign-in / on app bootstrap.
 */
export async function ensureUserProfile(
  displayName: string | null | undefined,
  pfpUrl?: string | null
): Promise<void> {
  const uid = requireUid();
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  const safeName = (displayName ?? "").trim() || "User";
  const friendTag = tagFromUid(uid);

  const now = new Date().toISOString();

  // Only sync pfp if it's a URL (http/https). Base64 strings are
  // hundreds of KB and would exceed Firestore's 1 MB document limit.
  const safePfp = pfpUrl && pfpUrl.startsWith("http") ? pfpUrl : null;

  if (!snap.exists()) {
    // Flat write — rules for users/{uid} have no field restrictions
    await setDoc(ref, { uid, displayName: safeName, pfpUrl: safePfp, friendTag, createdAt: now });
    // friendTags rules: keys must be EXACTLY ['uid', 'createdAt']; update/delete blocked
    const tagRef = friendTagDocRef(friendTag);
    getDoc(tagRef).then((ts) => {
      if (!ts.exists()) setDoc(tagRef, { uid, createdAt: now });
    }).catch(() => {});
  } else {
    const stored = snap.data() as UserProfile;
    const updates: Partial<UserProfile> & { updatedAt?: string } = {};
    if (safeName && stored.displayName !== safeName) updates.displayName = safeName;
    if (safePfp !== undefined && stored.pfpUrl !== safePfp) updates.pfpUrl = safePfp;
    if (!stored.friendTag) updates.friendTag = friendTag;
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = now;
      await setDoc(ref, { ...stored, ...updates }, { merge: true });
    }
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile ?? null;
}

/**
 * Persist the device's Expo push token into the user's public profile.
 * Call after initNotifications() resolves with a token.
 */
export async function storePushToken(token: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !token) return;
  await setDoc(profileRef(uid), { pushToken: token }, { merge: true });
}

/**
 * Fire-and-forget: send an Expo push notification to another user.
 * Reads the recipient's push token from their Firestore profile.
 */
async function sendPushNotif(
  toUid: string,
  title: string,
  body: string
): Promise<void> {
  const profile = await getUserProfile(toUid);
  const token = profile?.pushToken;
  if (!token || !token.startsWith("ExponentPushToken")) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: token, title, body, sound: "default" }),
  });
}

export async function getMyProfile(): Promise<UserProfile | null> {
  const uid = requireUid();
  return getUserProfile(uid);
}

/**
 * Look up a user by their friend tag (strip leading # if present).
 * Reads a single doc from the top-level friendTags/{TAG} collection.
 * No collectionGroup query or composite index required.
 */
export async function lookupByFriendTag(
  rawInput: string
): Promise<UserProfile | null> {
  const tag = rawInput.trim().replace(/^#/, "").toUpperCase();
  if (tag.length !== TAG_LENGTH) return null;
  const myUid = requireUid();

  const snap = await getDoc(friendTagDocRef(tag));
  if (!snap.exists()) return null;

  const data = snap.data() as { uid: string };
  if (!data?.uid || data.uid === myUid) return null;
  return getUserProfile(data.uid);
}

// ── Friends ──────────────────────────────────────────────────────────────────

export async function sendFriendRequest(
  toUid: string
): Promise<{ ok: boolean; error?: string }> {
  const fromUid = requireUid();
  if (fromUid === toUid)
    return { ok: false, error: "You cannot add yourself." };

  const id = friendshipDocId(fromUid, toUid);
  const now = new Date().toISOString();

  // Note: we cannot pre-read friendRequests/friendships docs to check for
  // duplicates because Firestore rules reference resource.data.* which throws
  // when the document doesn't exist (resource is null) → permission denied.
  // Instead we just attempt the create; the rules enforce fromUserId == auth.uid.
  try {
    await setDoc(doc(db, "friendRequests", id), {
      fromUserId: fromUid,
      toUserId: toUid,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  } catch (e: any) {
    if (e?.code === "permission-denied")
      return { ok: false, error: "Request already sent or you are already friends." };
    throw e;
  }

  // Notify the recipient (fire-and-forget — never block the UI on this)
  getUserProfile(fromUid)
    .then((p) => {
      if (p) sendPushNotif(toUid, "New friend request", `${p.displayName} wants to be friends`).catch(() => {});
    })
    .catch(() => {});

  return { ok: true };
}

export async function acceptFriendRequest(fromUid: string): Promise<void> {
  const toUid = requireUid();
  const id = friendshipDocId(fromUid, toUid);
  const now = new Date().toISOString();
  const [userA, userB] = [fromUid, toUid].sort();
  // Rules for friendships: keys must be exactly ['userA','userB','users','status','createdAt']
  // Rules for friendRequests update: auth.uid == toUserId, status in ['accepted','declined']
  await Promise.all([
    setDoc(doc(db, "friendships", id), {
      userA,
      userB,
      users: [fromUid, toUid],
      status: "active",
      createdAt: now,
    }),
    updateDoc(doc(db, "friendRequests", id), { status: "accepted", updatedAt: now }),
  ]);

  // Notify the original sender that their request was accepted
  getUserProfile(toUid)
    .then((p) => {
      if (p) sendPushNotif(fromUid, "Friend request accepted 🤝", `${p.displayName} accepted your friend request!`).catch(() => {});
    })
    .catch(() => {});
}

export async function declineFriendRequest(fromUid: string): Promise<void> {
  const toUid = requireUid();
  const id = friendshipDocId(fromUid, toUid);
  // Rules: toUserId can set status to 'declined'
  await updateDoc(doc(db, "friendRequests", id), {
    status: "declined",
    updatedAt: new Date().toISOString(),
  });
}

export async function removeFriend(friendUid: string): Promise<void> {
  const uid = requireUid();
  const id = friendshipDocId(uid, friendUid);
  await deleteDoc(doc(db, "friendships", id));
}

export async function getFriends(): Promise<
  { profile: UserProfile; friendship: Friendship }[]
> {
  const uid = requireUid();

  // Two separate single-field queries so Firestore rules can evaluate them:
  // rule checks userA == uid OR userB == uid; each query guarantees one branch.
  const [snapA, snapB] = await Promise.all([
    getDocs(query(collection(db, "friendships"), where("userA", "==", uid), where("status", "==", "active"))),
    getDocs(query(collection(db, "friendships"), where("userB", "==", uid), where("status", "==", "active"))),
  ]);

  const seen = new Set<string>();
  const docs = [...snapA.docs, ...snapB.docs].filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });

  const results = await Promise.all(
    docs.map(async (d) => {
      const f = d.data() as { userA: string; userB: string; users: string[]; status: string; createdAt: string };
      const friendUid = f.userA === uid ? f.userB : f.userA;
      const profile = await getUserProfile(friendUid);
      if (!profile) return null;
      const friendship: Friendship = {
        id: d.id,
        user_id: uid,
        friend_id: friendUid,
        status: "accepted",
        created_at: f.createdAt,
        from_display_name: "",
        from_tag: "",
        to_display_name: profile.displayName,
        to_tag: profile.friendTag ?? "",
      };
      return { profile, friendship };
    })
  );

  return results.filter((r): r is { profile: UserProfile; friendship: Friendship } => r !== null);
}

export async function getIncomingRequests(): Promise<Friendship[]> {
  const uid = requireUid();
  // Query only on toUserId (single-field = no composite index needed).
  // Filter status client-side to avoid requiring a Firestore composite index.
  const snap = await getDocs(
    query(
      collection(db, "friendRequests"),
      where("toUserId", "==", uid)
    )
  );
  const results = await Promise.all(
    snap.docs
      .filter((d) => d.data().status === "pending")
      .map(async (d) => {
        const data = d.data() as { fromUserId: string; toUserId: string; status: string; createdAt: string };
        const fromProfile = await getUserProfile(data.fromUserId);
        const friendship: Friendship = {
          id: d.id,
          user_id: data.fromUserId,
          friend_id: data.toUserId,
          status: "pending",
          created_at: data.createdAt,
          from_display_name: fromProfile?.displayName ?? data.fromUserId.slice(-6),
          from_tag: fromProfile?.friendTag ?? tagFromUid(data.fromUserId),
          to_display_name: "",
          to_tag: "",
        };
        return friendship;
      })
  );
  return results;
}

// ── Metrics Sync ─────────────────────────────────────────────────────────────

/**
 * Push today's aggregated metrics to Firestore.
 * Call on app foreground / after focus sessions / task completions.
 */
export async function pushMyMetrics(
  focusMinutes: number,
  tasksCompleted: number,
  streak: number
): Promise<void> {
  const uid = requireUid();
  const today = fmtDate(new Date());
  const batch = writeBatch(db);

  batch.set(
    doc(db, "userMetrics", uid),
    {
      uid,
      focusMinutesToday: focusMinutes,
      tasksCompletedToday: tasksCompleted,
      streak,
      lastUpdated: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    doc(db, "userMetrics", uid, "daily", today),
    {
      date: today,
      focusMinutes,
      tasksCompleted,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}

/**
 * Build leaderboard for the current user + their friends.
 * myMetrics is passed in from local storage to avoid a round-trip for the
 * current user.
 */
export async function getLeaderboard(
  friendUids: string[],
  myMetrics: { focusMinutes: number; tasksCompleted: number; streak: number },
  range: LeaderboardRange
): Promise<LeaderboardEntry[]> {
  const myUid = requireUid();
  const today = new Date();
  const startDate = rangeStartDate(range, today);
  const todayStr = fmtDate(today);

  const allUids = [...friendUids, myUid];
  const entries: LeaderboardEntry[] = [];

  await Promise.all(
    allUids.map(async (uid) => {
      // Always fetch the profile first — if it fails, skip entirely
      let profile: UserProfile | null = null;
      try {
        profile = await getUserProfile(uid);
      } catch {
        return;
      }
      if (!profile) return;

      let focusMinutes = 0;
      let tasksCompleted = 0;
      let streak = 0;

      if (uid === myUid) {
        focusMinutes = myMetrics.focusMinutes;
        tasksCompleted = myMetrics.tasksCompleted;
        streak = myMetrics.streak;
      } else {
        // Metrics reads are best-effort: if rules block them the friend still
        // appears on the leaderboard with 0 minutes rather than disappearing.
        try {
          if (range === "daily") {
            const snap = await getDoc(doc(db, "userMetrics", uid));
            if (snap.exists()) {
              const d = snap.data() as UserMetrics;
              focusMinutes = d.focusMinutesToday ?? 0;
              tasksCompleted = d.tasksCompletedToday ?? 0;
              streak = d.streak ?? 0;
            }
          } else {
            const q = query(
              collection(db, "userMetrics", uid, "daily"),
              where("date", ">=", startDate),
              where("date", "<=", todayStr)
            );
            const snap = await getDocs(q);
            snap.docs.forEach((d) => {
              const data = d.data() as DailyMetrics;
              focusMinutes += data.focusMinutes ?? 0;
              tasksCompleted += data.tasksCompleted ?? 0;
            });
            const agg = await getDoc(doc(db, "userMetrics", uid));
            if (agg.exists()) streak = (agg.data() as UserMetrics).streak ?? 0;
          }
        } catch {
          // Metrics inaccessible — show friend with 0 minutes
        }
      }

      entries.push({
        uid,
        displayName: profile.displayName || uid.slice(-6),
        friendTag: profile.friendTag ?? "",
        pfpUrl: profile.pfpUrl,
        focusMinutes,
        tasksCompleted,
        streak,
        isMe: uid === myUid,
      });
    })
  );

  return entries.sort((a, b) => b.focusMinutes - a.focusMinutes);
}

// ── Shared Objectives ────────────────────────────────────────────────────────

export async function createSharedObjective(
  title: string,
  inviteeUids: string[] = []
): Promise<SharedObjective> {
  const uid = requireUid();
  const uniqueInvitees = inviteeUids.filter((u) => u !== uid);
  const ownerProfile = await getUserProfile(uid);
  const id = nanoid("sobj");

  const members: SharedMember[] = [
    { uid, role: "owner", displayName: ownerProfile?.displayName ?? "Unknown" },
  ];

  const obj: SharedObjective = {
    id,
    title: title.trim(),
    owner_id: uid,
    owner_name: ownerProfile?.displayName ?? "Unknown",
    memberUids: [uid],
    members,
    created_at: serverTimestamp(),
  };

  await setDoc(doc(db, "sharedObjectives", id), obj);

  // Send invites to each invitee — they must accept before being added
  if (uniqueInvitees.length > 0) {
    await sendSharedInvites("objective", id, title.trim(), uniqueInvitees);
  }

  return obj;
}

export async function addMemberToSharedObjective(
  objectiveId: string,
  memberUid: string
): Promise<{ ok: boolean; error?: string }> {
  const uid = requireUid();
  const ref = doc(db, "sharedObjectives", objectiveId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return { ok: false, error: "Objective not found." };

  const obj = snap.data() as SharedObjective;
  if (obj.owner_id !== uid)
    return { ok: false, error: "Only the owner can add members." };
  if (obj.memberUids.includes(memberUid))
    return { ok: false, error: "Already a member." };

  const memberProfile = await getUserProfile(memberUid);
  if (!memberProfile) return { ok: false, error: "User not found." };

  await updateDoc(ref, {
    memberUids: [...obj.memberUids, memberUid],
    members: [
      ...obj.members,
      { uid: memberUid, role: "member", displayName: memberProfile.displayName },
    ],
  });

  return { ok: true };
}

export async function getMySharedObjectives(): Promise<SharedObjective[]> {
  const uid = requireUid();
  const q = query(
    collection(db, "sharedObjectives"),
    where("memberUids", "array-contains", uid)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SharedObjective);
}

/**
 * Record that the current user has marked a shared objective as complete.
 * When ALL members have voted, the objective gets status = "completed".
 */
export async function voteCompleteSharedObjective(id: string): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedObjectives", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const obj = snap.data() as SharedObjective;
  if ((obj.completedUids ?? []).includes(uid)) return; // already voted
  const newCompletedUids = [...(obj.completedUids ?? []), uid];
  const allDone = obj.memberUids.every((u) => newCompletedUids.includes(u));
  await updateDoc(ref, {
    completedUids: arrayUnion(uid),
    ...(allDone ? { status: "completed" } : {}),
  });

  // When everyone has voted, notify all other members about the achievement
  if (allDone) {
    for (const memberUid of obj.memberUids) {
      if (memberUid === uid) continue;
      sendPushNotif(
        memberUid,
        "Shared project complete! 🏆",
        `"${obj.title}" has been marked complete by all members.`,
      ).catch(() => {});
    }
  }
}

// ── Shared Tasks ─────────────────────────────────────────────────────────────

export async function createSharedTask(
  objectiveId: string,
  title: string,
  assignedToUid: string
): Promise<SharedTask> {
  const profile = await getUserProfile(assignedToUid);
  const id = nanoid("stask");

  const task: SharedTask = {
    id,
    objective_id: objectiveId,
    title: title.trim(),
    assigned_user_id: assignedToUid,
    assigned_display_name: profile?.displayName ?? "Unknown",
    status: "not-started",
    created_at: serverTimestamp(),
  };

  await setDoc(doc(db, "sharedTasks", id), task);
  return task;
}

export async function getSharedTasksForObjective(
  objectiveId: string
): Promise<SharedTask[]> {
  const q = query(
    collection(db, "sharedTasks"),
    where("objective_id", "==", objectiveId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SharedTask);
}

export async function updateSharedTaskStatus(
  taskId: string,
  status: SharedTaskStatus
): Promise<void> {
  await updateDoc(doc(db, "sharedTasks", taskId), { status });
}

// ── Shared Events ─────────────────────────────────────────────────────────────

export async function createSharedEvent(
  title: string,
  date: string,
  participantUids: string[]
): Promise<SharedEvent> {
  const uid = requireUid();
  const uniqueParticipants = participantUids.filter((u) => u !== uid);
  const creatorProfile = await getUserProfile(uid);

  const id = nanoid("sevt");
  const event: SharedEvent = {
    id,
    title: title.trim(),
    date,
    creator_id: uid,
    creator_name: creatorProfile?.displayName ?? "Unknown",
    participantUids: [uid],
    participants: [{ uid, displayName: creatorProfile?.displayName ?? "Unknown" }],
    created_at: serverTimestamp(),
  };

  await setDoc(doc(db, "sharedEvents", id), event);

  // Send invites to each participant — they must accept before being added
  if (uniqueParticipants.length > 0) {
    await sendSharedInvites("event", id, title.trim(), uniqueParticipants, date);
  }

  return event;
}

export async function getMySharedEvents(): Promise<SharedEvent[]> {
  const uid = requireUid();
  const q = query(
    collection(db, "sharedEvents"),
    where("participantUids", "array-contains", uid)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SharedEvent);
}

// ── Shared Invites ────────────────────────────────────────────────────────────

export async function sendSharedInvites(
  type: SharedInviteType,
  refId: string,
  title: string,
  inviteeUids: string[],
  date?: string
): Promise<void> {
  const uid = requireUid();
  const profile = await getUserProfile(uid);
  const fromName = profile?.displayName ?? "Unknown";
  const batch = writeBatch(db);
  for (const toUid of inviteeUids) {
    if (toUid === uid) continue;
    const inviteId = nanoid("sinv");
    const invite: SharedInvite = {
      id: inviteId,
      type,
      refId,
      title,
      fromUid: uid,
      fromName,
      toUid,
      status: "pending",
      created_at: serverTimestamp(),
      ...(date ? { date } : {}),
    };
    batch.set(doc(db, "sharedInvites", inviteId), invite);
  }
  await batch.commit();

  // Notify each invitee (fire-and-forget)
  const typeLabel = type === "event" ? "event" : "project";
  for (const toUid of inviteeUids) {
    if (toUid === uid) continue;
    sendPushNotif(toUid, "New invite", `${fromName} invited you to "${title}"`).catch(() => {});
  }
}

export async function getMySharedInvites(): Promise<SharedInvite[]> {
  const uid = requireUid();
  const q = query(
    collection(db, "sharedInvites"),
    where("toUid", "==", uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SharedInvite);
}

export async function acceptSharedInvite(invite: SharedInvite): Promise<void> {
  const uid = requireUid();
  const profile = await getUserProfile(uid);
  const displayName = profile?.displayName ?? "Unknown";
  const batch = writeBatch(db);

  // Mark invite as accepted
  batch.update(doc(db, "sharedInvites", invite.id), { status: "accepted" });

  // Add self to the shared doc using arrayUnion — avoids reading the doc first,
  // which would fail because the user isn't yet in memberUids/participantUids.
  if (invite.type === "objective") {
    batch.update(doc(db, "sharedObjectives", invite.refId), {
      memberUids: arrayUnion(uid),
      members: arrayUnion({ uid, role: "member", displayName }),
    });
  } else {
    batch.update(doc(db, "sharedEvents", invite.refId), {
      participantUids: arrayUnion(uid),
      participants: arrayUnion({ uid, displayName }),
    });
  }

  await batch.commit();

  // Notify the invite creator that someone accepted
  getUserProfile(uid)
    .then((p) => {
      if (p) {
        const typeLabel = invite.type === "event" ? "event" : "project";
        sendPushNotif(
          invite.fromUid,
          "Invite accepted ✅",
          `${p.displayName} joined "${invite.title}"`,
        ).catch(() => {});
      }
    })
    .catch(() => {});
}

export async function declineSharedInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, "sharedInvites", inviteId), { status: "declined" });
}

export async function leaveSharedEvent(eventId: string): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedEvents", eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const evt = snap.data() as SharedEvent;
  await updateDoc(ref, {
    participantUids: evt.participantUids.filter((u) => u !== uid),
    participants: evt.participants.filter((p) => p.uid !== uid),
  });
}

export async function kickParticipantFromEvent(eventId: string, targetUid: string): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedEvents", eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const evt = snap.data() as SharedEvent;
  if (evt.creator_id !== uid) throw new Error("Only the creator can kick participants.");
  await updateDoc(ref, {
    participantUids: evt.participantUids.filter((u) => u !== targetUid),
    participants: evt.participants.filter((p) => p.uid !== targetUid),
  });

  // Notify the removed participant
  sendPushNotif(targetUid, "Removed from event", `You've been removed from "${evt.title}".`).catch(() => {});
}

export async function setHideParticipants(eventId: string, hide: boolean): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedEvents", eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const evt = snap.data() as SharedEvent;
  if (evt.creator_id !== uid) throw new Error("Only the creator can change participant visibility.");
  await updateDoc(ref, { hideParticipants: hide });
}

export async function leaveSharedObjective(objectiveId: string): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedObjectives", objectiveId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const obj = snap.data() as SharedObjective;
  await updateDoc(ref, {
    memberUids: obj.memberUids.filter((u) => u !== uid),
    members: obj.members.filter((m) => m.uid !== uid),
  });
}

export async function kickMemberFromObjective(objectiveId: string, targetUid: string): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedObjectives", objectiveId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const obj = snap.data() as SharedObjective;
  if (obj.owner_id !== uid) throw new Error("Only the host can remove members.");
  await updateDoc(ref, {
    memberUids: obj.memberUids.filter((u) => u !== targetUid),
    members: obj.members.filter((m) => m.uid !== targetUid),
  });

  // Notify the removed member
  sendPushNotif(targetUid, "Removed from project", `You've been removed from "${obj.title}".`).catch(() => {});
}

export async function setHideObjectiveMembers(objectiveId: string, hide: boolean): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedObjectives", objectiveId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const obj = snap.data() as SharedObjective;
  if (obj.owner_id !== uid) throw new Error("Only the host can change member visibility.");
  await updateDoc(ref, { hideMembers: hide });
}

export async function updateSharedObjective(
  objectiveId: string,
  updates: { title?: string; description?: string; deadline?: string; objectiveType?: string }
): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedObjectives", objectiveId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Objective not found.");
  const obj = snap.data() as SharedObjective;
  if (obj.owner_id !== uid) throw new Error("Only the host can edit this objective.");
  await updateDoc(ref, updates);
}

export async function updateSharedEvent(eventId: string, updates: { title?: string; date?: string }): Promise<void> {
  const uid = requireUid();
  const ref = doc(db, "sharedEvents", eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const evt = snap.data() as SharedEvent;
  if (evt.creator_id !== uid) throw new Error("Only the host can update this event.");
  await updateDoc(ref, updates);
}
