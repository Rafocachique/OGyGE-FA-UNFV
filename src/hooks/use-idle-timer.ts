
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseIdleTimerProps {
  onIdle: () => void;
  idleTime: number;
}

export const useIdleTimer = ({ onIdle, idleTime }: UseIdleTimerProps) => {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    timeoutId.current = setTimeout(() => {
      setIsIdle(true);
      onIdle();
    }, idleTime);
  }, [idleTime, onIdle]);

  const resetTimer = useCallback(() => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    setIsIdle(false);
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    
    events.forEach(event => window.addEventListener(event, resetTimer));
    startTimer();

    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [resetTimer, startTimer]);

  return { isIdle: () => isIdle };
};
