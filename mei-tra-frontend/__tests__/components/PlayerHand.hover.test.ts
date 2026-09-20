/** @jest-environment node */
import path from 'node:path';
import { compile } from 'sass';

// A hovering hand card must retain its hit area. Moving it (or its neighbours)
// can move that area away from a stationary cursor, repeatedly toggling :hover.
// Compile the real stylesheet so this guard also covers responsive overrides.
it('keeps every hand-card hover rule free of geometry and stacking changes', () => {
  const css = compile(path.join(process.cwd(), 'components/game/PlayerHand/index.module.scss')).css
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
  const hoverRules = rules.filter(([, selectors]) =>
    selectors.split(',').some((selector) =>
      /\.(?:card|spectatorCard)(?=[\s:.[#]|$)/.test(selector) && selector.includes(':hover'),
    ),
  );
  expect(hoverRules.length).toBeGreaterThan(0);

  const geometry = /^(?:transform|translate|rotate|scale|margin(?:-.+)?|padding(?:-.+)?|(?:min-|max-)?(?:width|height|inline-size|block-size)|aspect-ratio|inset(?:-.+)?|top|right|bottom|left|position|display|order|flex(?:-.+)?|gap|z-index)$/;
  const unstable = hoverRules.flatMap(([, selectors, body]) =>
    [...body.matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)]
      .map(([, property]) => property)
      .filter((property) => geometry.test(property))
      .map((property) => `${selectors.trim()}: ${property}`),
  );
  expect(unstable).toEqual([]);
});
