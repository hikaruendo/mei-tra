// The supplied ace and Tanzen use white paper, charcoal ink and muted costume
// colours. Keep each standard card's pips/illustration and retune its SVG paint.
const PALETTE = {
  '#fdfeee': '#ffffff',
  '#010101': '#202123',
  '#000000': '#202123',
  '#000400': '#202123',
  '#fe0000': '#c92e2b',
  '#df0000': '#a73832',
  '#b400b4': '#a73832',
  '#a6152a': '#a73832',
  '#e2d200': '#bd9644',
  '#dcd00f': '#bd9644',
  '#1156a1': '#728f8e',
};

function paint(color) {
  const key = color.toLowerCase();
  if (PALETTE[key]) return PALETTE[key];
  const [red, green, blue] = key.slice(1).match(/../g).map(part => parseInt(part, 16));
  if (blue > red && blue > green) return '#a2b4af';
  if (green > red && green > blue) return '#7d8461';
  return color;
}

export function styleDenshoSvg(svg) {
  return svg
    .replace(/#[0-9a-f]{6}\b/gi, paint)
    .replace(/<text\b[\s\S]*?<\/text>/g, text => text
      .replace(/font-family:Arial/g, 'font-family:Georgia,serif')
      .replace(/-inkscape-font-specification:[^;]+;/g, '')
      .replace(/font-size:52\.5px/g, 'font-size:45px')
      .replace(/stroke:#[0-9a-f]{6}/gi, 'stroke:none'));
}
