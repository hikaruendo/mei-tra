import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CardDesignPicker } from '@/components/profile/CardDesignPicker';
import { CardFace } from '@/components/game/CardFace';
import { CardDesignContext } from '@/contexts/CardDesignContext';
import { DENSHO_ASSET_REVISION, denshoImagePath } from '@meitra/game-client/card-art';
import type { CardDesign } from '@meitra/contracts/profile';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

it('changes the selected preview without changing the saved game design', () => {
  function Preview() {
    const [design, setDesign] = useState<CardDesign>('standard');
    return <><CardDesignPicker value={design} onChange={setDesign} /><CardFace card="A♠" /></>;
  }
  render(<Preview />);
  fireEvent.click(screen.getByRole('radio', { name: 'cardDesign_densho' }));
  expect(screen.getByRole('radio', { name: 'cardDesign_densho' })).toBeChecked();
  expect(screen.getByRole('img', { name: 'A♠' })).toHaveAttribute('src', '/cards/A_S.svg');
});

it('updates all supplied artwork when the signed-in profile changes, retuning other faces', () => {
  const cards = <><CardFace card="A♠" /><CardFace card="JOKER" /><CardFace faceDown /><CardFace card="K♥" /></>;
  const { rerender, container } = render(<CardDesignContext.Provider value="standard">{cards}</CardDesignContext.Provider>);
  expect(container.querySelectorAll('svg image')).toHaveLength(0);
  rerender(<CardDesignContext.Provider value="densho">{cards}</CardDesignContext.Provider>);
  for (const [label, id] of [['A♠', 'A_S'], ['JOKER', 'joker_red'], ['Card back', 'card_back'], ['K♥', 'K_H']]) {
    expect(screen.getByRole('img', { name: label })).toHaveAttribute('src', `${denshoImagePath(id)}?v=${DENSHO_ASSET_REVISION}`);
  }
  rerender(<CardDesignContext.Provider value="standard">{cards}</CardDesignContext.Provider>);
  expect(screen.getByRole('img', { name: 'A♠' })).toHaveAttribute('src', '/cards/A_S.svg');
});

it('disables both designs during save', () => {
  render(<CardDesignPicker value="densho" onChange={jest.fn()} disabled />);
  screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());
});
