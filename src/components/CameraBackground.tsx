import { useEffect, useState } from "react";
import { useSettings } from "../config";
import { useCamera } from "../contexts/CameraContext";
import { X } from "lucide-react";
import {
  getGoogleDriveVideoUrl,
  processGoogleDriveUrl,
  getYoutubeVideoId,
  isImageUrl,
} from "../utils/urlHelper";

export function CameraBackground({ gameState }: { gameState?: string }) {
  const { videoRef, stream, cameraError } = useCamera();
  const { settings, updateSettings } = useSettings();
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isVideoHidden, setIsVideoHidden] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, videoRef]);

  useEffect(() => {
    if (gameState === "START") {
      setIsVideoHidden(false);
    }
  }, [gameState]);

  useEffect(() => {
    if (settings.screensaverVideos?.length) {
      if (currentVideoIndex >= settings.screensaverVideos.length) {
        setCurrentVideoIndex(0);
      }
    }
  }, [settings.screensaverVideos, currentVideoIndex]);

  useEffect(() => {
    let ytTimer: number;
    if (
      settings.screensaverEnabled &&
      !settings.cameraEnabled &&
      !isVideoHidden &&
      settings.screensaverVideos &&
      settings.screensaverVideos.length > 1
    ) {
      const currentUrl = settings.screensaverVideos[currentVideoIndex];
      if (getYoutubeVideoId(currentUrl) || isImageUrl(currentUrl)) {
        ytTimer = window.setTimeout(() => {
          setCurrentVideoIndex(
            (prev) => (prev + 1) % settings.screensaverVideos.length,
          );
        }, 15000);
      }
    }
    return () => clearTimeout(ytTimer);
  }, [
    currentVideoIndex,
    settings.screensaverVideos,
    settings.screensaverEnabled,
    settings.cameraEnabled,
    isVideoHidden,
  ]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute top-0 left-0 w-full h-full object-cover -scale-x-100 opacity-75 ${
          cameraError || !settings.cameraEnabled ? "hidden" : ""
        }`}
      />
      {!settings.cameraEnabled && (
        <>
          {settings.screensaverEnabled &&
          settings.screensaverVideos &&
          settings.screensaverVideos.length > 0 &&
          settings.screensaverVideos[currentVideoIndex] &&
          !isVideoHidden ? (
            <div className="absolute inset-0 z-[65] bg-black group">
              {getYoutubeVideoId(
                settings.screensaverVideos[currentVideoIndex],
              ) ? (
                <iframe
                  key={`yt-${currentVideoIndex}`}
                  src={`https://www.youtube.com/embed/${getYoutubeVideoId(
                    settings.screensaverVideos[currentVideoIndex],
                  )}?autoplay=1&mute=1&controls=0&loop=1&playlist=${getYoutubeVideoId(
                    settings.screensaverVideos[currentVideoIndex],
                  )}&rel=0&showinfo=0`}
                  allow="autoplay; encrypted-media"
                  className="w-full h-full object-contain pointer-events-auto"
                />
              ) : isImageUrl(settings.screensaverVideos[currentVideoIndex]) ? (
                <img
                  key={`img-${currentVideoIndex}`}
                  src={processGoogleDriveUrl(
                    settings.screensaverVideos[currentVideoIndex],
                  )}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                  alt="screensaver"
                  onError={() => {
                    if (
                      settings.screensaverVideos &&
                      settings.screensaverVideos.length > 1
                    ) {
                      setCurrentVideoIndex(
                        (prev) =>
                          (prev + 1) % settings.screensaverVideos.length,
                      );
                    }
                  }}
                />
              ) : (
                <video
                  key={currentVideoIndex}
                  src={
                    getGoogleDriveVideoUrl(
                      settings.screensaverVideos[currentVideoIndex],
                    ) ||
                    processGoogleDriveUrl(
                      settings.screensaverVideos[currentVideoIndex],
                    )
                  }
                  autoPlay
                  loop={settings.screensaverVideos.length === 1}
                  muted
                  playsInline
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onEnded={() => {
                    if (
                      settings.screensaverVideos &&
                      settings.screensaverVideos.length > 1
                    ) {
                      setCurrentVideoIndex(
                        (prev) =>
                          (prev + 1) % settings.screensaverVideos.length,
                      );
                    }
                  }}
                  onError={() => {
                    if (
                      settings.screensaverVideos &&
                      settings.screensaverVideos.length > 1
                    ) {
                      setCurrentVideoIndex(
                        (prev) =>
                          (prev + 1) % settings.screensaverVideos.length,
                      );
                    }
                  }}
                  className="w-full h-full object-contain"
                />
              )}
              <button
                onClick={() => setIsVideoHidden(true)}
                className="absolute top-6 right-6 sm:top-10 sm:right-10 w-16 h-16 sm:w-20 sm:h-20 bg-black/50 hover:bg-red-600 active:scale-90 text-white rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/30 transition-all shadow-2xl z-10 cursor-pointer pointer-events-auto"
                aria-label="Close Video"
              >
                <X className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={2.5} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => updateSettings({ cameraEnabled: true })}
            className="absolute top-6 left-1/2 -translate-x-1/2 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 px-6 z-[60] shadow-xl rounded-xl border border-amber-300 cursor-pointer transition-transform active:scale-95"
          >
            <div className="flex items-center gap-3 whitespace-nowrap">
              <span className="text-sm font-extrabold tracking-tight">
                กล้องปิดอยู่ (F8 หรือคลิกเพื่อเปิดกล้อง)
              </span>
            </div>
          </button>
        </>
      )}
      {cameraError && settings.cameraEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 z-40 p-6">
          <div className="bg-slate-900 p-6 sm:p-8 rounded-2xl border border-red-500/50 shadow-2xl text-center max-w-sm">
            <h3 className="text-xl font-bold text-red-400 mb-2">
              Camera Access Required
            </h3>
            <p className="text-slate-300 text-sm mb-4">{cameraError}</p>
            <p className="text-slate-400 text-xs">
              Please allow camera permissions in your browser and refresh or press F8.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
