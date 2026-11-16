import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { SettingsProvider, useSettings } from "./config";
import { CameraProvider, useCamera } from "./contexts/CameraContext";
import {
  Camera,
  Trophy,
  Play,
  QrCode,
  Image as ImageIcon,
  CheckCircle,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Delete,
  Share2,
  Settings,
  Lock,
  Sparkles,
} from "lucide-react";
import { GameState, LeaderboardEntry } from "./types";
import { CameraBackground } from "./components/CameraBackground";
import { FallingGame } from "./components/FallingGame";
import { TouchlessButton } from "./components/TouchlessButton";
import { HandTracker } from "./components/HandTracker";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "react-qr-code";
import {
  uploadPhotoWithFallback,
  UploadProviderType,
} from "./services/uploadService";
import {
  subscribeAuthState,
  subscribeCloudLeaderboard,
  recordCloudScore,
  clearCloudLeaderboard,
  fetchSharedPhotoFromCloud,
} from "./services/cloudService";
import { generatePhotoPrint } from "./utils/imageProcess";
import { playSound } from "./utils/audio";
import { User } from "firebase/auth";

const AdminPanel = lazy(() =>
  import("./components/AdminPanel").then((m) => ({ default: m.AdminPanel })),
);

const initialLeaderboard: LeaderboardEntry[] = [
  { id: "1", name: "JAIKLA", score: 1250 },
  { id: "2", name: "PLAYER ONE", score: 900 },
  { id: "3", name: "NEO", score: 850 },
];

const KEYBOARD_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M", "-", "_"],
  ["😀", "😍", "❤️", "✨", "🎉", "🎮", "🌟", "👽"],
];

function MainGame() {
  const { settings, updateSettings } = useSettings();
  const [gameState, setGameState] = useState<GameState>("START");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try {
      const saved = localStorage.getItem("kiosk_leaderboard");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return initialLeaderboard;
  });
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [inputName, setInputName] = useState("");
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const [finalImageUrl, setFinalImageUrl] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [uploadStatusText, setUploadStatusText] = useState<string>(
    "กำลังจัดวางภาพและสร้างกรอบ...",
  );
  const [uploadProvider, setUploadProvider] =
    useState<UploadProviderType>("local_only");

  // PIN Lock Modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAttempt, setPinAttempt] = useState("");
  const [pinError, setPinError] = useState(false);

  // Idle Auto-Reset countdown
  const idleLimit = Math.max(15, settings.idleResetSeconds || 45);
  const [idleRemaining, setIdleRemaining] = useState<number>(idleLimit);

  // Subscribe to Firebase Auth & Cloud Leaderboard when signed in
  useEffect(() => {
    const unsub = subscribeAuthState((user) => {
      setCloudUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!cloudUser || !cloudUser.emailVerified) return;
    let unsubLeaderboard: (() => void) | undefined;
    try {
      unsubLeaderboard = subscribeCloudLeaderboard(
        settings.kioskId || "default-kiosk",
        cloudUser.uid,
        (entries) => {
          setLeaderboard(entries);
          try {
            localStorage.setItem("kiosk_leaderboard", JSON.stringify(entries));
          } catch {
            // ignore
          }
        },
      );
    } catch (err) {
      console.warn("Cloud leaderboard subscription fallback to local:", err);
    }
    return () => {
      if (unsubLeaderboard) unsubLeaderboard();
    };
  }, [cloudUser, settings.kioskId]);

  const openAdminWithPinCheck = useCallback(() => {
    const requiredPin = (settings.adminPin || "").trim();
    if (!requiredPin) {
      setGameState("ADMIN");
      return;
    }
    setPinAttempt("");
    setPinError(false);
    setShowPinModal(true);
  }, [settings.adminPin]);

  const submitPin = useCallback(
    (code: string) => {
      const requiredPin = (settings.adminPin || "").trim();
      if (code === requiredPin) {
        setShowPinModal(false);
        setPinAttempt("");
        setPinError(false);
        setGameState("ADMIN");
      } else {
        setPinError(true);
        setPinAttempt("");
      }
    },
    [settings.adminPin],
  );

  // F12 Admin Override, F8 Toggle Camera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        if (gameState === "ADMIN") {
          setGameState("START");
        } else {
          openAdminWithPinCheck();
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        updateSettings({ cameraEnabled: !settings.cameraEnabled });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    settings.cameraEnabled,
    updateSettings,
    gameState,
    openAdminWithPinCheck,
  ]);

  // Idle Auto-Reset timer on interactive post-game / share screens
  useEffect(() => {
    const idleStates: GameState[] = [
      "GAMEOVER_SCREEN",
      "FRAME_SELECT",
      "SHARE",
    ];
    if (!idleStates.includes(gameState)) {
      setIdleRemaining(idleLimit);
      return;
    }

    setIdleRemaining(idleLimit);

    const resetActivity = () => setIdleRemaining(idleLimit);
    window.addEventListener("pointerdown", resetActivity);
    window.addEventListener("pointermove", resetActivity);
    window.addEventListener("keydown", resetActivity);
    window.addEventListener("kiosk-activity", resetActivity);

    const tick = setInterval(() => {
      setIdleRemaining((prev) => {
        if (prev <= 1) {
          setInputName("");
          setFinalImageUrl("");
          setQrCodeUrl("");
          setGameState("START");
          return idleLimit;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(tick);
      window.removeEventListener("pointerdown", resetActivity);
      window.removeEventListener("pointermove", resetActivity);
      window.removeEventListener("keydown", resetActivity);
      window.removeEventListener("kiosk-activity", resetActivity);
    };
  }, [gameState, idleLimit]);

  const handleStartExperience = () => {
    setInputName("");
    setFinalImageUrl("");
    setQrCodeUrl("");
    setSelectedFrameIdx(0);

    if (settings.kioskMode === "PHOTO_ONLY") {
      if (settings.photoOnlyAskName) {
        setCurrentScore(0);
        setCurrentLevel(1);
        setGameState("GAMEOVER_SCREEN");
      } else {
        setGameState("FRAME_SELECT");
      }
    } else {
      setGameState("PLAYING");
    }
  };

  const handleGameOver = ({
    score,
    level,
  }: {
    score: number;
    level: number;
  }) => {
    setCurrentScore(score);
    setCurrentLevel(level);
    setGameState("GAMEOVER_SCREEN");
  };

  const handleKeyboardClick = (char: string) => {
    if (inputName.length < 15) setInputName((prev) => prev + char);
  };
  const handleBackspace = () => setInputName((prev) => prev.slice(0, -1));

  const saveScoreAndProceed = (name: string) => {
    const isPhotoOnly = settings.kioskMode === "PHOTO_ONLY";
    const cleaned = name.trim().toUpperCase();

    if (isPhotoOnly) {
      setInputName(cleaned);
      setGameState("FRAME_SELECT");
      return;
    }

    const finalName =
      cleaned === "" ? `PLAYER_${Math.floor(Math.random() * 999)}` : cleaned;

    setLeaderboard((prev) => {
      const newList = [
        ...prev,
        {
          id: Date.now().toString(),
          name: finalName,
          score: currentScore,
          level: currentLevel,
        },
      ];
      const sorted = newList.sort((a, b) => b.score - a.score).slice(0, 10);
      try {
        localStorage.setItem("kiosk_leaderboard", JSON.stringify(sorted));
      } catch {
        // ignore
      }
      return sorted;
    });

    if (cloudUser && cloudUser.emailVerified) {
      recordCloudScore(
        settings.kioskId || "default-kiosk",
        cloudUser.uid,
        settings,
        finalName,
        currentScore,
        currentLevel,
      ).catch((err) => console.warn("Cloud score save failed:", err));
    }

    setInputName(finalName);
    setGameState("FRAME_SELECT");
  };

  const handleFinishPhotos = useCallback(
    async (photos: string[]) => {
      setGameState("PROCESSING_PHOTOS");
      setUploadStatusText("กำลังจัดวางองค์ประกอบภาพและกรอบรูป...");

      const isPhotoOnly = settings.kioskMode === "PHOTO_ONLY";

      const printData = await generatePhotoPrint(
        photos,
        (settings.framesUrls || [])[selectedFrameIdx] || "",
        settings,
        isPhotoOnly ? null : currentScore,
        inputName,
        isPhotoOnly,
      );
      setFinalImageUrl(printData);

      try {
        const result = await uploadPhotoWithFallback(printData, {
          imgbbApiKey: settings.imgbbApiKey,
          backupApiKey: settings.backupApiKey,
          fallbackMode: settings.fallbackStorageMode || "auto",
          throttleBaseMs: settings.clientThrottleMs || 600,
          kioskId: settings.kioskId || "default-kiosk",
          brandName: settings.brandName || "VISIONPLAY",
          onProgress: (text) => setUploadStatusText(text),
        });
        setQrCodeUrl(result.qrShareUrl);
        setUploadProvider(result.provider);
      } catch (err) {
        console.error("Photo upload pipeline error:", err);
        setQrCodeUrl("");
        setUploadProvider("local_only");
      }

      setGameState("SHARE");
    },
    [settings, selectedFrameIdx, currentScore, inputName],
  );

  const handleClearLeaderboard = () => {
    setLeaderboard([]);
    localStorage.setItem("kiosk_leaderboard", "[]");
    if (cloudUser && cloudUser.emailVerified) {
      clearCloudLeaderboard(
        settings.kioskId || "default-kiosk",
        cloudUser.uid,
      ).catch((err) => console.warn("Clear cloud leaderboard failed:", err));
    }
  };

  const renderScreen = () => {
    if (gameState === "ADMIN") {
      return (
        <Suspense
          fallback={
            <div className="absolute inset-0 z-[100] bg-slate-950 flex items-center justify-center text-slate-300 text-sm font-mono">
              Loading Admin Panel...
            </div>
          }
        >
          <AdminPanel
            onClose={() => setGameState("START")}
            onClearLeaderboard={handleClearLeaderboard}
          />
        </Suspense>
      );
    }

    const isLandscape = settings.orientation === "LANDSCAPE";
    const isPhotoOnly = settings.kioskMode === "PHOTO_ONLY";

    switch (gameState) {
      case "START":
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-20 flex ${
              isLandscape
                ? "flex-row items-center justify-around gap-10"
                : "flex-col justify-between"
            } py-8 sm:py-12 px-6 sm:px-10`}
          >
            {/* Top Utility Row */}
            <div
              className={`flex ${
                isLandscape
                  ? "absolute top-6 left-8 right-8"
                  : "justify-between"
              } items-start z-50`}
            >
              <div className="font-mono text-xs text-slate-400 tracking-wide pt-1">
                F8 กล้อง · F12 ตั้งค่า
                {isPhotoOnly ? " · Photo Booth Mode" : ""}
              </div>

              <div
                className={`flex flex-col gap-3 items-center z-50 ${
                  isLandscape ? "ml-auto" : ""
                }`}
              >
                <TouchlessButton
                  id="btn-sound-toggle"
                  onClick={() => updateSettings({ isMuted: !settings.isMuted })}
                  className="bg-slate-900/90 hover:bg-slate-800 text-white p-3.5 rounded-2xl border border-slate-700 shadow-lg transition-all"
                  title={settings.isMuted ? "เปิดเสียง" : "ปิดเสียง"}
                >
                  {settings.isMuted ? (
                    <VolumeX className="w-7 h-7 text-red-400" />
                  ) : (
                    <Volume2 className="w-7 h-7 text-emerald-400" />
                  )}
                </TouchlessButton>

                <TouchlessButton
                  id="btn-admin-panel"
                  onClick={openAdminWithPinCheck}
                  className="bg-slate-900/90 hover:bg-slate-800 text-white p-3.5 rounded-2xl border border-slate-700 shadow-lg transition-all group"
                  title="เข้าสู่ระบบหลังบ้าน (Admin Panel)"
                >
                  <Settings className="w-7 h-7 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
                </TouchlessButton>
              </div>
            </div>

            {/* Hero Start Card */}
            <div
              className={`flex flex-col justify-center items-center w-full my-6 ${
                isLandscape ? "flex-1 mt-16" : "flex-1"
              }`}
            >
              <div
                className={`relative bg-pattern-grid p-8 sm:p-12 w-full mx-auto rounded-[32px] backdrop-blur-xl border border-slate-700/80 shadow-2xl flex flex-col items-center text-center overflow-hidden ${
                  isLandscape ? "max-w-lg" : isPhotoOnly ? "max-w-xl" : "max-w-xl"
                }`}
                style={{ backgroundColor: `${settings.primaryColor}26` }}
              >
                <div
                  className="w-16 h-1.5 rounded-full mb-6"
                  style={{ backgroundColor: settings.primaryColor }}
                />

                <h1
                  className={`font-display font-black text-white uppercase mb-3 leading-tight w-full px-2 flex flex-col gap-1 ${
                    settings.brandName.length > 14
                      ? "text-3xl sm:text-5xl tracking-normal"
                      : "text-5xl sm:text-6xl tracking-wider"
                  }`}
                >
                  {settings.brandName}
                </h1>

                <p className="text-slate-200 text-lg sm:text-xl mb-10 font-medium">
                  {isPhotoOnly
                    ? "Touchless Event Photo Booth"
                    : "Interactive Game & Photo Kiosk"}
                </p>

                <TouchlessButton
                  onClick={handleStartExperience}
                  className={
                    settings.customStartButtonUrl
                      ? "w-full max-w-[460px] hover:scale-105 active:scale-95 transition-transform outline-none"
                      : "w-full relative group overflow-hidden text-white text-2xl sm:text-3xl font-bold py-6 sm:py-7 px-8 rounded-2xl flex items-center justify-center gap-4 transition-transform hover:scale-[1.02] active:scale-95 shadow-2xl"
                  }
                >
                  {settings.customStartButtonUrl ? (
                    <img
                      src={settings.customStartButtonUrl}
                      alt="Start Experience"
                      referrerPolicy="no-referrer"
                      className="w-full h-auto drop-shadow-2xl object-contain pointer-events-none"
                    />
                  ) : (
                    <>
                      <div
                        className="absolute inset-0 z-0"
                        style={{ backgroundColor: settings.primaryColor }}
                      />
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer z-0" />
                      {isPhotoOnly ? (
                        <Camera className="w-9 h-9 relative z-10 shrink-0" />
                      ) : (
                        <Play className="w-9 h-9 fill-current relative z-10 shrink-0" />
                      )}
                      <div className="flex flex-col items-start relative z-10 text-left">
                        <span className="tracking-wider font-display whitespace-nowrap">
                          {isPhotoOnly ? "START PHOTO SHOOT" : "START GAME"}
                        </span>
                        <span className="text-xs sm:text-sm font-normal text-white/85 mt-0.5">
                          จีบนิ้ว (Pinch) หรือชี้ค้างที่ปุ่มเพื่อเริ่ม
                        </span>
                      </div>
                    </>
                  )}
                </TouchlessButton>
              </div>
            </div>

            {/* Leaderboard (Shown in Game + Photo Mode) */}
            {!isPhotoOnly && (
              <div
                className={`w-full flex justify-center pb-4 ${
                  isLandscape ? "flex-1 mt-16" : ""
                }`}
              >
                <div className="w-full max-w-2xl bg-slate-900/90 bg-pattern-dots backdrop-blur-md rounded-3xl border border-slate-700/80 shadow-2xl p-6 sm:p-8 flex flex-col max-h-[420px]">
                  <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <Trophy className="w-8 h-8 text-amber-400" />
                      <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wider">
                        TOP RANKINGS
                      </h2>
                    </div>
                    {cloudUser && (
                      <span className="text-xs font-mono text-emerald-400">
                        Cloud Synced
                      </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto space-y-3 pr-1 w-full">
                    {leaderboard.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between px-4 py-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/50 min-w-0"
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <span
                            className={`text-2xl sm:text-3xl font-mono tabular-nums font-black w-8 text-center shrink-0 ${
                              idx === 0
                                ? "text-amber-400"
                                : idx === 1
                                  ? "text-slate-300"
                                  : idx === 2
                                    ? "text-amber-600"
                                    : "text-slate-500"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-lg sm:text-xl font-bold text-white uppercase truncate pr-2">
                            {entry.name}
                          </span>
                        </div>
                        <span className="text-xl sm:text-2xl font-mono tabular-nums text-emerald-400 font-bold shrink-0">
                          {entry.score}
                        </span>
                      </div>
                    ))}
                    {leaderboard.length === 0 && (
                      <div className="text-center text-slate-400 text-lg py-8 font-semibold">
                        NO SCORES YET. BE THE FIRST!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Clean Photo-Only Footer Hint */}
            {isPhotoOnly && (
              <div className="w-full text-center pb-4">
                <p className="text-sm text-slate-300 font-medium">
                  เลือกกรอบที่ถูกใจ ถ่ายภาพ {settings.shotsCount} ช็อต แล้วสแกน QR Code รับรูปทันที
                </p>
              </div>
            )}
          </motion.div>
        );

      case "PLAYING":
        return <FallingGame onGameOver={handleGameOver} />;

      case "GAMEOVER_SCREEN":
        return (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl px-4 py-6 overflow-hidden">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`bg-slate-900 bg-pattern-grid border border-slate-700/80 shadow-2xl p-6 sm:p-10 rounded-[30px] w-full ${
                isLandscape
                  ? "max-w-5xl flex flex-row items-center gap-8 lg:gap-12"
                  : "max-w-2xl flex flex-col justify-center gap-5"
              } max-h-[92vh] overflow-y-auto`}
            >
              <div className="flex flex-col items-center flex-1">
                {isPhotoOnly ? (
                  <Sparkles className="w-16 h-16 text-emerald-400 mb-3" />
                ) : (
                  <Trophy className="w-16 h-16 text-amber-400 mb-3" />
                )}

                <h2 className="text-3xl sm:text-5xl font-display font-black text-white mb-4 tracking-wider text-center">
                  {isPhotoOnly ? "YOUR NAME" : "GAME OVER"}
                </h2>

                {!isPhotoOnly && (
                  <div className="flex flex-row justify-center gap-8 mb-5 text-2xl sm:text-3xl font-mono tabular-nums font-bold bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 w-full max-w-sm">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-400 text-xs tracking-widest mb-1">
                        SCORE
                      </span>
                      <span style={{ color: settings.secondaryColor }}>
                        {currentScore}
                      </span>
                    </div>
                    <div className="w-px bg-slate-800" />
                    <div className="flex flex-col items-center">
                      <span className="text-slate-400 text-xs tracking-widest mb-1">
                        LEVEL
                      </span>
                      <span className="text-emerald-400">{currentLevel}</span>
                    </div>
                  </div>
                )}

                {!isLandscape && (
                  <div className="w-full max-w-sm mx-auto">
                    <input
                      type="text"
                      value={inputName}
                      readOnly
                      className="w-full bg-slate-950 border-2 border-slate-700 text-white text-3xl font-black px-4 py-4 rounded-2xl text-center tracking-widest pointer-events-none uppercase"
                      placeholder="ENTER NAME"
                    />
                  </div>
                )}
              </div>

              <div
                className={`space-y-4 flex-[1.4] w-full flex flex-col justify-end ${
                  isLandscape ? "max-w-lg mx-auto" : ""
                }`}
              >
                {isLandscape && (
                  <input
                    type="text"
                    value={inputName}
                    readOnly
                    className="w-full bg-slate-950 border-2 border-slate-700 text-white text-3xl font-black px-4 py-3.5 rounded-2xl text-center tracking-widest pointer-events-none uppercase"
                    placeholder="ENTER NAME"
                  />
                )}

                <div className="bg-slate-900/90 border border-slate-700/70 p-3 sm:p-4 rounded-2xl flex flex-col gap-1.5 shadow-xl w-full">
                  {KEYBOARD_ROWS.map((row, i) => (
                    <div
                      key={i}
                      className={`flex justify-center gap-1.5 w-full ${
                        i === 1 ? "px-[4%]" : ""
                      } ${i === 2 ? "px-[10%]" : ""}`}
                    >
                      {row.map((char) => (
                        <TouchlessButton
                          key={char}
                          onClick={() => handleKeyboardClick(char)}
                          className={`flex-1 bg-slate-800 text-slate-100 font-bold ${
                            isLandscape
                              ? "h-[46px] text-xl rounded-lg"
                              : "h-[52px] sm:h-[60px] text-xl sm:text-2xl rounded-xl"
                          } border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center max-w-[76px]`}
                        >
                          {char}
                        </TouchlessButton>
                      ))}
                    </div>
                  ))}
                  <div className="flex justify-center mt-1.5 px-[12%]">
                    <TouchlessButton
                      onClick={handleBackspace}
                      className="w-full h-[50px] bg-red-950/60 text-red-300 font-bold hover:bg-red-900/70 border border-red-900/60 rounded-xl flex items-center justify-center gap-2"
                    >
                      <Delete className="w-5 h-5" />
                      <span className="tracking-wider text-sm">DELETE</span>
                    </TouchlessButton>
                  </div>
                </div>

                <div className="flex flex-row gap-3 w-full">
                  <TouchlessButton
                    onClick={() => saveScoreAndProceed("")}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 text-lg rounded-2xl border border-slate-700"
                  >
                    SKIP
                  </TouchlessButton>
                  <TouchlessButton
                    onClick={() => saveScoreAndProceed(inputName)}
                    disabled={!inputName.trim()}
                    className="flex-[2] text-white font-bold py-4 text-xl rounded-2xl shadow-lg"
                    style={{ backgroundColor: settings.primaryColor }}
                  >
                    {isPhotoOnly ? "NEXT: CHOOSE FRAME" : "SAVE SCORE"}
                  </TouchlessButton>
                </div>
              </div>
            </motion.div>
          </div>
        );

      case "FRAME_SELECT": {
        const frames = settings.framesUrls?.length
          ? settings.framesUrls
          : [""];
        const safeIdx = selectedFrameIdx % frames.length;
        return (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 backdrop-blur-md px-4 sm:px-6">
            <div className="w-full max-w-4xl text-center flex flex-col items-center">
              <Camera
                className="w-14 sm:w-20 h-14 sm:h-20 mx-auto mb-3 sm:mb-5"
                style={{ color: settings.primaryColor }}
              />
              <h2 className="text-3xl sm:text-5xl font-display font-black text-white mb-6 sm:mb-10 tracking-wider">
                CHOOSE YOUR FRAME
              </h2>

              <div className="flex flex-row items-center justify-center gap-4 sm:gap-8 w-full px-2">
                <TouchlessButton
                  onClick={() =>
                    setSelectedFrameIdx((prev) =>
                      prev > 0 ? prev - 1 : frames.length - 1,
                    )
                  }
                  className="w-16 sm:w-24 h-16 sm:h-24 shrink-0 rounded-full bg-slate-800 border-2 border-slate-600 hover:border-slate-400 text-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
                >
                  <ChevronLeft className="w-9 sm:w-12 h-9 sm:h-12" />
                </TouchlessButton>

                <div
                  className="relative w-full max-w-[260px] sm:max-w-[380px] aspect-[2/3] rounded-[24px] overflow-hidden border-[6px] bg-slate-900 shadow-2xl shrink-0"
                  style={{ borderColor: settings.primaryColor }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-lg p-6 text-center">
                    Frame {safeIdx + 1} / {frames.length}
                  </div>
                  {frames[safeIdx] && (
                    <img
                      src={frames[safeIdx]}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-contain z-10"
                      alt="frame preview"
                    />
                  )}
                </div>

                <TouchlessButton
                  onClick={() =>
                    setSelectedFrameIdx((prev) =>
                      prev < frames.length - 1 ? prev + 1 : 0,
                    )
                  }
                  className="w-16 sm:w-24 h-16 sm:h-24 shrink-0 rounded-full bg-slate-800 border-2 border-slate-600 hover:border-slate-400 text-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
                >
                  <ChevronRight className="w-9 sm:w-12 h-9 sm:h-12" />
                </TouchlessButton>
              </div>

              <div className="mt-8 sm:mt-12 w-full flex justify-center">
                <TouchlessButton
                  onClick={() => setGameState("TAKING_PHOTOS")}
                  className="w-full max-w-xl py-5 sm:py-6 text-white text-2xl sm:text-3xl font-display font-black rounded-2xl shadow-2xl gap-4 flex items-center justify-center active:scale-95 transition-transform"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  <ImageIcon className="w-8 h-8" /> START SHOOT
                </TouchlessButton>
              </div>
            </div>
          </div>
        );
      }

      case "TAKING_PHOTOS":
        return (
          <PhotoBooth
            totalShots={settings.shotsCount}
            onFinish={handleFinishPhotos}
          />
        );

      case "PROCESSING_PHOTOS":
        return (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white px-6 text-center">
            <div
              className="w-24 h-24 mb-6 border-4 border-slate-800 rounded-full animate-spin"
              style={{ borderTopColor: settings.primaryColor }}
            />
            <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-wider mb-3">
              PROCESSING YOUR PHOTOS
            </h2>
            <p className="text-slate-300 text-sm sm:text-base font-medium">
              {uploadStatusText}
            </p>
          </div>
        );

      case "SHARE":
        return (
          <div
            className={`absolute inset-0 z-40 flex ${
              isLandscape ? "flex-row" : "flex-col justify-start"
            } items-center px-4 sm:px-6 overflow-hidden w-full h-full relative`}
            style={{
              backgroundColor:
                settings.shareScreenBackgroundColor || "#090d16",
            }}
          >
            <div className="absolute inset-0 bg-pattern-grid opacity-[0.15] pointer-events-none" />

            {settings.shareScreenBackgroundUrl && (
              <img
                src={settings.shareScreenBackgroundUrl}
                referrerPolicy="no-referrer"
                alt="Background"
                className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none z-0"
              />
            )}

            {/* Idle Auto-Reset countdown */}
            <div className="absolute top-4 right-5 z-20 font-mono tabular-nums text-xs text-slate-300 bg-slate-900/75 px-3 py-1.5 rounded-lg border border-slate-700">
              กลับหน้าหลักใน {idleRemaining}s
            </div>

            {!isLandscape && (
              <h1
                className="text-3xl sm:text-5xl font-display font-black mt-5 mb-3 text-center tracking-wider uppercase z-10 drop-shadow-xl shrink-0"
                style={{ color: settings.primaryColor }}
              >
                YOUR PHOTOS
              </h1>
            )}

            <div
              className={`flex ${
                isLandscape
                  ? "flex-row h-full w-full max-w-6xl mx-auto py-8 gap-8 items-center"
                  : "flex-col gap-4 items-center w-full max-w-xl pb-4 pt-1 z-10 flex-1 min-h-0"
              }`}
            >
              {isLandscape && (
                <div className="flex-1 flex flex-col justify-center items-center">
                  <h1
                    className="text-5xl font-display font-black mb-6 text-center tracking-wider uppercase drop-shadow-2xl"
                    style={{ color: settings.primaryColor }}
                  >
                    YOUR PHOTOS
                  </h1>
                  <div
                    className={`w-full max-w-[400px] ${
                      [
                        "4X6_LANDSCAPE_SINGLE",
                        "4X6_TRIPLE",
                        "4X6_3_PHOTO_A",
                        "4X6_3_PHOTO_B",
                        "4X6_4_PHOTO",
                        "4X6_2_PHOTO_A",
                        "4X6_2_PHOTO_B",
                      ].includes(settings.printLayout)
                        ? "aspect-[3/2]"
                        : "aspect-[2/3]"
                    } rounded-2xl shadow-2xl overflow-hidden border-4 flex items-center justify-center`}
                    style={{
                      backgroundColor:
                        settings.photoPreviewContainerColor || "#111827",
                      borderColor:
                        settings.photoPreviewContainerColor || "#1f2937",
                    }}
                  >
                    {finalImageUrl && (
                      <img
                        src={finalImageUrl}
                        alt="Print ready"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}

              {!isLandscape && (
                <div className="flex flex-col items-center justify-center w-full px-4 shrink min-h-0">
                  <div
                    className={`w-full max-h-[42vh] ${
                      [
                        "4X6_LANDSCAPE_SINGLE",
                        "4X6_TRIPLE",
                        "4X6_3_PHOTO_A",
                        "4X6_3_PHOTO_B",
                        "4X6_4_PHOTO",
                        "4X6_2_PHOTO_A",
                        "4X6_2_PHOTO_B",
                      ].includes(settings.printLayout)
                        ? "aspect-[3/2]"
                        : "aspect-[2/3]"
                    } rounded-2xl shadow-2xl overflow-hidden border-4 flex items-center justify-center`}
                    style={{
                      backgroundColor:
                        settings.photoPreviewContainerColor || "#111827",
                      borderColor:
                        settings.photoPreviewContainerColor || "#1f2937",
                    }}
                  >
                    {finalImageUrl && (
                      <img
                        src={finalImageUrl}
                        alt="Print ready"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}

              <div
                className={`flex flex-col space-y-3 w-full px-4 ${
                  isLandscape
                    ? "flex-1 justify-center max-w-[460px]"
                    : "shrink-0"
                }`}
              >
                <div className="bg-white p-6 rounded-3xl w-full max-w-[360px] shadow-2xl flex flex-col items-center mx-auto">
                  <div className="flex items-center gap-2 mb-3">
                    <QrCode className="w-5 h-5 text-slate-600" />
                    <p className="text-slate-700 font-bold text-xs tracking-wider uppercase">
                      Get Your Photo
                    </p>
                  </div>

                  {qrCodeUrl ? (
                    <div className="flex flex-col items-center">
                      <div
                        onClick={() => window.open(qrCodeUrl, "_blank")}
                        className={`${
                          isLandscape ? "w-[190px]" : "w-[165px]"
                        } aspect-square bg-white p-2 rounded-xl ring-1 ring-slate-200 cursor-pointer hover:scale-105 transition-transform`}
                        title="เปิดลิงก์ดาวน์โหลด"
                      >
                        <QRCode value={qrCodeUrl} className="w-full h-full" />
                      </div>
                      <p className="mt-2.5 text-xs text-slate-600 font-semibold text-center">
                        สแกน QR Code เพื่อดาวน์โหลดลงมือถือ
                      </p>
                      <p className="mt-0.5 text-[11px] text-emerald-700 font-medium">
                        {uploadProvider === "cloud_fallback"
                          ? "สำรองบน Cloud Database สำเร็จ"
                          : uploadProvider === "freeimage"
                            ? "อัปโหลดผ่าน CDN สำรองสำเร็จ"
                            : "พร้อมดาวน์โหลดทันที"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center py-3 space-y-3">
                      <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[230px]">
                        บันทึกรูปภาพในเครื่องแล้ว (กรุณาใส่ ImgBB API Key หรือเชื่อม Google Cloud ในหน้าตั้งค่าเพื่อสร้าง QR ออนไลน์)
                      </p>
                      {finalImageUrl && (
                        <a
                          href={finalImageUrl}
                          download={`visionplay-${Date.now()}.jpg`}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" /> บันทึกไฟล์ภาพลงเครื่อง
                        </a>
                      )}
                    </div>
                  )}

                  {settings.showSponsorLogo && settings.sponsorLogoUrl && (
                    <div className="mt-4 flex flex-col items-center w-full pt-3 border-t border-slate-100">
                      <p className="text-slate-400 text-[10px] font-semibold tracking-widest mb-1.5">
                        SPONSORED BY
                      </p>
                      <img
                        src={settings.sponsorLogoUrl}
                        referrerPolicy="no-referrer"
                        alt="Sponsor"
                        className="h-8 w-full object-contain mix-blend-multiply opacity-85"
                      />
                    </div>
                  )}
                </div>

                <div
                  className={`flex ${
                    settings.enableHardwarePrint ? "flex-row" : "flex-col"
                  } gap-3 w-full max-w-[360px] mx-auto`}
                >
                  <TouchlessButton
                    onClick={() => setGameState("START")}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-2xl shadow-xl border border-slate-700 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-6 h-6 text-slate-300" />
                    <span className="font-display font-bold tracking-wider">
                      FINISH
                    </span>
                  </TouchlessButton>

                  {settings.enableHardwarePrint && (
                    <TouchlessButton
                      onClick={() => {
                        const printIframe = document.createElement("iframe");
                        printIframe.style.visibility = "hidden";
                        printIframe.style.position = "fixed";
                        printIframe.style.right = "0";
                        printIframe.style.bottom = "0";
                        document.body.appendChild(printIframe);

                        const printContent = `
                          <html><head></head><body style="margin:0;display:flex;justify-content:center;align-items:center;">
                            <img src="${finalImageUrl}" style="max-width:100%;max-height:100vh;" onload="setTimeout(() => { window.print(); }, 400);" />
                          </body></html>
                        `;
                        printIframe.contentDocument?.write(printContent);
                        printIframe.contentDocument?.close();
                        setTimeout(() => {
                          if (document.body.contains(printIframe)) {
                            document.body.removeChild(printIframe);
                          }
                        }, 10000);
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-2xl shadow-xl border border-slate-700 flex items-center justify-center gap-2"
                    >
                      <Printer className="w-6 h-6 text-emerald-400" />
                      <span className="font-display font-bold tracking-wider">
                        PRINT
                      </span>
                    </TouchlessButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-screen bg-slate-950 overflow-hidden relative font-sans select-none touch-none">
      <CameraBackground gameState={gameState} />
      <HandTracker />
      <AnimatePresence mode="wait">{renderScreen()}</AnimatePresence>

      {/* Admin PIN Protection Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[150] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-white font-bold">
                <Lock className="w-5 h-5 text-amber-400" />
                <span>Admin PIN</span>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="text-slate-400 hover:text-white text-sm font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-center font-mono text-2xl tracking-[0.4em] text-white min-h-[54px]">
              {pinAttempt ? "•".repeat(pinAttempt.length) : "----"}
            </div>

            {pinError && (
              <p className="text-xs text-red-400 text-center font-semibold">
                รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่
              </p>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map(
                (key) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "C") {
                        setPinAttempt("");
                        setPinError(false);
                      } else if (key === "OK") {
                        submitPin(pinAttempt);
                      } else if (pinAttempt.length < 12) {
                        const next = pinAttempt + key;
                        setPinAttempt(next);
                        setPinError(false);
                        if (next === (settings.adminPin || "").trim()) {
                          submitPin(next);
                        }
                      }
                    }}
                    className={`h-14 rounded-2xl font-bold text-lg transition-colors cursor-pointer ${
                      key === "OK"
                        ? "bg-sky-600 hover:bg-sky-500 text-white"
                        : key === "C"
                          ? "bg-slate-800 hover:bg-slate-700 text-amber-400"
                          : "bg-slate-800 hover:bg-slate-700 text-white"
                    }`}
                  >
                    {key}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoBooth({
  totalShots,
  onFinish,
}: {
  totalShots: number;
  onFinish: (photos: string[]) => void;
}) {
  const { videoRef } = useCamera();
  const [countdown, setCountdown] = useState(3);
  const [shots, setShots] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const { settings } = useSettings();
  const finishedRef = useRef(false);

  useEffect(() => {
    if (shots >= totalShots) {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const doneTimer = setTimeout(() => {
        onFinish(capturedPhotos);
      }, 1200);
      return () => clearTimeout(doneTimer);
    }

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((c) => c - 1);
        if (countdown - 1 > 0) {
          playSound("click", settings.isMuted);
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const video = videoRef.current || document.querySelector("video");
      let dataUrl = "";
      if (video && video.videoWidth > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/jpeg", 0.88);
        }
      }

      playSound("shutter", settings.isMuted);

      setCapturedPhotos((prev) => [...prev, dataUrl]);
      setShots((prev) => prev + 1);
      setCountdown(3);
    }
  }, [countdown, shots, totalShots, capturedPhotos, onFinish, settings.isMuted, videoRef]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      {countdown === 0 && (
        <div className="absolute inset-0 bg-white z-50 animate-[flash_0.6s_ease-out_forwards]" />
      )}

      {shots < totalShots && countdown > 0 && (
        <div className="text-[11rem] sm:text-[20rem] font-bold text-white drop-shadow-[0_0_40px_rgba(0,0,0,0.8)] font-mono tabular-nums animate-pulse">
          {countdown}
        </div>
      )}

      <div className="absolute top-8 left-8 flex gap-3">
        {Array.from({ length: totalShots }).map((_, i) => (
          <div
            key={i}
            className={`w-14 h-18 rounded-xl border-2 flex items-center justify-center transition-colors ${
              i < shots ? "bg-slate-800/90" : "border-slate-600 bg-slate-900/60"
            }`}
            style={{
              borderColor: i < shots ? settings.primaryColor : undefined,
            }}
          >
            {i < shots && (
              <CheckCircle
                className="w-7 h-7"
                style={{ color: settings.primaryColor }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileSharePage({
  imageUrl,
  photoId,
}: {
  imageUrl: string | null;
  photoId: string | null;
}) {
  const { settings } = useSettings();
  const [resolvedUrl, setResolvedUrl] = useState<string>(imageUrl || "");
  const [resolvedBrand, setResolvedBrand] = useState<string>(
    settings.brandName || "YOUR PHOTO",
  );
  const [loading, setLoading] = useState<boolean>(Boolean(photoId && !imageUrl));
  const [errorText, setErrorText] = useState<string>("");

  useEffect(() => {
    if (!photoId || imageUrl) return;
    setLoading(true);
    fetchSharedPhotoFromCloud(photoId)
      .then((res) => {
        if (res && res.imageUrl) {
          setResolvedUrl(res.imageUrl);
          if (res.brandName) setResolvedBrand(res.brandName);
        } else {
          setErrorText("ไม่พบรูปภาพหรือลิงก์หมดอายุแล้ว");
        }
      })
      .catch(() => {
        setErrorText("ไม่สามารถโหลดรูปภาพจากระบบได้ในขณะนี้");
      })
      .finally(() => setLoading(false));
  }, [photoId, imageUrl]);

  const handleDownload = async () => {
    if (!resolvedUrl) return;
    try {
      const response = await fetch(resolvedUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `visionplay-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      const a = document.createElement("a");
      a.href = resolvedUrl;
      a.download = `visionplay-${Date.now()}.jpg`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleShare = async () => {
    if (!resolvedUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My Photo from ${resolvedBrand}`,
          text: "Check out my photo!",
          url: window.location.href,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleDownload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col pt-8 pb-12 px-6 overflow-y-auto">
      <div className="flex-1 flex flex-col items-center max-w-lg mx-auto w-full">
        <h1
          className="text-3xl font-display font-black mb-6 tracking-wider text-center"
          style={{ color: settings.primaryColor }}
        >
          {resolvedBrand}
        </h1>

        <div className="w-full relative bg-slate-900 rounded-3xl p-4 shadow-2xl border border-slate-800 mb-8 min-h-[280px] flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-10 h-10 border-4 border-slate-700 border-t-sky-500 rounded-full animate-spin" />
              <span className="text-sm font-medium">กำลังโหลดรูปภาพของคุณ...</span>
            </div>
          ) : errorText ? (
            <p className="text-sm text-red-400 text-center px-4">{errorText}</p>
          ) : (
            <img
              src={resolvedUrl}
              referrerPolicy="no-referrer"
              alt="Your photo"
              className="w-full h-auto rounded-xl object-contain shadow-inner"
            />
          )}
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleDownload}
            disabled={!resolvedUrl || loading}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-colors shadow-lg border border-slate-700 cursor-pointer"
          >
            <Download className="w-5 h-5" /> DOWNLOAD PHOTO
          </button>

          <button
            onClick={handleShare}
            disabled={!resolvedUrl || loading}
            className="w-full py-4 disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-colors cursor-pointer"
            style={{ backgroundColor: settings.primaryColor }}
          >
            <Share2 className="w-5 h-5" /> SHARE
          </button>
        </div>

        <p className="mt-8 text-slate-500 text-xs text-center font-semibold tracking-wider uppercase">
          Thank you for joining us
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const imageUrl = urlParams.get("image");
  const photoId = urlParams.get("photoId");

  if (imageUrl || photoId) {
    return (
      <SettingsProvider>
        <MobileSharePage imageUrl={imageUrl} photoId={photoId} />
      </SettingsProvider>
    );
  }

  return (
    <SettingsProvider>
      <CameraProvider>
        <MainGame />
      </CameraProvider>
    </SettingsProvider>
  );
}
