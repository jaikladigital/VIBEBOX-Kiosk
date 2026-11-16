import { useState, useEffect, ReactNode, useRef } from "react";
import type React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

interface TouchlessButtonProps {
  onClick: () => void;
  children: ReactNode;
  id?: string;
  title?: string;
  className?: string;
  delayMs?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
  key?: React.Key | null;
}

export function TouchlessButton({
  onClick,
  children,
  id,
  title,
  className = "",
  delayMs = 1500,
  disabled = false,
  style = {},
}: TouchlessButtonProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState(0);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Always keep latest callback & disabled state so virtual pinch never triggers stale closures
  const onClickRef = useRef(onClick);
  const disabledRef = useRef(disabled);
  onClickRef.current = onClick;
  disabledRef.current = disabled;

  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;

    const handleVirtualEnter = () => {
      if (!disabledRef.current) setIsHovering(true);
    };
    const handleVirtualLeave = () => setIsHovering(false);
    const handleVirtualClick = () => {
      if (!disabledRef.current) {
        onClickRef.current();
        setIsHovering(false);
        setProgress(0);
      }
    };

    btn.addEventListener("virtual-enter", handleVirtualEnter);
    btn.addEventListener("virtual-leave", handleVirtualLeave);
    btn.addEventListener("virtual-click", handleVirtualClick);

    return () => {
      btn.removeEventListener("virtual-enter", handleVirtualEnter);
      btn.removeEventListener("virtual-leave", handleVirtualLeave);
      btn.removeEventListener("virtual-click", handleVirtualClick);
    };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isHovering && !disabled) {
      const step = 50;
      const increment = (step / delayMs) * 100;

      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 100;
          return prev + increment;
        });
      }, step);
    } else {
      setProgress(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isHovering, disabled, delayMs]);

  useEffect(() => {
    if (progress >= 100 && !disabledRef.current) {
      onClickRef.current();
      setIsHovering(false);
      setProgress(0);
    }
  }, [progress]);

  return (
    <div
      ref={buttonRef}
      id={id}
      title={title}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={`touchless-btn relative overflow-hidden cursor-pointer touch-none select-none min-h-[44px] ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
      style={style}
      onPointerEnter={() => {
        if (!disabled) setIsHovering(true);
      }}
      onPointerLeave={() => setIsHovering(false)}
      onPointerDown={() => {
        if (!disabled) onClickRef.current();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onClickRef.current();
        }
      }}
    >
      {progress > 0 && progress < 100 && (
        <div
          className="absolute left-0 bottom-0 top-0 bg-white/20 transition-all duration-75 ease-linear z-0 pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="relative z-10 flex items-center justify-center w-full h-full">
        {children}

        <AnimatePresence>
          {isHovering && progress > 5 && progress < 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              className="absolute right-4 text-white drop-shadow-md pointer-events-none"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
