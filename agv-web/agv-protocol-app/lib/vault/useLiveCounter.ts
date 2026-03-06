import { useEffect, useRef, useState } from "react";

/**
 * Hook for live counter animation using requestAnimationFrame
 * @param startValue - Initial value
 * @param perSecond - Rate of change per second
 * @returns Current animated value
 */
export function useLiveCounter(startValue: number, perSecond: number): number {
  const [value, setValue] = useState(startValue);
  const raf = useRef<number>();
  const lastTime = useRef<number>(performance.now());

  useEffect(() => {
    const tick = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime.current) / 1000; // Convert to seconds
      lastTime.current = currentTime;
      
      setValue(prevValue => prevValue + perSecond * deltaTime);
      raf.current = requestAnimationFrame(tick);
    };

    lastTime.current = performance.now();
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, [perSecond]);

  // Reset value when startValue changes
  useEffect(() => {
    setValue(startValue);
  }, [startValue]);

  return value;
}

/**
 * Hook for live counter with manual control
 * @param startValue - Initial value
 * @param perSecond - Rate of change per second
 * @returns Object with current value and control functions
 */
export function useLiveCounterWithControl(startValue: number, perSecond: number) {
  const [value, setValue] = useState(startValue);
  const [isRunning, setIsRunning] = useState(true);
  const raf = useRef<number>();
  const lastTime = useRef<number>(performance.now());

  useEffect(() => {
    if (!isRunning) return;

    const tick = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime.current) / 1000;
      lastTime.current = currentTime;
      
      setValue(prevValue => prevValue + perSecond * deltaTime);
      raf.current = requestAnimationFrame(tick);
    };

    lastTime.current = performance.now();
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, [perSecond, isRunning]);

  const start = () => setIsRunning(true);
  const stop = () => setIsRunning(false);
  const reset = () => setValue(startValue);

  return {
    value,
    isRunning,
    start,
    stop,
    reset
  };
}
