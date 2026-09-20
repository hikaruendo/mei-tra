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
  return slimSuits(svg)
    .replace(/#[0-9a-f]{6}\b/gi, paint)
    .replace(/<text\b[\s\S]*?<\/text>/g, text => text
      .replace(/font-family:Arial/g, 'font-family:Georgia,serif')
      .replace(/-inkscape-font-specification:[^;]+;/g, '')
      .replace(/font-size:52\.5px/g, 'font-size:45px')
      .replace(/stroke:#[0-9a-f]{6}/gi, 'stroke:none'));
}

// These source pips use only move, cubic, horizontal and close commands.
// Control-point bounds give a stable centre for their symmetric silhouettes.
// Reject new path syntax so a source-art change cannot silently move a pip.
function suitCenter(data) {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/g);
  const points = [];
  let x = 0;
  let y = 0;
  let start = [0, 0];
  let command;
  for (let i = 0; i < tokens.length;) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
    else if (!['c', 'h'].includes(command?.toLowerCase())) throw new Error('Unsupported repeated suit path command');
    const relative = command === command.toLowerCase();
    const pair = () => {
      const px = Number(tokens[i++]);
      const py = Number(tokens[i++]);
      if (!Number.isFinite(px) || !Number.isFinite(py)) throw new Error('Invalid suit path');
      return [px + (relative ? x : 0), py + (relative ? y : 0)];
    };
    switch (command.toLowerCase()) {
      case 'm':
        [x, y] = pair();
        start = [x, y];
        points.push([x, y]);
        break;
      case 'c': {
        const control1 = pair();
        const control2 = pair();
        const end = pair();
        points.push(control1, control2, end);
        [x, y] = end;
        break;
      }
      case 'h':
        x = Number(tokens[i++]) + (relative ? x : 0);
        points.push([x, y]);
        break;
      case 'z':
        [x, y] = start;
        break;
      default:
        throw new Error(`Unsupported suit path command: ${command}`);
    }
  }
  return [0, 1].map(axis => (Math.min(...points.map(point => point[axis])) + Math.max(...points.map(point => point[axis]))) / 2);
}

function slimSuits(svg) {
  return svg.replace(/<path\b[\s\S]*?\/>/g, path => {
    const data = path.match(/\bd="([^"]+)"/)?.[1];
    // Suit silhouettes are short stroked paths; court illustrations are
    // compound paths with thousands of coordinates and retain their size.
    if (!data || data.length >= 2000 || !path.includes('stroke:#000000')) return path;
    if (/\btransform=/.test(path)) throw new Error('Suit path gained a transform; review scaling');
    const [cx, cy] = suitCenter(data);
    return path.replace('<path', `<path transform="translate(${cx} ${cy}) scale(0.58 0.72) translate(${-cx} ${-cy})"`)
      .replace(/stroke:#[0-9a-f]{6}/gi, 'stroke:none');
  });
}
