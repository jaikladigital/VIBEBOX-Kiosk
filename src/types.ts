export type GameState =
  | "START"
  | "PLAYING"
  | "GAMEOVER_SCREEN"
  | "FRAME_SELECT"
  | "TAKING_PHOTOS"
  | "PROCESSING_PHOTOS"
  | "SHARE"
  | "ADMIN";

export type KioskMode = "GAME_AND_PHOTO" | "PHOTO_ONLY";

export type FallbackStorageMode = "auto" | "imgbb_only";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  level?: number;
  createdAt?: string;
}

export interface AdminSettings {
  kioskId: string;
  kioskMode: KioskMode;
  photoOnlyAskName: boolean;
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  brandLogoUrl: string;
  shotsCount: number;
  orientation: "PORTRAIT" | "LANDSCAPE";
  printLayout:
    | "2X6_3_PHOTO"
    | "2X6_4_PHOTO"
    | "4X6_6_PHOTO"
    | "4X6_PORTRAIT_SINGLE"
    | "4X6_LANDSCAPE_SINGLE"
    | "4X6_TRIPLE"
    | "4X6_3_PHOTO_A"
    | "4X6_3_PHOTO_B"
    | "4X6_4_PHOTO"
    | "4X6_2_PHOTO_A"
    | "4X6_2_PHOTO_B";
  framesUrls: string[];
  sponsorsUrls: string[];
  donationAccountName: string;
  donationAccountNumber: string;
  donationPromptPayQR: string;
  enableHardwarePrint: boolean;
  isMuted: boolean;
  selectedCameraId: string;
  showHandSkeleton: boolean;
  gamePlayerUrl: string;
  gamePlayerHappyUrl: string;
  gamePlayerDizzyUrl: string;
  gamePlayerHungryUrl: string;
  gameGoodItemsUrls: string[];
  gameBadItemsUrls: string[];
  imgbbApiKey: string;
  backupApiKey: string;
  fallbackStorageMode: FallbackStorageMode;
  clientThrottleMs: number;
  printFrameLayer: "FRONT" | "BACK";
  customStartButtonUrl: string;
  targetPrinterName: string;
  shareScreenBackgroundUrl: string;
  sponsorLogoUrl: string;
  showSponsorLogo: boolean;
  photoPrintBackgroundColor: string;
  shareScreenBackgroundColor: string;
  photoPreviewContainerColor: string;
  cameraEnabled: boolean;
  screensaverEnabled: boolean;
  screensaverVideos: string[];
  idleResetSeconds: number;
  adminPin: string;
}
