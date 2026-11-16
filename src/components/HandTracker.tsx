import React, { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useSettings } from "../config";
import { useCamera } from "../contexts/CameraContext";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

interface HandState {
  indexTip: { x: number; y: number };
  thumbTip: { x: number; y: number };
  isPinching: boolean;
  pinchDistance: number;
}

export function HandTracker() {
  const { videoRef, isCameraReady } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  const lastHoveredHands = useRef<(Element | null)[]>([null, null]);
  const wasPinchingHands = useRef<boolean[]>([false, false]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { settings } = useSettings();

  const showSkeletonRef = useRef(settings.showHandSkeleton);
  showSkeletonRef.current = settings.showHandSkeleton;

  const [handsVisual, setHandsVisual] = useState<HandState[]>([]);

  useEffect(() => {
    let isCancelled = false;

    const initLandmarker = async () => {
      if (!settings.cameraEnabled) return;
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
        if (!isCancelled) {
          landmarkerRef.current = landmarker;
          setIsLoaded(true);
          setErrorMsg("");
        } else {
          landmarker.close();
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("MediaPipe HandLandmarker Init error:", err);
          setErrorMsg(err?.message || "AI Hands init failed");
        }
      }
    };

    initLandmarker();

    return () => {
      isCancelled = true;
      setIsLoaded(false);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [settings.cameraEnabled]);

  useEffect(() => {
    if (!settings.cameraEnabled || !isCameraReady || !isLoaded) return;

    let requestRef = 0;
    let lastVideoTime = -1;
    let lastActivityDispatch = 0;

    const predict = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (
        video &&
        landmarker &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime
      ) {
        lastVideoTime = video.currentTime;
        const results = landmarker.detectForVideo(video, performance.now());

        const canvas = canvasRef.current;
        let ctx: CanvasRenderingContext2D | null = null;
        if (canvas) {
          if (
            canvas.width !== window.innerWidth ||
            canvas.height !== window.innerHeight
          ) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
          }
          ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        if (results.landmarks && results.landmarks.length > 0) {
          const now = Date.now();
          if (now - lastActivityDispatch > 1000) {
            lastActivityDispatch = now;
            window.dispatchEvent(new CustomEvent("kiosk-activity"));
          }

          const currentHandsVisual: HandState[] = [];
          const buttons = document.querySelectorAll(".touchless-btn");

          results.landmarks.forEach((landmarks, handIdx) => {
            if (handIdx >= 2) return;

            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            const screenIndexX = (1 - indexTip.x) * window.innerWidth;
            const screenIndexY = indexTip.y * window.innerHeight;

            const screenThumbX = (1 - thumbTip.x) * window.innerWidth;
            const screenThumbY = thumbTip.y * window.innerHeight;

            const dist = Math.hypot(
              screenIndexX - screenThumbX,
              screenIndexY - screenThumbY,
            );

            const isPinching = dist < 55;

            currentHandsVisual.push({
              indexTip: { x: screenIndexX, y: screenIndexY },
              thumbTip: { x: screenThumbX, y: screenThumbY },
              isPinching,
              pinchDistance: dist,
            });

            if (ctx) {
              if (showSkeletonRef.current) {
                // Full calibration skeleton (only when toggled ON in Admin)
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = isPinching
                  ? "rgba(239, 68, 68, 0.7)"
                  : "rgba(56, 189, 248, 0.55)";

                HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
                  const p1 = landmarks[startIdx];
                  const p2 = landmarks[endIdx];
                  ctx!.beginPath();
                  ctx!.moveTo((1 - p1.x) * window.innerWidth, p1.y * window.innerHeight);
                  ctx!.lineTo((1 - p2.x) * window.innerWidth, p2.y * window.innerHeight);
                  ctx!.stroke();
                });

                landmarks.forEach((p, idx) => {
                  const px = (1 - p.x) * window.innerWidth;
                  const py = p.y * window.innerHeight;
                  ctx!.beginPath();
                  if (idx === 8 || idx === 4) {
                    ctx!.arc(px, py, isPinching ? 7 : 6, 0, 2 * Math.PI);
                    ctx!.fillStyle = idx === 8 ? "#3b82f6" : "#f59e0b";
                  } else {
                    ctx!.arc(px, py, 3, 0, 2 * Math.PI);
                    ctx!.fillStyle = "rgba(255, 255, 255, 0.75)";
                  }
                  ctx!.fill();
                });
              } else if (isPinching) {
                // Clean index-tip-only mode: subtle pinch feedback ring without full skeleton
                ctx.beginPath();
                ctx.arc(screenIndexX, screenIndexY, 22, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
                ctx.lineWidth = 3;
                ctx.stroke();
              }
            }

            if (handIdx === 0) {
              window.dispatchEvent(
                new CustomEvent("virtual-move", {
                  detail: { clientX: screenIndexX, clientY: screenIndexY },
                }),
              );
            }

            let hoveredElement: Element | null = null;
            buttons.forEach((btn) => {
              const rect = btn.getBoundingClientRect();
              if (
                screenIndexX >= rect.left &&
                screenIndexX <= rect.right &&
                screenIndexY >= rect.top &&
                screenIndexY <= rect.bottom
              ) {
                hoveredElement = btn;
              }
            });

            if (hoveredElement !== lastHoveredHands.current[handIdx]) {
              if (lastHoveredHands.current[handIdx]) {
                lastHoveredHands.current[handIdx]?.dispatchEvent(
                  new CustomEvent("virtual-leave"),
                );
              }
              if (hoveredElement) {
                (hoveredElement as Element).dispatchEvent(
                  new CustomEvent("virtual-enter"),
                );
              }
              lastHoveredHands.current[handIdx] = hoveredElement;
            }

            const wasPinching = wasPinchingHands.current[handIdx];
            if (isPinching && !wasPinching) {
              if (hoveredElement) {
                (hoveredElement as Element).dispatchEvent(
                  new CustomEvent("virtual-click"),
                );
              }
              window.dispatchEvent(
                new CustomEvent("virtual-pinch", {
                  detail: {
                    handIndex: handIdx,
                    clientX: screenIndexX,
                    clientY: screenIndexY,
                  },
                }),
              );
            } else if (!isPinching && wasPinching) {
              window.dispatchEvent(
                new CustomEvent("virtual-release", {
                  detail: {
                    handIndex: handIdx,
                    clientX: screenIndexX,
                    clientY: screenIndexY,
                  },
                }),
              );
            }
            wasPinchingHands.current[handIdx] = isPinching;
          });

          if (results.landmarks.length < 2 && lastHoveredHands.current[1]) {
            lastHoveredHands.current[1]?.dispatchEvent(
              new CustomEvent("virtual-leave"),
            );
            lastHoveredHands.current[1] = null;
            wasPinchingHands.current[1] = false;
          }

          setHandsVisual(currentHandsVisual);
        } else {
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          [0, 1].forEach((idx) => {
            if (lastHoveredHands.current[idx]) {
              lastHoveredHands.current[idx]?.dispatchEvent(
                new CustomEvent("virtual-leave"),
              );
              lastHoveredHands.current[idx] = null;
            }
            wasPinchingHands.current[idx] = false;
          });
          setHandsVisual([]);
        }
      }

      requestRef = requestAnimationFrame(predict);
    };

    requestRef = requestAnimationFrame(predict);

    return () => {
      if (requestRef) cancelAnimationFrame(requestRef);
    };
  }, [settings.cameraEnabled, isCameraReady, isLoaded, videoRef]);

  if (!settings.cameraEnabled) return null;

  return (
    <>
      {errorMsg && (
        <div className="fixed top-4 right-4 bg-red-950/90 text-white px-4 py-3 rounded-xl font-mono text-xs z-[9999] shadow-xl border border-red-500/60 max-w-xs">
          <div className="font-bold text-red-300 mb-1">AR Hand Tracking Unavailable</div>
          <div className="text-red-200">{errorMsg}</div>
        </div>
      )}

      {!isLoaded && !errorMsg && (
        <div className="fixed top-4 left-4 bg-slate-900/85 text-slate-200 px-3.5 py-2 rounded-xl font-mono text-xs z-50 flex items-center gap-2 border border-slate-700/70">
          <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-sky-400 rounded-full animate-spin" />
          <span>Initializing AR Hands</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-[9998]"
      />

      {handsVisual.map((hand, i) => (
        <div
          key={i}
          className={`fixed top-0 left-0 rounded-full pointer-events-none z-[9999] transition-transform duration-75 ease-out flex items-center justify-center ${
            hand.isPinching
              ? "bg-red-500 border-2 border-white shadow-[0_0_24px_rgba(239,68,68,0.85)] scale-90"
              : "bg-sky-500/90 border-[3px] border-emerald-300 shadow-[0_0_18px_rgba(56,189,248,0.65)]"
          }`}
          style={{
            width: hand.isPinching ? "36px" : "30px",
            height: hand.isPinching ? "36px" : "30px",
            transform: `translate(${hand.indexTip.x}px, ${hand.indexTip.y}px)`,
            marginLeft: hand.isPinching ? "-18px" : "-15px",
            marginTop: hand.isPinching ? "-18px" : "-15px",
          }}
        >
          <span
            className={`rounded-full bg-white transition-all ${
              hand.isPinching ? "w-3 h-3" : "w-2 h-2"
            }`}
          />
        </div>
      ))}
    </>
  );
}
