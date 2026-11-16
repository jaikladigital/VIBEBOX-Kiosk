import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from "../firebase";
import { AdminSettings, LeaderboardEntry } from "../types";

export function sanitizeFirestoreId(raw: string, fallback = "default-kiosk"): string {
  const cleaned = (raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : fallback;
}

export async function signInAdminWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

function sanitizeUrlList(urls: string[] | undefined): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u) => typeof u === "string" && u.startsWith("http") && u.length <= 500)
    .slice(0, 10);
}

export async function syncKioskConfigToCloud(
  rawKioskId: string,
  settings: AdminSettings,
  ownerUid: string,
): Promise<string> {
  const kioskId = sanitizeFirestoreId(rawKioskId);
  const path = `kiosk_configs/${kioskId}`;
  const docRef = doc(db, "kiosk_configs", kioskId);

  try {
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;

    const payload: Record<string, unknown> = {
      ownerUid: sanitizeFirestoreId(ownerUid, ownerUid),
      kioskName: (settings.brandName || "VisionPlay Kiosk").trim().slice(0, 80) || "VisionPlay Kiosk",
      kioskMode: settings.kioskMode === "PHOTO_ONLY" ? "PHOTO_ONLY" : "GAME_AND_PHOTO",
      brandName: (settings.brandName || "VISIONPLAY").trim().slice(0, 80) || "VISIONPLAY",
      primaryColor: (settings.primaryColor || "#3b82f6").slice(0, 20),
      secondaryColor: (settings.secondaryColor || "#10b981").slice(0, 20),
      shotsCount: Math.min(6, Math.max(1, Number(settings.shotsCount) || 3)),
      orientation: settings.orientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT",
      printLayout: (settings.printLayout || "2X6_3_PHOTO").slice(0, 40),
      printFrameLayer: settings.printFrameLayer === "BACK" ? "BACK" : "FRONT",
      framesUrls: sanitizeUrlList(settings.framesUrls),
      sponsorsUrls: sanitizeUrlList(settings.sponsorsUrls),
      showHandSkeleton: Boolean(settings.showHandSkeleton),
      idleResetSeconds: Math.min(600, Math.max(10, Number(settings.idleResetSeconds) || 45)),
      enableHardwarePrint: Boolean(settings.enableHardwarePrint),
      photoPrintBackgroundColor: (settings.photoPrintBackgroundColor || "#ffffff").slice(0, 20),
      shareScreenBackgroundColor: (settings.shareScreenBackgroundColor || "#090d16").slice(0, 20),
      photoPreviewContainerColor: (settings.photoPreviewContainerColor || "#111827").slice(0, 20),
      shareScreenBackgroundUrl: (settings.shareScreenBackgroundUrl || "").slice(0, 500),
      sponsorLogoUrl: (settings.sponsorLogoUrl || "").slice(0, 500),
      showSponsorLogo: Boolean(settings.showSponsorLogo),
      customStartButtonUrl: (settings.customStartButtonUrl || "").slice(0, 500),
      createdAt: existingData?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, payload);
    return kioskId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      path,
    );
  }
}

export async function fetchKioskConfigFromCloud(
  rawKioskId: string,
): Promise<Partial<AdminSettings> | null> {
  const kioskId = sanitizeFirestoreId(rawKioskId);
  const path = `kiosk_configs/${kioskId}`;
  try {
    const snap = await getDoc(doc(db, "kiosk_configs", kioskId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const result: Partial<AdminSettings> = {
      kioskId,
      kioskMode: data.kioskMode === "PHOTO_ONLY" ? "PHOTO_ONLY" : "GAME_AND_PHOTO",
      brandName: data.brandName,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      shotsCount: data.shotsCount,
      orientation: data.orientation,
      printLayout: data.printLayout,
      printFrameLayer: data.printFrameLayer,
      showHandSkeleton: data.showHandSkeleton,
      idleResetSeconds: data.idleResetSeconds,
      enableHardwarePrint: data.enableHardwarePrint,
      photoPrintBackgroundColor: data.photoPrintBackgroundColor,
      shareScreenBackgroundColor: data.shareScreenBackgroundColor,
      photoPreviewContainerColor: data.photoPreviewContainerColor,
      shareScreenBackgroundUrl: data.shareScreenBackgroundUrl,
      sponsorLogoUrl: data.sponsorLogoUrl,
      showSponsorLogo: data.showSponsorLogo,
      customStartButtonUrl: data.customStartButtonUrl,
    };
    if (Array.isArray(data.framesUrls) && data.framesUrls.length > 0) {
      result.framesUrls = data.framesUrls;
    }
    if (Array.isArray(data.sponsorsUrls) && data.sponsorsUrls.length > 0) {
      result.sponsorsUrls = data.sponsorsUrls;
    }
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeCloudLeaderboard(
  rawKioskId: string,
  ownerUid: string,
  onData: (entries: LeaderboardEntry[]) => void,
) {
  const kioskId = sanitizeFirestoreId(rawKioskId);
  const path = `kiosk_configs/${kioskId}/scores`;
  const q = query(
    collection(db, "kiosk_configs", kioskId, "scores"),
    where("ownerUid", "==", ownerUid),
    orderBy("score", "desc"),
    limit(10),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: LeaderboardEntry[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.playerName || "PLAYER"),
          score: Number(data.score || 0),
          level: Number(data.level || 1),
        };
      });
      onData(entries);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function recordCloudScore(
  rawKioskId: string,
  ownerUid: string,
  settings: AdminSettings,
  playerName: string,
  score: number,
  level: number,
): Promise<void> {
  const kioskId = sanitizeFirestoreId(rawKioskId);
  const scoreId = `score_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `kiosk_configs/${kioskId}/scores/${scoreId}`;

  try {
    // Ensure parent kiosk config exists for Master Gate rule validation
    const parentRef = doc(db, "kiosk_configs", kioskId);
    const parentSnap = await getDoc(parentRef);
    if (!parentSnap.exists()) {
      await syncKioskConfigToCloud(kioskId, settings, ownerUid);
    }

    await setDoc(doc(db, "kiosk_configs", kioskId, "scores", scoreId), {
      kioskId,
      ownerUid: sanitizeFirestoreId(ownerUid, ownerUid),
      playerName: (playerName || "PLAYER").trim().slice(0, 20) || "PLAYER",
      score: Math.min(1000000, Math.max(0, Math.floor(Number(score) || 0))),
      level: Math.min(1000, Math.max(1, Math.floor(Number(level) || 1))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function clearCloudLeaderboard(
  rawKioskId: string,
  ownerUid: string,
): Promise<void> {
  const kioskId = sanitizeFirestoreId(rawKioskId);
  const path = `kiosk_configs/${kioskId}/scores`;

  try {
    const q = query(
      collection(db, "kiosk_configs", kioskId, "scores"),
      where("ownerUid", "==", ownerUid),
      limit(100),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSharedPhotoToCloud(
  rawKioskId: string,
  ownerUid: string,
  imageUrl: string,
  provider: "imgbb" | "backup_key" | "freeimage" | "cloud_fallback",
  brandName: string,
): Promise<string> {
  const kioskId = sanitizeFirestoreId(rawKioskId);
  const photoId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `shared_photos/${photoId}`;

  if (imageUrl.length > 790000) {
    throw new Error("Image payload exceeds cloud share limit");
  }

  try {
    await setDoc(doc(db, "shared_photos", photoId), {
      ownerUid: sanitizeFirestoreId(ownerUid, ownerUid),
      kioskId,
      imageUrl,
      provider,
      brandName: (brandName || "VISIONPLAY").trim().slice(0, 80) || "VISIONPLAY",
      createdAt: serverTimestamp(),
    });
    return photoId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchSharedPhotoFromCloud(
  rawPhotoId: string,
): Promise<{ imageUrl: string; brandName: string } | null> {
  const photoId = sanitizeFirestoreId(rawPhotoId, "");
  if (!photoId) return null;
  const path = `shared_photos/${photoId}`;
  try {
    const snap = await getDoc(doc(db, "shared_photos", photoId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      imageUrl: String(data.imageUrl || ""),
      brandName: String(data.brandName || "VISIONPLAY"),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function deleteSharedPhotoFromCloud(photoId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(photoId, "");
  if (!safeId) return;
  const path = `shared_photos/${safeId}`;
  try {
    await deleteDoc(doc(db, "shared_photos", safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
