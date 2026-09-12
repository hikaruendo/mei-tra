import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { ProDraggableCard } from '@/components/game/PlayerHand/ProDraggableCard';

// jsdom does not provide PointerEvent. Keep real dnd-kit sensors in this test.
class TestPointerEvent extends MouseEvent {
  readonly isPrimary = true;
  readonly pointerId = 1;
}

function DragHand({ enabled = true }: { enabled?: boolean }) {
  const [active, setActive] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 6 },
  }));
  return (
    <DndContext sensors={sensors} onDragStart={() => setActive(true)}
      onDragEnd={() => setActive(false)} onDragCancel={() => setActive(false)}>
      <ProDraggableCard card="H-A" enabled={enabled}>
        <span data-testid="hand-card">H-A</span>
      </ProDraggableCard>
      <DragOverlay dropAnimation={null}>
        {active ? <span data-testid="overlay-card">H-A</span> : null}
      </DragOverlay>
    </DndContext>
  );
}

describe('ProDraggableCard with DragOverlay', () => {
  const originalPointerEvent = window.PointerEvent;
  beforeAll(() => {
    window.PointerEvent = TestPointerEvent as typeof PointerEvent;
  });
  afterAll(() => {
    window.PointerEvent = originalPointerEvent;
  });

  it.each(['drop', 'cancel'])('shows only the overlay during a drag and restores the source after %s', async (end) => {
    render(<DragHand />);
    const source = screen.getByTestId('hand-card');
    const slot = source.parentElement!;
    jest.spyOn(slot, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 100, left: 100, top: 100, right: 180, bottom: 220,
      width: 80, height: 120, toJSON: () => ({}),
    });
    expect(source).toBeVisible();
    await act(async () => {
      fireEvent.pointerDown(source, { clientX: 110, clientY: 110, button: 0 });
      fireEvent.pointerMove(document, { clientX: 140, clientY: 150 });
    });
    await act(async () => {
      fireEvent.pointerMove(document, { clientX: 180, clientY: 170 });
    });

    expect(screen.getByTestId('overlay-card')).toBeVisible();
    expect(source).not.toBeVisible();
    expect(slot.style.transform).toBe('');
    expect(slot.style.display).not.toBe('none');

    await act(async () => {
      if (end === 'drop') fireEvent.pointerUp(document);
      else fireEvent.keyDown(document, { code: 'Escape' });
    });

    expect(source).toBeVisible();
    expect(screen.queryByTestId('overlay-card')).not.toBeInTheDocument();
  });

  it('keeps the source visible and does not activate dnd-kit when disabled', async () => {
    render(<DragHand enabled={false} />);
    const source = screen.getByTestId('hand-card');
    await act(async () => {
      fireEvent.pointerDown(source, { clientX: 110, clientY: 110, button: 0 });
      fireEvent.pointerMove(document, { clientX: 180, clientY: 170 });
    });
    expect(source).toBeVisible();
    expect(screen.queryByTestId('overlay-card')).not.toBeInTheDocument();
  });
});
