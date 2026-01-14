import React, { useRef, useCallback, useEffect } from 'react';

interface ResizableDividerProps {
  direction: 'vertical' | 'horizontal';
  onResize: (delta: number) => void;
  className?: string;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
  direction,
  onResize,
  className = '',
}) => {
  const isResizing = useRef(false);
  const startPos = useRef(0);
  const onResizeRef = useRef(onResize);

  // Keep onResizeRef.current up to date
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const handleMouseMove = useCallback((e: MouseEvent | PointerEvent) => {
    if (!isResizing.current) return;
    e.preventDefault();
    
    const currentPos = direction === 'vertical' ? e.clientX : e.clientY;
    const delta = currentPos - startPos.current;
    onResizeRef.current(delta); // Use ref instead of prop directly
    startPos.current = currentPos;
  }, [direction]);

  const handleMouseUp = useCallback(() => {
    if (!isResizing.current) return;
    
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('pointermove', handleMouseMove);
    document.removeEventListener('pointerup', handleMouseUp);
    window.removeEventListener('mouseleave', handleMouseUp);
    window.removeEventListener('blur', handleMouseUp);
    
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startPos.current = direction === 'vertical' ? e.clientX : e.clientY;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove);
    document.addEventListener('pointerup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseUp);
    window.addEventListener('blur', handleMouseUp);
    
    document.body.style.userSelect = 'none';
    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
  }, [direction, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      if (isResizing.current) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('pointermove', handleMouseMove);
        document.removeEventListener('pointerup', handleMouseUp);
        window.removeEventListener('mouseleave', handleMouseUp);
        window.removeEventListener('blur', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`${direction === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} bg-slate-200 hover:bg-indigo-400 transition-colors ${className}`}
      style={{ 
        flexShrink: 0,
        zIndex: 10
      }}
    />
  );
};
