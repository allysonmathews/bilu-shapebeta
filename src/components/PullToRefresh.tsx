import React, { useCallback, useRef, useState } from 'react';
import { NeonSpinner } from './ui/NeonSpinner';

const PULL_THRESHOLD = 56;
const PULL_MAX = 100;
const PULL_RESISTANCE = 0.5;

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

/**
 * Pull-to-Refresh: puxar para atualizar.
 * - Gesto de pull com "esticar" o topo.
 * - Spinner Neon (Verde Limão) durante o refresh.
 * - Funciona em touch e suporte básico a mouse (arrastar no topo).
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPointerDown = useRef(false);
  const pullDistanceRef = useRef(0);
  const isPullingRef = useRef(false);

  pullDistanceRef.current = pullDistance;

  const runRefresh = useCallback(async () => {
    if (refreshing || disabled) return;
    setRefreshing(true);
    setPullDistance(0);
    pullDistanceRef.current = 0;
    isPullingRef.current = false;
    try {
      const p = onRefresh();
      if (p && typeof (p as Promise<unknown>).then === 'function') {
        await (p as Promise<void>);
      }
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing, disabled]);

  const handleStart = useCallback(
    (clientY: number) => {
      if (disabled) return;
      const el = scrollRef.current;
      if (!el) return;
      isPointerDown.current = true;
      isPullingRef.current = false;
      startY.current = clientY;
    },
    [disabled]
  );

  const handleMove = useCallback(
    (clientY: number) => {
      if (disabled || !isPointerDown.current) return;
      const el = scrollRef.current;
      if (!el) return;

      const atTop = el.scrollTop <= 0;
      const delta = clientY - startY.current;

      if (atTop && delta > 0) {
        isPullingRef.current = true;
        const pulled = Math.min(delta * PULL_RESISTANCE, PULL_MAX);
        setPullDistance(pulled);
        pullDistanceRef.current = pulled;
      }
    },
    [disabled]
  );

  const handleEnd = useCallback(() => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    const latest = pullDistanceRef.current;

    if (refreshing) return;

    if (latest >= PULL_THRESHOLD) {
      runRefresh();
    } else {
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
    isPullingRef.current = false;
  }, [refreshing, runRefresh]);

  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientY);
  const onTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientY);
    if (isPullingRef.current && (scrollRef.current?.scrollTop ?? 0) <= 0) {
      e.preventDefault();
    }
  };
  const onTouchEnd = () => handleEnd();

  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientY);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPointerDown.current) return;
    handleMove(e.clientY);
  };
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => {
    if (isPointerDown.current) handleEnd();
  };

  const showRefresher = pullDistance > 0 || refreshing;
  const stretchHeight = Math.max(pullDistance, refreshing ? PULL_THRESHOLD : 0);
  const scale = refreshing ? 1 : 0.5 + 0.5 * Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      ref={scrollRef}
      className={`h-full overflow-y-auto overscroll-contain ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden bg-deep-bg transition-[height] duration-200 ease-out"
        style={{
          height: showRefresher ? stretchHeight : 0,
          minHeight: showRefresher ? stretchHeight : 0,
        }}
      >
        <div
          className="flex items-center justify-center transition-transform duration-150 ease-out"
          style={{ transform: `scale(${scale})` }}
        >
          <NeonSpinner size={28} />
        </div>
      </div>
      <div className="min-h-full">{children}</div>
    </div>
  );
};
