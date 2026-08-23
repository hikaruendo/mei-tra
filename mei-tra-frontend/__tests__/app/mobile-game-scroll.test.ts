import fs from 'fs';
import path from 'path';

describe('mobile active game layout', () => {
  it('keeps content below the viewport reachable by vertical scrolling', () => {
    const stylesheet = fs.readFileSync(
      path.join(process.cwd(), 'app/[locale]/index.module.css'),
      'utf8',
    );

    expect(stylesheet).toMatch(
      /@media \(max-width: 768px\)[\s\S]*?\.activeGameWrapper\s*\{[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(stylesheet).toMatch(
      /\.activeGameWrapper\s*\{[\s\S]*?padding-bottom:\s*max\(0\.75rem, env\(safe-area-inset-bottom\)\);/,
    );
  });
});
