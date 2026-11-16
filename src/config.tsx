import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AdminSettings } from "./types";
import {
  DEFAULT_FRAME_MODERN_BLUE,
  DEFAULT_FRAME_EMERALD_GOLD,
  DEFAULT_SPONSOR_1,
  DEFAULT_SPONSOR_2,
  DEFAULT_GAME_PLAYER,
  DEFAULT_GOOD_ITEM,
  DEFAULT_BAD_ITEM,
} from "./utils/defaultAssets";
import { fetchKioskConfigFromCloud } from "./services/cloudService";

const defaultSettings: AdminSettings = {
  kioskId: "default-kiosk",
  kioskMode: "GAME_AND_PHOTO",
  photoOnlyAskName: false,
  brandName: "VISIONPLAY",
  primaryColor: "#3b82f6",
  secondaryColor: "#10b981",
  brandLogoUrl: "",
  shotsCount: 3,
  orientation: "PORTRAIT",
  printLayout: "2X6_3_PHOTO",
  framesUrls: [DEFAULT_FRAME_MODERN_BLUE, DEFAULT_FRAME_EMERALD_GOLD],
  sponsorsUrls: [DEFAULT_SPONSOR_1, DEFAULT_SPONSOR_2],
  donationAccountName: "",
  donationAccountNumber: "",
  donationPromptPayQR: "",
  enableHardwarePrint: true,
  isMuted: false,
  selectedCameraId: "",
  showHandSkeleton: false,
  gamePlayerUrl: DEFAULT_GAME_PLAYER,
  gamePlayerHappyUrl: "",
  gamePlayerDizzyUrl: "",
  gamePlayerHungryUrl: "",
  gameGoodItemsUrls: [DEFAULT_GOOD_ITEM],
  gameBadItemsUrls: [DEFAULT_BAD_ITEM],
  imgbbApiKey: "",
  backupApiKey: "",
  fallbackStorageMode: "auto",
  clientThrottleMs: 600,
  printFrameLayer: "FRONT",
  customStartButtonUrl: "",
  targetPrinterName: "",
  shareScreenBackgroundUrl: "",
  sponsorLogoUrl: "",
  showSponsorLogo: true,
  photoPrintBackgroundColor: "#ffffff",
  shareScreenBackgroundColor: "#090d16",
  photoPreviewContainerColor: "#111827",
  cameraEnabled: true,
  screensaverEnabled: false,
  screensaverVideos: [""],
  idleResetSeconds: 45,
  adminPin: "1234",
};

const STORAGE_KEY = "kiosk_admin_settings_v2";

const getInitialSettings = (): AdminSettings => {
  try {
    const saved =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem("kiosk_admin_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old fragile placeholder URLs if still lingering
      const frames =
        Array.isArray(parsed.framesUrls) &&
        parsed.framesUrls.length > 0 &&
        !String(parsed.framesUrls[0]).includes("placehold.co")
          ? parsed.framesUrls
          : defaultSettings.framesUrls;

      const sponsors =
        Array.isArray(parsed.sponsorsUrls) &&
        parsed.sponsorsUrls.length > 0 &&
        !String(parsed.sponsorsUrls[0]).includes("placehold.co")
          ? parsed.sponsorsUrls
          : defaultSettings.sponsorsUrls;

      return {
        ...defaultSettings,
        ...parsed,
        framesUrls: frames,
        sponsorsUrls: sponsors,
      };
    }
  } catch {
    // ignore corrupted localStorage
  }
  return defaultSettings;
};

interface SettingsContextType {
  settings: AdminSettings;
  updateSettings: (newSettings: Partial<AdminSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AdminSettings>(getInitialSettings);

  const updateSettings = (newSettings: Partial<AdminSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage quota
      }
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("kiosk_admin_settings");
  };

  // Optional ?kiosk=<kioskId> auto-sync from Firestore on startup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kioskParam = params.get("kiosk");
    if (!kioskParam) return;

    fetchKioskConfigFromCloud(kioskParam)
      .then((cloudConfig) => {
        if (cloudConfig) {
          updateSettings(cloudConfig);
        }
      })
      .catch((err) => {
        console.warn("Could not load cloud kiosk config:", err);
      });
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
