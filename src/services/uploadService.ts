import { auth } from "../firebase";
import { FallbackStorageMode } from "../types";
import { compressDataUrlForCloud } from "../utils/imageProcess";
import { saveSharedPhotoToCloud } from "./cloudService";

export type UploadProviderType =
  | "imgbb"
  | "backup_key"
  | "freeimage"
  | "cloud_fallback"
  | "local_only";

export interface UploadOptions {
  imgbbApiKey: string;
  backupApiKey?: string;
  fallbackMode: FallbackStorageMode;
  throttleBaseMs?: number;
  kioskId: string;
  brandName: string;
  onProgress?: (statusText: string, stage: "queue" | "uploading" | "fallback" | "done") => void;
}

export interface UploadResult {
  url: string;
  qrShareUrl: string;
  provider: UploadProviderType;
  photoId?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanBase64(dataUrl: string): string {
  const parts = dataUrl.split(",");
  return parts.length > 1 ? parts[1] : dataUrl;
}

async function uploadToImgBB(
  base64Image: string,
  apiKey: string,
  timeoutMs = 9000,
): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("image", base64Image);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey.trim())}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 429) {
      throw new Error("RATE_LIMIT_429");
    }
    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }

    const body = await res.json();
    if (body?.success && body?.data?.url) {
      return body.data.url as string;
    }
    throw new Error(body?.error?.message || "ImgBB upload rejected");
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function uploadToFreeImage(
  base64Image: string,
  timeoutMs = 9000,
): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("key", "6d207e02198a847aa98d0a2a901485a5");
  formData.append("action", "upload");
  formData.append("source", base64Image);
  formData.append("format", "json");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://freeimage.host/api/1/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`FreeImage HTTP_${res.status}`);
    }

    const body = await res.json();
    if (body?.status_code === 200 && body?.image?.url) {
      return body.image.url as string;
    }
    throw new Error("FreeImage upload rejected");
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function buildPublicShareBaseUrl(): string {
  let currentUrl = window.location.origin + window.location.pathname;
  if (currentUrl.includes("ais-dev-")) {
    currentUrl = currentUrl.replace("ais-dev-", "ais-pre-");
  }
  return currentUrl;
}

export async function uploadPhotoWithFallback(
  dataUrl: string,
  options: UploadOptions,
): Promise<UploadResult> {
  const {
    imgbbApiKey,
    backupApiKey,
    fallbackMode,
    throttleBaseMs = 600,
    kioskId,
    brandName,
    onProgress,
  } = options;

  const base64Clean = cleanBase64(dataUrl);
  const shareBase = buildPublicShareBaseUrl();

  // Client-side Jitter/Throttle to desynchronize multi-kiosk bursts
  const baseDelay = Math.max(250, Math.min(3000, throttleBaseMs));
  const jitterMs = baseDelay + Math.floor(Math.random() * 500);
  onProgress?.("กำลังเตรียมอัปโหลดภาพ (จัดคิวป้องกันทราฟฟิกชนกัน)...", "queue");
  await sleep(jitterMs);

  let uploadedUrl = "";
  let usedProvider: UploadProviderType = "local_only";

  // Tier 1: Primary ImgBB Key with 429 retry
  if (imgbbApiKey && imgbbApiKey.trim().length > 8) {
    onProgress?.("กำลังอัปโหลดภาพไปยัง ImgBB Cloud...", "uploading");
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        uploadedUrl = await uploadToImgBB(base64Clean, imgbbApiKey);
        usedProvider = "imgbb";
        break;
      } catch (err: any) {
        const isRateLimit =
          err?.message === "RATE_LIMIT_429" || String(err?.message).includes("429");
        if (isRateLimit && attempt === 1) {
          onProgress?.("ทราฟฟิกหนาแน่น กำลังลองใหม่อัตโนมัติ...", "queue");
          await sleep(1400);
          continue;
        }
        break;
      }
    }
  }

  // Tier 2: Backup ImgBB Key
  if (
    !uploadedUrl &&
    fallbackMode !== "imgbb_only" &&
    backupApiKey &&
    backupApiKey.trim().length > 8 &&
    backupApiKey.trim() !== imgbbApiKey.trim()
  ) {
    onProgress?.("กำลังสลับใช้ ImgBB Key สำรอง...", "fallback");
    try {
      uploadedUrl = await uploadToImgBB(base64Clean, backupApiKey);
      usedProvider = "backup_key";
    } catch {
      // Proceed to Tier 3
    }
  }

  // Tier 3: FreeImage CDN Fallback
  if (!uploadedUrl && fallbackMode !== "imgbb_only") {
    onProgress?.("กำลังสลับไปยังระบบ CDN สำรอง...", "fallback");
    try {
      uploadedUrl = await uploadToFreeImage(base64Clean);
      usedProvider = "freeimage";
    } catch {
      // Proceed to Tier 4
    }
  }

  // Tier 4: Firebase Firestore Backup (when operator signed in & verified)
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.emailVerified) {
    try {
      if (uploadedUrl) {
        const photoId = await saveSharedPhotoToCloud(
          kioskId,
          currentUser.uid,
          uploadedUrl,
          usedProvider as "imgbb" | "backup_key" | "freeimage",
          brandName,
        );
        onProgress?.("อัปโหลดและบันทึกข้อมูลสำเร็จ!", "done");
        return {
          url: uploadedUrl,
          qrShareUrl: `${shareBase}?photoId=${encodeURIComponent(photoId)}`,
          provider: usedProvider,
          photoId,
        };
      } else if (fallbackMode !== "imgbb_only") {
        onProgress?.("กำลังบันทึกลง Cloud Database สำรอง...", "fallback");
        const compressed = await compressDataUrlForCloud(dataUrl, 680000);
        const photoId = await saveSharedPhotoToCloud(
          kioskId,
          currentUser.uid,
          compressed,
          "cloud_fallback",
          brandName,
        );
        onProgress?.("บันทึกภาพสำรองบน Cloud สำเร็จ!", "done");
        return {
          url: compressed,
          qrShareUrl: `${shareBase}?photoId=${encodeURIComponent(photoId)}`,
          provider: "cloud_fallback",
          photoId,
        };
      }
    } catch (cloudErr) {
      console.warn("Cloud photo record fallback skipped:", cloudErr);
    }
  }

  if (uploadedUrl) {
    onProgress?.("อัปโหลดสำเร็จ! พร้อมสแกน QR Code", "done");
    return {
      url: uploadedUrl,
      qrShareUrl: `${shareBase}?image=${encodeURIComponent(uploadedUrl)}`,
      provider: usedProvider,
    };
  }

  // Tier 5: Local Kiosk Direct Mode (Print / Download on device)
  onProgress?.("บันทึกภาพในเครื่อง Kiosk เรียบร้อย (พร้อมพิมพ์/ดาวน์โหลด)", "done");
  return {
    url: dataUrl,
    qrShareUrl: "",
    provider: "local_only",
  };
}

export async function testImgBBConnection(
  apiKey: string,
): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const key = (apiKey || "").trim();
  if (!key) {
    return { ok: false, message: "กรุณาระบุ ImgBB API Key ก่อนทดสอบ", latencyMs: 0 };
  }

  // 1x1 transparent pixel PNG base64
  const tinyPixel =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const start = performance.now();

  try {
    const url = await uploadToImgBB(tinyPixel, key, 8000);
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: Boolean(url),
      message: `เชื่อมต่อ ImgBB สำเร็จ (${latencyMs} ms)`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: false,
      message: `ทดสอบไม่ผ่าน: ${err?.message || "Connection failed"}`,
      latencyMs,
    };
  }
}
