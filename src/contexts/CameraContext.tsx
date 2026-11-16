import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { useSettings } from "../config";

interface CameraContextType {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isCameraReady: boolean;
  cameraError: string;
  restartCamera: () => void;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export function CameraProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [restartTick, setRestartTick] = useState(0);

  const restartCamera = useCallback(() => {
    setRestartTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    const startCamera = async () => {
      if (!settings.cameraEnabled) {
        setIsCameraReady(false);
        setStream(null);
        setCameraError("");
        return;
      }

      setCameraError("");
      setIsCameraReady(false);

      const isLandscape = settings.orientation === "LANDSCAPE";
      const idealWidth = isLandscape ? 1280 : 1080;
      const idealHeight = isLandscape ? 720 : 1920;

      const primaryConstraints: MediaStreamConstraints = {
        video: {
          width: { ideal: idealWidth },
          height: { ideal: idealHeight },
          facingMode: "user",
          ...(settings.selectedCameraId
            ? { deviceId: { exact: settings.selectedCameraId } }
            : {}),
        },
        audio: false,
      };

      try {
        activeStream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      } catch (err) {
        console.warn("Primary camera constraints failed, trying fallback:", err);
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        } catch (fallbackErr: any) {
          if (!isCancelled) {
            console.error("Failed to access camera:", fallbackErr);
            setCameraError(fallbackErr?.message || "Camera permission denied");
          }
          return;
        }
      }

      if (isCancelled) {
        activeStream?.getTracks().forEach((t) => t.stop());
        return;
      }

      setStream(activeStream);

      const video = videoRef.current;
      if (video && activeStream) {
        video.srcObject = activeStream;
        video.onloadedmetadata = async () => {
          try {
            await video.play();
            if (!isCancelled) setIsCameraReady(true);
          } catch (playErr) {
            console.warn("Video autoplay notice:", playErr);
            if (!isCancelled) setIsCameraReady(true);
          }
        };
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      setIsCameraReady(false);
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [settings.cameraEnabled, settings.selectedCameraId, settings.orientation, restartTick]);

  return (
    <CameraContext.Provider
      value={{ videoRef, stream, isCameraReady, cameraError, restartCamera }}
    >
      {children}
    </CameraContext.Provider>
  );
}

export function useCamera() {
  const ctx = useContext(CameraContext);
  if (!ctx) {
    throw new Error("useCamera must be used within a CameraProvider");
  }
  return ctx;
}
