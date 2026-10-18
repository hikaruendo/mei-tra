import { act, fireEvent, render, screen } from '@testing-library/react';
import { CardFace } from '@/components/game/CardFace';
import { CardDesignContext } from '@/contexts/CardDesignContext';

it('shows the card identity until artwork loads and after a failed load', () => {
  const { container } = render(<CardDesignContext.Provider value="densho"><CardFace card="A♥" /></CardDesignContext.Provider>);
  const image = screen.getByRole('img', { name: 'A♥' });
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('A♥');
  expect(image).toHaveStyle({ opacity: '0' });

  fireEvent.load(image);
  expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  expect(image).toHaveStyle({ opacity: '1' });

  fireEvent.error(image);
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('A♥');
  expect(image).toHaveStyle({ opacity: '0' });
});

it('resets loading state when a card changes without revealing a face-down card', () => {
  const { rerender, container } = render(<CardFace card="A♠" />);
  fireEvent.load(screen.getByRole('img', { name: 'A♠' }));
  rerender(<CardFace card="K♦" />);
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('K♦');
  rerender(<CardFace card="K♦" faceDown />);
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('M');
  expect(container.querySelector('[aria-hidden="true"]')).not.toHaveTextContent('K♦');
});

it('retries a failed image without requiring a page reload', () => {
  jest.useFakeTimers();
  const { unmount } = render(<CardFace card="5♠" />);
  const image = screen.getByRole('img', { name: '5♠' });
  fireEvent.error(image);
  act(() => jest.advanceTimersByTime(1500));
  expect(image).toHaveAttribute('src', '/cards/5_S.svg?retry=1');
  fireEvent.load(image);
  expect(image).toHaveStyle({ opacity: '1' });
  unmount();
  jest.useRealTimers();
});
