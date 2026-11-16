import React, { useState, useEffect } from "react";
import { useSettings } from "../config";
import {
  Settings,
  RefreshCw,
  X,
  Plus,
  Trash2,
  Camera,
  Cloud,
  Palette,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UploadCloud,
  DownloadCloud,
  LogIn,
  LogOut,
  Copy,
  Gamepad2,
  Sparkles,
  Wifi,
} from "lucide-react";
import { User } from "firebase/auth";
import { processGoogleDriveUrl } from "../utils/urlHelper";
import { testImgBBConnection } from "../services/uploadService";
import {
  signInAdminWithGoogle,
  signOutAdmin,
  subscribeAuthState,
  syncKioskConfigToCloud,
  fetchKioskConfigFromCloud,
  sanitizeFirestoreId,
} from "../services/cloudService";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#ffffff",
  "#000000",
  "#1f2937",
];

type AdminTab = "mode" | "camera" | "branding" | "cloud";

interface AdminPanelProps {
  onClose: () => void;
  onClearLeaderboard: () => void;
}

const LayoutPreview = ({ layout }: { layout: string }) => {
  const isLandscape = [
    "4X6_LANDSCAPE_SINGLE",
    "4X6_TRIPLE",
    "4X6_3_PHOTO_A",
    "4X6_3_PHOTO_B",
    "4X6_4_PHOTO",
    "4X6_2_PHOTO_A",
    "4X6_2_PHOTO_B",
  ].includes(layout);

  const widthStr = isLandscape ? "w-[150px]" : "w-[100px]";
  const aspectRatio = isLandscape ? "aspect-[3/2]" : "aspect-[2/3]";

  const getBoxes = () => {
    const boxClass =
      "bg-slate-800 border-2 border-slate-900 rounded-sm shadow-inner";
    switch (layout) {
      case "2X6_3_PHOTO":
        return (
          <div className="flex justify-between w-full h-full p-2">
            <div className="w-[45%] h-full flex flex-col justify-start gap-1 pb-4">
              <div className={`w-full h-[25%] ${boxClass}`}></div>
              <div className={`w-full h-[25%] ${boxClass}`}></div>
              <div className={`w-full h-[25%] ${boxClass}`}></div>
            </div>
            <div className="w-[45%] h-full flex flex-col justify-start gap-1 pb-4">
              <div className={`w-full h-[25%] ${boxClass}`}></div>
              <div className={`w-full h-[25%] ${boxClass}`}></div>
              <div className={`w-full h-[25%] ${boxClass}`}></div>
            </div>
          </div>
        );
      case "2X6_4_PHOTO":
        return (
          <div className="flex justify-between w-full h-full p-1.5">
            <div className="w-[45%] h-full flex flex-col justify-start gap-[2px] pb-[10px]">
              <div className={`w-full h-[20%] ${boxClass}`}></div>
              <div className={`w-full h-[20%] ${boxClass}`}></div>
              <div className={`w-full h-[20%] ${boxClass}`}></div>
              <div className={`w-full h-[20%] ${boxClass}`}></div>
            </div>
            <div className="w-[45%] h-full flex flex-col justify-start gap-[2px] pb-[10px]">
              <div className={`w-full h-[20%] ${boxClass}`}></div>
              <div className={`w-full h-[20%] ${boxClass}`}></div>
              <div className={`w-full h-[20%] ${boxClass}`}></div>
              <div className={`w-full h-[20%] ${boxClass}`}></div>
            </div>
          </div>
        );
      case "4X6_6_PHOTO":
        return (
          <div className="grid grid-cols-2 grid-rows-3 gap-1 p-2 w-full h-[80%] my-auto mt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={boxClass}></div>
            ))}
          </div>
        );
      case "4X6_PORTRAIT_SINGLE":
      case "4X6_LANDSCAPE_SINGLE":
        return (
          <div className="w-full h-[80%] mt-2 p-2 pb-6 flex">
            <div className={`w-full h-full ${boxClass}`}></div>
          </div>
        );
      case "4X6_TRIPLE":
        return (
          <div className="w-full h-full p-2 pb-6 mt-2 grid grid-cols-3 gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={boxClass}></div>
            ))}
          </div>
        );
      case "4X6_3_PHOTO_A":
        return (
          <div className="w-full h-full py-2 px-2 pb-6 mt-2 flex gap-1">
            <div className={`w-[50%] h-full ${boxClass}`}></div>
            <div className="w-[50%] h-full flex flex-col gap-1">
              <div className={`h-1/2 w-full ${boxClass}`}></div>
              <div className={`h-1/2 w-full ${boxClass}`}></div>
            </div>
          </div>
        );
      case "4X6_3_PHOTO_B":
        return (
          <div className="w-full h-full py-2 px-2 pb-6 mt-2 flex flex-col gap-1">
            <div className="h-[50%] w-full flex gap-1">
              <div className={`w-1/2 h-full ${boxClass}`}></div>
              <div className={`w-1/2 h-full ${boxClass}`}></div>
            </div>
            <div className={`h-[50%] w-full ${boxClass}`}></div>
          </div>
        );
      case "4X6_4_PHOTO":
        return (
          <div className="w-full h-full py-2 px-2 pb-6 mt-2 flex flex-col gap-1">
            <div className={`h-[60%] w-full ${boxClass}`}></div>
            <div className="h-[40%] w-full flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`w-1/3 h-full ${boxClass}`}></div>
              ))}
            </div>
          </div>
        );
      case "4X6_2_PHOTO_A":
        return (
          <div className="w-full h-full py-2 px-2 pb-6 mt-2 flex flex-col gap-1">
            <div className={`h-1/2 w-full ${boxClass}`}></div>
            <div className={`h-1/2 w-full ${boxClass}`}></div>
          </div>
        );
      case "4X6_2_PHOTO_B":
        return (
          <div className="w-full h-full py-2 px-2 pb-6 mt-2 flex gap-1">
            <div className={`w-1/2 h-full ${boxClass}`}></div>
            <div className={`w-1/2 h-full ${boxClass}`}></div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`bg-[#e5e5e5] border-[3px] border-[#d4d4d4] rounded-sm shadow-md overflow-hidden flex items-center justify-center shrink-0 ${widthStr} ${aspectRatio} relative`}
    >
      <div className="w-full h-full relative z-10">{getBoxes()}</div>
    </div>
  );
};

export function AdminPanel({ onClose, onClearLeaderboard }: AdminPanelProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<AdminTab>("mode");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [converterInput, setConverterInput] = useState("");
  const [converterOutput, setConverterOutput] = useState("");

  // API diagnostic state
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Firebase Auth & Cloud Sync state
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudFeedback, setCloudFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        setCameras(devices.filter((d) => d.kind === "videoinput"));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = subscribeAuthState((user) => {
      setCloudUser(user);
    });
    return () => unsub();
  }, []);

  const handleChange = <K extends keyof typeof settings>(
    field: K,
    value: (typeof settings)[K],
  ) => {
    updateSettings({ [field]: value });
  };

  const handleConvertUrl = () => {
    setConverterOutput(processGoogleDriveUrl(converterInput));
  };

  const handleTestImgBB = async () => {
    setTestingApi(true);
    setApiTestResult(null);
    const res = await testImgBBConnection(settings.imgbbApiKey);
    setApiTestResult({ ok: res.ok, message: res.message });
    setTestingApi(false);
  };

  const handleGoogleSignIn = async () => {
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      const user = await signInAdminWithGoogle();
      setCloudFeedback({
        ok: true,
        message: `เชื่อมต่อบัญชี ${user.email || "Google"} สำเร็จ`,
      });
    } catch (err: any) {
      setCloudFeedback({
        ok: false,
        message: err?.message || "ไม่สามารถเข้าสู่ระบบ Google ได้",
      });
    } finally {
      setCloudBusy(false);
    }
  };

  const handlePushConfig = async () => {
    if (!cloudUser) return;
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      const savedId = await syncKioskConfigToCloud(
        settings.kioskId || "default-kiosk",
        settings,
        cloudUser.uid,
      );
      updateSettings({ kioskId: savedId });
      setCloudFeedback({
        ok: true,
        message: `บันทึกโปรไฟล์ "${savedId}" ขึ้น Cloud สำเร็จ`,
      });
    } catch (err: any) {
      setCloudFeedback({
        ok: false,
        message: err?.message || "อัปโหลดการตั้งค่าไม่สำเร็จ",
      });
    } finally {
      setCloudBusy(false);
    }
  };

  const handlePullConfig = async () => {
    setCloudBusy(true);
    setCloudFeedback(null);
    try {
      const data = await fetchKioskConfigFromCloud(
        settings.kioskId || "default-kiosk",
      );
      if (!data) {
        setCloudFeedback({
          ok: false,
          message: `ไม่พบโปรไฟล์ "${settings.kioskId || "default-kiosk"}" บน Cloud`,
        });
      } else {
        updateSettings(data);
        setCloudFeedback({
          ok: true,
          message: `ดึงการตั้งค่า "${settings.kioskId}" มาใช้งานเรียบร้อย`,
        });
      }
    } catch (err: any) {
      setCloudFeedback({
        ok: false,
        message: err?.message || "ดึงข้อมูลจาก Cloud ไม่สำเร็จ",
      });
    } finally {
      setCloudBusy(false);
    }
  };

  const syncShareUrl = `${window.location.origin}${window.location.pathname}?kiosk=${encodeURIComponent(
    sanitizeFirestoreId(settings.kioskId || "default-kiosk"),
  )}`;

  const handleCopySyncUrl = () => {
    navigator.clipboard?.writeText(syncShareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className="absolute inset-0 z-[100] bg-slate-950 overflow-y-auto text-slate-100 p-5 sm:p-8 select-auto touch-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight text-white">
                Kiosk Control Center
              </h1>
              <p className="text-xs text-slate-400">
                ปรับโหมดการทำงาน กล้อง แบรนด์ และการเชื่อมต่อ Cloud
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              onClick={() => {
                if (confirmClear) {
                  onClearLeaderboard();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                  setTimeout(() => setConfirmClear(false), 3000);
                }
              }}
              className={`px-4 py-2.5 border rounded-xl flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                confirmClear
                  ? "bg-red-600 hover:bg-red-500 border-red-500 text-white"
                  : "bg-slate-900 text-amber-400 hover:bg-slate-800 border-slate-700"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {confirmClear ? "ยืนยันลบคะแนนทั้งหมด" : "Clear Scores"}
            </button>

            <button
              onClick={resetSettings}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> Reset Default
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ml-auto lg:ml-0"
            >
              <X className="w-4 h-4" /> กลับหน้าตู้เกม
            </button>
          </div>
        </div>

        {/* Segmented Tab Bar */}
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-900 rounded-xl border border-slate-800">
          {[
            { id: "mode" as AdminTab, label: "โหมด & การพิมพ์", icon: Sliders },
            { id: "camera" as AdminTab, label: "กล้อง & มือ AR", icon: Camera },
            { id: "branding" as AdminTab, label: "แบรนด์ & กรอบรูป", icon: Palette },
            { id: "cloud" as AdminTab, label: "Cloud, API & PIN", icon: Cloud },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: MODE & PRINT */}
        {activeTab === "mode" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Experience Mode Selector */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    รูปแบบการทำงานของตู้ (Experience Mode)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    เลือกสลับได้ทันทีระหว่างโหมดเล่นเกม+ถ่ายรูป หรือโหมดถ่ายรูปอย่างเดียวสำหรับงานอีเวนต์ทางการ
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleChange("kioskMode", "GAME_AND_PHOTO")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.kioskMode === "GAME_AND_PHOTO"
                        ? "bg-sky-950/50 border-sky-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm mb-1.5">
                      <Gamepad2 className="w-4 h-4 text-sky-400" />
                      <span>เกม + ถ่ายรูป</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      เล่นเกมรับของทำคะแนน ติดอันดับ Leaderboard แล้วไปถ่ายรูป
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChange("kioskMode", "PHOTO_ONLY")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.kioskMode === "PHOTO_ONLY"
                        ? "bg-emerald-950/50 border-emerald-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm mb-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>ถ่ายรูปอย่างเดียว (No Game)</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      ข้ามการเล่นเกม กดเริ่มแล้วเลือกกรอบถ่ายรูปและรับ QR Code ทันที
                    </p>
                  </button>
                </div>

                {settings.kioskMode === "PHOTO_ONLY" && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        ให้ผู้ร่วมงานพิมพ์ชื่อก่อนถ่ายรูป
                      </div>
                      <div className="text-xs text-slate-400">
                        หากปิด ระบบจะข้ามคีย์บอร์ดและแสดงวันที่บนกรอบรูปแทน
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.photoOnlyAskName)}
                      onChange={(e) =>
                        handleChange("photoOnlyAskName", e.target.checked)
                      }
                      className="w-5 h-5 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Kiosk Display & Timer */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-white">
                  หน้าจอและระบบรีเซ็ตอัตโนมัติ
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">
                      Screen Orientation
                    </span>
                    <select
                      value={settings.orientation}
                      onChange={(e) =>
                        handleChange(
                          "orientation",
                          e.target.value as "PORTRAIT" | "LANDSCAPE",
                        )
                      }
                      className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                    >
                      <option value="PORTRAIT">Portrait (9:16) ตู้แนวตั้ง</option>
                      <option value="LANDSCAPE">Landscape (16:9) แนวนอน</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">
                      จำนวนช็อตถ่ายรูป (Shots)
                    </span>
                    <select
                      value={settings.shotsCount}
                      onChange={(e) =>
                        handleChange("shotsCount", parseInt(e.target.value, 10))
                      }
                      className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} ช็อต
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">
                    Idle Auto-Reset (กลับหน้าหลักอัตโนมัติเมื่อไม่มีการใช้งาน)
                  </span>
                  <div className="flex items-center gap-3 mt-1.5">
                    <input
                      type="range"
                      min={15}
                      max={180}
                      step={5}
                      value={settings.idleResetSeconds || 45}
                      onChange={(e) =>
                        handleChange(
                          "idleResetSeconds",
                          parseInt(e.target.value, 10),
                        )
                      }
                      className="flex-1 accent-sky-500"
                    />
                    <span className="font-mono tabular-nums text-sm font-bold text-sky-400 w-16 text-right">
                      {settings.idleResetSeconds || 45}s
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Print Layout & Hardware Printer */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-white">
                  เลย์เอาต์ภาพพิมพ์ & เครื่องพิมพ์
                </h2>

                <div className="flex flex-col sm:flex-row gap-5 items-center">
                  <div className="flex-1 w-full space-y-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-400">
                        Print Layout Template
                      </span>
                      <select
                        value={settings.printLayout}
                        onChange={(e) =>
                          handleChange("printLayout", e.target.value as any)
                        }
                        className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        <optgroup label="Classic Strips (2x6)">
                          <option value="2X6_3_PHOTO">1. 2x6" 3 PHOTOS</option>
                          <option value="2X6_4_PHOTO">2. 2x6" 4 PHOTOS</option>
                        </optgroup>
                        <optgroup label="Standard Grid (4x6)">
                          <option value="4X6_6_PHOTO">
                            3. 4x6" 6 PHOTOS (Grid 2x3)
                          </option>
                        </optgroup>
                        <optgroup label="Single Shot (4x6)">
                          <option value="4X6_PORTRAIT_SINGLE">
                            4. 4x6" PORTRAIT
                          </option>
                          <option value="4X6_LANDSCAPE_SINGLE">
                            5. 4x6" LANDSCAPE
                          </option>
                        </optgroup>
                        <optgroup label="Modern Collages (4x6)">
                          <option value="4X6_TRIPLE">
                            6. 4x6" TRIPLE (Horizontal)
                          </option>
                          <option value="4X6_3_PHOTO_A">
                            7. 4x6" 3 PHOTO A (1 Large, 2 Small)
                          </option>
                          <option value="4X6_3_PHOTO_B">
                            8. 4x6" 3 PHOTO B (2 Small, 1 Large)
                          </option>
                          <option value="4X6_4_PHOTO">
                            9. 4x6" 4 PHOTO (1 Large, 3 Small)
                          </option>
                          <option value="4X6_2_PHOTO_A">
                            10. 4x6" 2 PHOTO A (Vertical)
                          </option>
                          <option value="4X6_2_PHOTO_B">
                            11. 4x6" 2 PHOTO B (Horizontal)
                          </option>
                        </optgroup>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold text-slate-400">
                        ชั้นวางกรอบรูป (Frame Layer)
                      </span>
                      <select
                        value={settings.printFrameLayer}
                        onChange={(e) =>
                          handleChange(
                            "printFrameLayer",
                            e.target.value as "FRONT" | "BACK",
                          )
                        }
                        className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                      >
                        <option value="FRONT">
                          FRONT: กรอบวางทับบนรูป (เหมาะกับ PNG เจาะใส)
                        </option>
                        <option value="BACK">
                          BACK: รูปวางทับบนพื้นหลังกรอบ
                        </option>
                      </select>
                    </label>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-2">
                      Preview
                    </span>
                    <LayoutPreview layout={settings.printLayout} />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        เปิดใช้งานปุ่มสั่งพิมพ์ (Hardware Print)
                      </div>
                      <div className="text-xs text-slate-400">
                        แสดงปุ่ม Print บนหน้า Share (แนะนำให้เปิด Chrome ด้วย{" "}
                        <code>--kiosk-printing</code>)
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableHardwarePrint}
                      onChange={(e) =>
                        handleChange("enableHardwarePrint", e.target.checked)
                      }
                      className="w-5 h-5 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {settings.enableHardwarePrint && (
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-400">
                        Target Printer Name (ถ้าใช้ Local Print Server)
                      </span>
                      <input
                        type="text"
                        value={settings.targetPrinterName || ""}
                        onChange={(e) =>
                          handleChange("targetPrinterName", e.target.value)
                        }
                        className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white"
                        placeholder="e.g. DNP RX1 / Default"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CAMERA & AR HANDS */}
        {activeTab === "camera" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
              <h2 className="text-base font-bold text-white">
                อุปกรณ์กล้องและการตรวจจับมือ AR (2 มือ)
              </h2>

              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="font-semibold text-sm text-white">
                    เปิดใช้งานกล้อง (Camera Access)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    ใช้สตรีมกล้องเดียวร่วมกันทั้งพื้นหลัง เกม ถ่ายรูป และ AR Hands
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.cameraEnabled}
                  onChange={(e) =>
                    handleChange("cameraEnabled", e.target.checked)
                  }
                  className="w-5 h-5 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="font-semibold text-sm text-white">
                    แสดงเส้นโครงกระดูกและจุดข้อต่อมือ (Show Hand Skeleton)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    ปิดไว้เพื่อแสดงเฉพาะเคอร์เซอร์ปลายนิ้วชี้ (ทั้ง 2 มือ) ไม่บังจอและคีย์บอร์ด
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.showHandSkeleton)}
                  onChange={(e) =>
                    handleChange("showHandSkeleton", e.target.checked)
                  }
                  className="w-5 h-5 accent-sky-500 cursor-pointer"
                />
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  เลือกอุปกรณ์กล้อง (Camera Device)
                </span>
                <select
                  value={settings.selectedCameraId}
                  onChange={(e) =>
                    handleChange("selectedCameraId", e.target.value)
                  }
                  className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  <option value="">Auto / System Default</option>
                  {cameras.map((c) => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {c.label || `Camera ${c.deviceId.substring(0, 6)}`}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="font-semibold text-sm text-white">
                    ปิดเสียงเอฟเฟกต์ทั้งหมด (Mute Audio)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    ปิดเสียงชัตเตอร์และเสียงเกม
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.isMuted}
                  onChange={(e) => handleChange("isMuted", e.target.checked)}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">
                    วิดีโอพักหน้าจอ (Screensaver)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    เล่นเมื่อปิดกล้อง (F8) รองรับ MP4, WebM, YouTube, Google Drive
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.screensaverEnabled}
                  onChange={(e) =>
                    handleChange("screensaverEnabled", e.target.checked)
                  }
                  className="w-5 h-5 accent-emerald-500 cursor-pointer"
                />
              </div>

              {settings.screensaverEnabled && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex justify-end">
                    <button
                      onClick={() =>
                        handleChange("screensaverVideos", [
                          ...(settings.screensaverVideos || []),
                          "",
                        ])
                      }
                      className="text-xs bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                    >
                      + เพิ่มวิดีโอ
                    </button>
                  </div>
                  {(settings.screensaverVideos || []).map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                          const next = [...(settings.screensaverVideos || [])];
                          next[idx] = e.target.value;
                          handleChange("screensaverVideos", next);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                        placeholder={`https://... (Video ${idx + 1})`}
                      />
                      <button
                        onClick={() =>
                          handleChange(
                            "screensaverVideos",
                            (settings.screensaverVideos || []).filter(
                              (_, i) => i !== idx,
                            ),
                          )
                        }
                        className="p-2 bg-red-950/50 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BRANDING & ASSETS */}
        {activeTab === "branding" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-white">
                  อัตลักษณ์แบรนด์ & ชุดสี
                </h2>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">
                    ชื่อแบรนด์ / ชื่องานอีเวนต์
                  </span>
                  <input
                    type="text"
                    value={settings.brandName}
                    onChange={(e) => handleChange("brandName", e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: "primaryColor" as const, label: "Primary Color" },
                    { key: "secondaryColor" as const, label: "Secondary Color" },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="bg-slate-950 p-3.5 border border-slate-800 rounded-xl space-y-2.5"
                    >
                      <span className="text-xs text-slate-400 block font-semibold">
                        {item.label}
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={settings[item.key]}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                          className="h-9 w-9 rounded cursor-pointer border-0 bg-transparent shrink-0"
                        />
                        <input
                          type="text"
                          value={settings[item.key]}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                          className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2 font-mono text-xs text-white uppercase"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => handleChange(item.key, c)}
                            className="w-5 h-5 rounded border border-slate-700 hover:scale-110 transition-transform cursor-pointer"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      key: "photoPrintBackgroundColor" as const,
                      label: "พื้นหลังใบพิมพ์",
                      fallback: "#ffffff",
                    },
                    {
                      key: "shareScreenBackgroundColor" as const,
                      label: "พื้นหลังหน้า Share",
                      fallback: "#090d16",
                    },
                    {
                      key: "photoPreviewContainerColor" as const,
                      label: "กรอบพรีวิวหน้า Share",
                      fallback: "#111827",
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="bg-slate-950 p-3 border border-slate-800 rounded-xl block"
                    >
                      <span className="text-[11px] text-slate-400 block mb-2">
                        {item.label}
                      </span>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={settings[item.key] || item.fallback}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                          className="h-8 w-8 rounded cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={settings[item.key] || item.fallback}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                          className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-xs text-white uppercase"
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">
                    Custom Start Button URL (PNG ใส, ไม่บังคับ)
                  </span>
                  <input
                    type="text"
                    value={settings.customStartButtonUrl || ""}
                    onChange={(e) =>
                      handleChange(
                        "customStartButtonUrl",
                        processGoogleDriveUrl(e.target.value),
                      )
                    }
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    placeholder="https://..."
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">
                    Share Screen Background Image URL (ไม่บังคับ)
                  </span>
                  <input
                    type="text"
                    value={settings.shareScreenBackgroundUrl || ""}
                    onChange={(e) =>
                      handleChange(
                        "shareScreenBackgroundUrl",
                        processGoogleDriveUrl(e.target.value),
                      )
                    }
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    placeholder="https://..."
                  />
                </label>

                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      โลโก้สปอนเซอร์ใต้ QR Code
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showSponsorLogo}
                      onChange={(e) =>
                        handleChange("showSponsorLogo", e.target.checked)
                      }
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  {settings.showSponsorLogo && (
                    <input
                      type="text"
                      value={settings.sponsorLogoUrl || ""}
                      onChange={(e) =>
                        handleChange(
                          "sponsorLogoUrl",
                          processGoogleDriveUrl(e.target.value),
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                      placeholder="https://..."
                    />
                  )}
                </div>
              </div>

              {/* Google Drive Converter */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-sky-400">
                  Google Drive Direct Link Converter
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={converterInput}
                    onChange={(e) => setConverterInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    placeholder="วางลิงก์แชร์ Google Drive ที่นี่..."
                  />
                  <button
                    onClick={handleConvertUrl}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    แปลงลิงก์
                  </button>
                </div>
                {converterOutput && (
                  <input
                    type="text"
                    readOnly
                    value={converterOutput}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full bg-emerald-950/30 border border-emerald-500/40 rounded-xl px-3 py-2 text-emerald-300 text-xs font-mono"
                  />
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Frames & Sponsors */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-white">
                  กรอบรูป (Overlay Frames) & สปอนเซอร์
                </h2>
                <p className="text-xs text-slate-400">
                  แนะนำ PNG เจาะใส 1200x1800px (แนวตั้ง) หรือ 1800x1200px (แนวนอน) ที่รองรับ CORS
                </p>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-emerald-400 block">
                    Overlay Frames
                  </span>
                  {settings.framesUrls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={url.startsWith("data:") ? "[Built-in Default Frame]" : url}
                        onChange={(e) => {
                          const next = [...settings.framesUrls];
                          next[i] = processGoogleDriveUrl(e.target.value);
                          handleChange("framesUrls", next);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                        placeholder="https://..."
                      />
                      <button
                        onClick={() =>
                          handleChange(
                            "framesUrls",
                            settings.framesUrls.filter((_, idx) => idx !== i),
                          )
                        }
                        className="p-2 bg-red-950/40 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      handleChange("framesUrls", [...settings.framesUrls, ""])
                    }
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl border border-slate-700 flex justify-center items-center gap-2 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> เพิ่มกรอบรูป
                  </button>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <span className="text-xs font-semibold text-sky-400 block">
                    Sponsor Logos on Print Strip
                  </span>
                  {settings.sponsorsUrls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={url.startsWith("data:") ? "[Built-in Sponsor Badge]" : url}
                        onChange={(e) => {
                          const next = [...settings.sponsorsUrls];
                          next[i] = processGoogleDriveUrl(e.target.value);
                          handleChange("sponsorsUrls", next);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                        placeholder="https://..."
                      />
                      <button
                        onClick={() =>
                          handleChange(
                            "sponsorsUrls",
                            settings.sponsorsUrls.filter((_, idx) => idx !== i),
                          )
                        }
                        className="p-2 bg-red-950/40 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      handleChange("sponsorsUrls", [...settings.sponsorsUrls, ""])
                    }
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl border border-slate-700 flex justify-center items-center gap-2 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> เพิ่มโลโก้สปอนเซอร์
                  </button>
                </div>
              </div>

              {/* Game Assets */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">
                    ตัวละครและไอเทมในเกม
                  </h2>
                  {settings.kioskMode === "PHOTO_ONLY" && (
                    <span className="text-xs text-amber-400 font-medium">
                      กำลังปิดโหมดเกมอยู่
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "gamePlayerUrl" as const, label: "Normal Player URL" },
                    { key: "gamePlayerHappyUrl" as const, label: "Happy Player URL" },
                    { key: "gamePlayerDizzyUrl" as const, label: "Dizzy Player URL" },
                    { key: "gamePlayerHungryUrl" as const, label: "Idle/Hungry URL" },
                  ].map((item) => (
                    <label key={item.key} className="block">
                      <span className="text-[11px] text-slate-400 block mb-1">
                        {item.label}
                      </span>
                      <input
                        type="text"
                        value={
                          (settings[item.key] || "").startsWith("data:")
                            ? "[Built-in Vector Sprite]"
                            : settings[item.key] || ""
                        }
                        onChange={(e) =>
                          handleChange(
                            item.key,
                            processGoogleDriveUrl(e.target.value),
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
                        placeholder="https://..."
                      />
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-emerald-400 block">
                      Good Items (+ Score)
                    </span>
                    {settings.gameGoodItemsUrls.map((url, i) => (
                      <div key={i} className="flex gap-1.5">
                        <input
                          type="text"
                          value={url.startsWith("data:") ? "[Built-in Star]" : url}
                          onChange={(e) => {
                            const next = [...settings.gameGoodItemsUrls];
                            next[i] = processGoogleDriveUrl(e.target.value);
                            handleChange("gameGoodItemsUrls", next);
                          }}
                          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                        />
                        <button
                          onClick={() =>
                            handleChange(
                              "gameGoodItemsUrls",
                              settings.gameGoodItemsUrls.filter(
                                (_, idx) => idx !== i,
                              ),
                            )
                          }
                          className="p-1.5 text-red-400 hover:bg-red-950 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        handleChange("gameGoodItemsUrls", [
                          ...settings.gameGoodItemsUrls,
                          "",
                        ])
                      }
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 cursor-pointer"
                    >
                      + เพิ่ม Good Item
                    </button>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-red-400 block">
                      Bad Items (- HP)
                    </span>
                    {settings.gameBadItemsUrls.map((url, i) => (
                      <div key={i} className="flex gap-1.5">
                        <input
                          type="text"
                          value={url.startsWith("data:") ? "[Built-in Hazard]" : url}
                          onChange={(e) => {
                            const next = [...settings.gameBadItemsUrls];
                            next[i] = processGoogleDriveUrl(e.target.value);
                            handleChange("gameBadItemsUrls", next);
                          }}
                          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white"
                        />
                        <button
                          onClick={() =>
                            handleChange(
                              "gameBadItemsUrls",
                              settings.gameBadItemsUrls.filter(
                                (_, idx) => idx !== i,
                              ),
                            )
                          }
                          className="p-1.5 text-red-400 hover:bg-red-950 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        handleChange("gameBadItemsUrls", [
                          ...settings.gameBadItemsUrls,
                          "",
                        ])
                      }
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 cursor-pointer"
                    >
                      + เพิ่ม Bad Item
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLOUD SYNC, API & SECURITY */}
        {activeTab === "cloud" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Firebase Cloud Sync */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-sky-400" />
                    Firebase Cloud Sync (หลายตู้ / ออนไลน์)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    ซิงค์การตั้งค่าตู้ คะแนน Leaderboard และสำรองรูปภาพ QR Code ข้ามอุปกรณ์
                  </p>
                </div>
              </div>

              {cloudUser ? (
                <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-emerald-400 font-semibold">
                      เชื่อมต่อ Cloud แล้ว
                    </div>
                    <div className="text-sm font-bold text-white truncate">
                      {cloudUser.email || cloudUser.displayName}
                    </div>
                  </div>
                  <button
                    onClick={() => signOutAdmin()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" /> ออกจากระบบ
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={cloudBusy}
                  className="w-full py-3 bg-white hover:bg-slate-100 text-slate-950 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4" /> เข้าสู่ระบบด้วย Google เพื่อเปิดใช้ Cloud Sync
                </button>
              )}

              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Kiosk Profile ID (ใช้ร่วมกันระหว่างหลายตู้)
                </span>
                <input
                  type="text"
                  value={settings.kioskId || "default-kiosk"}
                  onChange={(e) =>
                    handleChange(
                      "kioskId",
                      sanitizeFirestoreId(e.target.value, "default-kiosk"),
                    )
                  }
                  className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono text-white"
                  placeholder="main-event-booth"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePushConfig}
                  disabled={!cloudUser || cloudBusy}
                  className="py-2.5 px-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" /> Push Config ขึ้น Cloud
                </button>
                <button
                  onClick={handlePullConfig}
                  disabled={cloudBusy}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <DownloadCloud className="w-4 h-4" /> Pull Config จาก Cloud
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  ลิงก์เปิดตู้พร้อมดึงโปรไฟล์นี้จาก Cloud อัตโนมัติ
                </span>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    readOnly
                    value={syncShareUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300"
                  />
                  <button
                    onClick={handleCopySyncUrl}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedLink ? "คัดลอกแล้ว" : "คัดลอก"}
                  </button>
                </div>
              </div>

              {cloudFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                    cloudFeedback.ok
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-red-950/40 border-red-500/40 text-red-300"
                  }`}
                >
                  {cloudFeedback.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{cloudFeedback.message}</span>
                </div>
              )}
            </div>

            {/* API & Security PIN */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  ระบบอัปโหลดภาพ & ป้องกัน Rate Limit (429)
                </h2>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">
                    Primary ImgBB API Key
                  </span>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      type="text"
                      value={settings.imgbbApiKey}
                      onChange={(e) => handleChange("imgbbApiKey", e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                      placeholder="ใส่ ImgBB API Key..."
                    />
                    <button
                      type="button"
                      onClick={handleTestImgBB}
                      disabled={testingApi}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      {testingApi ? "กำลังทดสอบ..." : "Test API"}
                    </button>
                  </div>
                </label>

                {apiTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                      apiTestResult.ok
                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                        : "bg-red-950/40 border-red-500/40 text-red-300"
                    }`}
                  >
                    {apiTestResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{apiTestResult.message}</span>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs font-semibold text-slate-400">
                    Backup ImgBB API Key (ใช้สลับอัตโนมัติเมื่อ Key หลักเต็ม)
                  </span>
                  <input
                    type="text"
                    value={settings.backupApiKey || ""}
                    onChange={(e) => handleChange("backupApiKey", e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                    placeholder="Optional backup key..."
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">
                      โหมดสำรองเมื่ออัปโหลดไม่ผ่าน
                    </span>
                    <select
                      value={settings.fallbackStorageMode || "auto"}
                      onChange={(e) =>
                        handleChange(
                          "fallbackStorageMode",
                          e.target.value as "auto" | "imgbb_only",
                        )
                      }
                      className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white"
                    >
                      <option value="auto">
                        Auto Multi-Tier (ImgBB → FreeImage → Firebase)
                      </option>
                      <option value="imgbb_only">ImgBB Only</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">
                      Queue Throttle ({settings.clientThrottleMs || 600} ms)
                    </span>
                    <input
                      type="range"
                      min={250}
                      max={2500}
                      step={150}
                      value={settings.clientThrottleMs || 600}
                      onChange={(e) =>
                        handleChange(
                          "clientThrottleMs",
                          parseInt(e.target.value, 10),
                        )
                      }
                      className="mt-3 w-full accent-sky-500"
                    />
                  </label>
                </div>
              </div>

              {/* Admin PIN Protection */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  รหัสผ่านล็อกหน้า Admin (PIN Protection)
                </h2>
                <p className="text-xs text-slate-400">
                  ป้องกันผู้เล่นกดโดนปุ่มตั้งค่าหรือ F12 หน้างาน (ปล่อยว่างเพื่อปิดการถาม PIN)
                </p>
                <input
                  type="text"
                  maxLength={12}
                  value={settings.adminPin ?? "1234"}
                  onChange={(e) => handleChange("adminPin", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono text-white tracking-widest"
                  placeholder="เช่น 1234 (ว่าง = ไม่ล็อก)"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
