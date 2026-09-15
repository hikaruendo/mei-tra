import React from 'react';
import { useDraggable } from '@dnd-kit/core';

export const ProDraggableCard = ({ card, enabled = true, children }: {
  card: string;
  enabled?: boolean;
  children: React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pro-card:${card}`,
    data: { card },
    disabled: !enabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...(enabled ? listeners : {})}
      {...(enabled ? attributes : {})}
      style={{
        // DragOverlay owns movement. Preserve the source slot and pointer
        // capture while hiding its artwork until the drag ends or is cancelled.
        opacity: enabled && isDragging ? 0 : undefined,
      }}
    >
      {children}
    </div>
  );
};
