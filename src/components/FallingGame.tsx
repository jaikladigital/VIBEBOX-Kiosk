import { useEffect, useRef, useState } from "react";
import { useSettings } from "../config";
import { playSound } from "../utils/audio";
import {
  processGoogleDriveUrl,
  getGoogleDriveVideoUrl,
} from "../utils/urlHelper";

interface FallingGameProps {
  onGameOver: (result: { score: number; level: number }) => void;
}

export function FallingGame({ onGameOver }: FallingGameProps) {
  const { settings } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const basketRef = useRef<HTMLElement>(null);
  const objectsContainerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60); // Base timer
  const [isLoaded, setIsLoaded] = useState(false);

  const imagesRef = useRef<{
    player: {
      normal: any;
      happy: any;
      dizzy: any;
      hungry: any;
    };
    good: {
      element: HTMLImageElement | HTMLVideoElement;
      isVideo: boolean;
      src: string;
      width: number;
    }[];
    bad: {
      element: HTMLImageElement | HTMLVideoElement;
      isVideo: boolean;
      src: string;
      width: number;
    }[];
  }>({
    player: { normal: null, happy: null, dizzy: null, hungry: null },
    good: [],
    bad: [],
  });

  const gameStateRef = useRef({
    score: 0,
    level: 1,
    hp: 3,
    timeLeft: 60,
    basketX: 640,
    playerState: "normal" as "normal" | "happy" | "dizzy" | "hungry",
    playerStateEndTime: 0,
    lastHitTime: 0,
    hungryToggleTime: 0,
    objects: [] as {
      x: number;
      y: number;
      type: "good" | "bad";
      speed: number;
      media: {
        element: HTMLImageElement | HTMLVideoElement;
        isVideo: boolean;
        src: string;
        width: number;
      };
      size: number;
    }[],
    lastSpawnTime: 0,
    startTime: 0, // set when loaded
  });

  // Preload images
  useEffect(() => {
    let loadedCount = 0;
    const totalAssets =
      4 +
      (settings.gameGoodItemsUrls?.length || 0) +
      (settings.gameBadItemsUrls?.length || 0);

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalAssets) {
        setIsLoaded(true);
        gameStateRef.current.startTime = Date.now();
      }
    };

    const loadMedia = (url: string) => {
      const processedUrl = processGoogleDriveUrl(url);
      const result = {
        element: new Image() as HTMLElement,
        isVideo: false,
        src: processedUrl,
        width: 0,
      };
      if (!processedUrl) {
        setTimeout(checkLoaded, 0);
        return result as any;
      }

      const isHtmlVideo = processedUrl.match(/\.(mp4|webm|mov)$/i);

      if (isHtmlVideo) {
        const video = document.createElement("video");
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.onloadeddata = () => {
          result.width = video.videoWidth || 1;
          checkLoaded();
        };
        video.onerror = checkLoaded;
        video.src = processedUrl;
        result.element = video;
        result.isVideo = true;
      } else {
        const img = new Image();
        img.onload = () => {
          result.width = img.naturalWidth || 1;
          checkLoaded();
        };
        img.onerror = () => {
          const videoFallbackUrl =
            getGoogleDriveVideoUrl(processedUrl) || processedUrl;
          const video = document.createElement("video");
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.onloadeddata = () => {
            result.element = video;
            result.isVideo = true;
            result.src = videoFallbackUrl;
            result.width = video.videoWidth || 1;
            checkLoaded();
          };
          video.onerror = checkLoaded;
          video.src = videoFallbackUrl;
        };
        img.src = processedUrl;
        result.element = img;
      }
      return result;
    };

    imagesRef.current.player.normal = loadMedia(settings.gamePlayerUrl);
    imagesRef.current.player.happy = loadMedia(settings.gamePlayerHappyUrl);
    imagesRef.current.player.dizzy = loadMedia(settings.gamePlayerDizzyUrl);
    imagesRef.current.player.hungry = loadMedia(settings.gamePlayerHungryUrl);

    imagesRef.current.good = (settings.gameGoodItemsUrls || []).map(loadMedia);
    imagesRef.current.bad = (settings.gameBadItemsUrls || []).map(loadMedia);
  }, [settings]);

  useEffect(() => {
    if (!isLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handlePointerMove = (clientX: number) => {
      const gameArea = gameAreaRef.current || canvasRef.current;
      if (!gameArea) return;
      const rect = gameArea.getBoundingClientRect();
      const scaleX = 1280 / rect.width;
      gameStateRef.current.basketX = (clientX - rect.left) * scaleX;
    };

    const handlePinchGrab = (clientX: number, clientY: number) => {
      const gameArea = gameAreaRef.current || canvasRef.current;
      if (!gameArea) return;
      const rect = gameArea.getBoundingClientRect();
      const scaleX = 1280 / rect.width;
      const scaleY = 720 / rect.height;
      const pinchX = (clientX - rect.left) * scaleX;
      const pinchY = (clientY - rect.top) * scaleY;

      const state = gameStateRef.current;
      // Check if pinching any falling item directly
      for (let i = state.objects.length - 1; i >= 0; i--) {
        const obj = state.objects[i];
        const dist = Math.hypot(obj.x - pinchX, obj.y - pinchY);
        // If pinched near the object (within object size + margin)
        if (dist <= obj.size * 0.9) {
          if (obj.type === "good") {
            state.score += 15; // Bonus score for precise pinch catch!
            setScore(state.score);
            playSound("good", settings.isMuted);
            state.playerState = "happy";
            state.playerStateEndTime = Date.now() + 2000;
            state.lastHitTime = Date.now();
          } else {
            // Pinched a bad item
            state.hp -= 1;
            setHp(state.hp);
            playSound("bad", settings.isMuted);
            state.playerState = "dizzy";
            state.playerStateEndTime = Date.now() + 2000;
            state.lastHitTime = Date.now();
          }
          state.objects.splice(i, 1);
          break;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => handlePointerMove(e.clientX);
    const onVirtualMove = (e: CustomEvent) =>
      handlePointerMove(e.detail.clientX);
    const onVirtualPinch = (e: CustomEvent) =>
      handlePinchGrab(e.detail.clientX, e.detail.clientY);

    const gameArea = gameAreaRef.current || canvasRef.current;
    if (gameArea) {
      gameArea.addEventListener("pointermove", onPointerMove);
    }
    window.addEventListener("virtual-move", onVirtualMove as EventListener);
    window.addEventListener("virtual-pinch", onVirtualPinch as EventListener);

    const update = () => {
      const state = gameStateRef.current;
      const now = Date.now();

      // Check level update (e.g., every 50 points = 1 level)
      const newLevel = Math.floor(state.score / 50) + 1;
      if (newLevel !== state.level) {
        state.level = newLevel;
        setLevel(newLevel);
      }

      // Update Timer
      const elapsedSeconds = Math.floor((now - state.startTime) / 1000);
      const newTimeLeft = Math.max(0, 60 - elapsedSeconds);
      if (newTimeLeft !== state.timeLeft) {
        state.timeLeft = newTimeLeft;
        setTimeLeft(newTimeLeft);
      }

      // Check Game Over
      if (state.timeLeft <= 0 || state.hp <= 0) {
        onGameOver({ score: state.score, level: state.level });
        return;
      }

      // Spawn Objects dynamic
      const spawnDelay = Math.max(200, 800 - state.level * 50);
      if (now - state.lastSpawnTime > spawnDelay) {
        const isBad = Math.random() < 0.2 + state.level * 0.05; // More bad items at higher levels
        const rawImgArr = isBad
          ? imagesRef.current.bad
          : imagesRef.current.good;
        const validImgArr = rawImgArr.filter((i) => i.src && i.width > 0);

        if (validImgArr.length > 0) {
          const media =
            validImgArr[Math.floor(Math.random() * validImgArr.length)];
          // Size adjustment
          // Make it proportional to the player character (200x200)
          const targetSize = isBad ? 120 : 130;
          state.objects.push({
            x: Math.random() * (canvas.width - targetSize) + targetSize / 2,
            y: -targetSize,
            type: isBad ? "bad" : "good",
            speed: 4 + Math.random() * 3 + state.level * 0.5,
            media: media,
            size: targetSize,
          });
          state.lastSpawnTime = now;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Player Bucket
      const basketW = 200;
      const basketH = 200;
      const basketY = 720 - 240; // 480
      state.basketX = Math.max(
        basketW / 2,
        Math.min(1280 - basketW / 2, state.basketX),
      );

      if (basketRef.current) {
        basketRef.current.style.left = `${(state.basketX / 1280) * 100}%`;
      }

      // Update and Draw Objects
      for (let i = state.objects.length - 1; i >= 0; i--) {
        const obj = state.objects[i];
        obj.y += obj.speed;

        // Collision - make horizontal area larger for easier catching
        if (
          obj.y + obj.size / 2 > basketY + 20 &&
          obj.y - obj.size / 2 < basketY + basketH &&
          obj.x > state.basketX - basketW / 2 - 80 &&
          obj.x < state.basketX + basketW / 2 + 80
        ) {
          if (obj.type === "good") {
            state.score += 10;
            setScore(state.score);
            playSound("good", settings.isMuted);
            state.playerState = "happy";
            state.playerStateEndTime = Date.now() + 2000;
            state.lastHitTime = Date.now();
          } else {
            state.hp -= 1;
            setHp(state.hp);
            playSound("bad", settings.isMuted);
            state.playerState = "dizzy";
            state.playerStateEndTime = Date.now() + 2000;
            state.lastHitTime = Date.now();
          }
          state.objects.splice(i, 1);
          continue;
        }

        // Out of bounds
        if (obj.y > 720 + obj.size) {
          if (obj.type === "good") {
            // Missed good item, deduct HP!
            state.hp -= 1;
            setHp(state.hp);
            playSound("bad", settings.isMuted);
          }
          state.objects.splice(i, 1);
        }
      }

      // Handle Idle state transitions
      if (Date.now() > state.playerStateEndTime) {
        if (Date.now() - state.lastHitTime > 5000) {
          if (Date.now() - state.hungryToggleTime > 2000) {
            const hasHungry = !!imagesRef.current.player.hungry?.src;
            if (hasHungry) {
              state.playerState =
                state.playerState === "hungry" ? "normal" : "hungry";
            } else {
              state.playerState = "normal";
            }
            state.hungryToggleTime = Date.now();
          }
        } else {
          state.playerState = "normal";
        }
      }

      let activeStateKey = state.playerState;
      if (!(imagesRef.current.player as any)[activeStateKey]?.src) {
        activeStateKey = "normal";
      }

      // Update player visual representation
      if (basketRef.current) {
        const children = basketRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement;
          if (child.getAttribute("data-player-state") === activeStateKey) {
            child.style.opacity = "1";
          } else {
            child.style.opacity = "0";
          }
        }
      }

      // Sync Objects to DOM
      const container = objectsContainerRef.current;
      if (container) {
        const currentNodes = Array.from(container.children) as HTMLElement[];

        state.objects.forEach((obj, index) => {
          let node = currentNodes[index] as
            | HTMLImageElement
            | HTMLVideoElement
            | undefined;

          const tagNameObj = obj.media.isVideo ? "VIDEO" : "IMG";

          if (!node || node.tagName !== tagNameObj) {
            if (node) container.removeChild(node);
            node = document.createElement(tagNameObj.toLowerCase()) as
              | HTMLImageElement
              | HTMLVideoElement;
            node.className =
              "absolute origin-center -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none";
            if (obj.media.isVideo) {
              const v = node as HTMLVideoElement;
              v.autoplay = true;
              v.loop = true;
              v.muted = true;
              v.playsInline = true;
            }
            if (currentNodes[index])
              container.insertBefore(node, currentNodes[index]);
            else container.appendChild(node);
            currentNodes[index] = node;
          }

          if (obj.media && node.getAttribute("src") !== obj.media.src) {
            node.setAttribute("src", obj.media.src);
          }
          node.style.left = `${(obj.x / 1280) * 100}%`;
          node.style.top = `${(obj.y / 720) * 100}%`;
          node.style.width = `${(obj.size / 1280) * 100}%`;
          node.style.height = `${(obj.size / 720) * 100}%`;
        });

        // Remove extra nodes
        while (container.children.length > state.objects.length) {
          container.removeChild(container.lastChild!);
        }
      }

      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (gameArea) gameArea.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener(
        "virtual-move",
        onVirtualMove as EventListener,
      );
      window.removeEventListener(
        "virtual-pinch",
        onVirtualPinch as EventListener,
      );
    };
  }, [onGameOver, isLoaded, settings.isMuted]);

  if (!isLoaded) {
    return (
      <div className="absolute inset-0 z-10 font-sans flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
        <div className="text-white text-2xl font-bold font-mono animate-pulse">
          PRELOADING ASSETS...
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-10 font-sans">
      <div className="absolute top-6 left-6 font-mono tabular-nums text-xl sm:text-2xl font-bold bg-slate-900/85 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-700 text-white shadow-xl flex items-center gap-6 sm:gap-8">
        <div className="text-emerald-400">
          SCORE: {score.toString().padStart(4, "0")}
        </div>
        <div className="text-sky-400">LVL: {level}</div>
        <div className="text-amber-400">TIME: {timeLeft}s</div>
        <div className="text-red-400">HP: {"♥".repeat(Math.max(0, hp))}</div>
        <div className="hidden lg:block text-xs font-sans text-slate-300 font-medium border-l border-slate-700 pl-5">
          เลื่อนมือบังคับ · จีบนิ้ว (Pinch) คว้าไอเทมกลางอากาศ
        </div>
      </div>

      <div
        ref={gameAreaRef}
        className="w-full h-full touch-none cursor-none relative overflow-hidden"
        style={{ width: "100vw", height: "100vh" }}
      >
        <div
          ref={basketRef as any}
          className="absolute origin-center -translate-x-1/2 pointer-events-none select-none z-20"
          style={{
            top: `${(480 / 720) * 100}%`,
            width: `${(200 / 1280) * 100}%`,
            height: `${(200 / 720) * 100}%`,
          }}
        >
          {["normal", "happy", "dizzy", "hungry"].map((stateKey) => {
            const mediaObj = (imagesRef.current.player as any)[stateKey];
            if (!mediaObj || !mediaObj.src) return null;
            if (mediaObj.isVideo) {
              return (
                <video
                  key={stateKey}
                  data-player-state={stateKey}
                  src={mediaObj.src}
                  className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200"
                  style={{ opacity: stateKey === "normal" ? 1 : 0 }}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              );
            }
            return (
              <img
                key={stateKey}
                data-player-state={stateKey}
                src={mediaObj.src}
                className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200"
                style={{ opacity: stateKey === "normal" ? 1 : 0 }}
                alt={`player-${stateKey}`}
              />
            );
          })}
        </div>
        <div
          ref={objectsContainerRef}
          className="absolute inset-0 pointer-events-none select-none z-10"
        />

        {/* We keep the canvas for pointer events but make it invisible */}
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="w-full h-full opacity-0 pointer-events-none"
        />
      </div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-400 text-sm animate-pulse pointer-events-none bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
        Move your mouse / drag finger to catch the good items! Avoid bad items.
        Don't drop good items!
      </div>
    </div>
  );
}
