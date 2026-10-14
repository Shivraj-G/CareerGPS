import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cssPath = path.resolve(__dirname, '../../styles.css');
const mainJsxPath = path.resolve(__dirname, '../../main.jsx');
const legacyPagesJsxPath = path.resolve(__dirname, '../../pages/LegacyPages.jsx');

const css = fs.readFileSync(cssPath, 'utf8');
const mainJsx = fs.readFileSync(mainJsxPath, 'utf8');
const legacyPagesJsx = fs.readFileSync(legacyPagesJsxPath, 'utf8');

test('Opportunities Mobile Responsive UI Verification Suite', async (t) => {
  await t.test('1. Full-width search input row occupies its own row on mobile', () => {
    // Check that .opportunity-filter is styled as a vertical column flow on mobile
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-filter\s*\{[^}]*flex-direction:\s*column/);
    // Check that .opportunity-search-row occupies 100% width and has comfortable touch target height
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-search-row\s*\{[^}]*width:\s*100%/);
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-search-row\s*\{[^}]*height:\s*44px/);
  });

  await t.test('2. Filters section is positioned below search in a compact, accessible, horizontally usable section', () => {
    // Check that .opportunity-filter-controls is display: flex and horizontally scrollable with touch momentum
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-filter-controls\s*\{[^}]*display:\s*flex/);
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-filter-controls\s*\{[^}]*overflow-x:\s*auto/);
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-filter-controls\s*\{[^}]*-webkit-overflow-scrolling:\s*touch/);
  });

  await t.test('3. Filter dropdowns have comfortable touch targets (min 42px), legible font, and no clipping', () => {
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-filter-controls select\s*\{[^}]*height:\s*42px/);
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-filter-controls select\s*\{[^}]*font-size:\s*13px/);
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-filter-controls select\s*\{[^}]*min-height:\s*42px/);
  });

  await t.test('4. Opportunity cards have polished mobile layout with title hierarchy and natural wrapping', () => {
    // Cards have 3-column mobile grid with logo, content, and right arrow
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-card\s*\{[^}]*grid-template-columns:\s*42px minmax\(0,\s*1fr\)\s*auto/);
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-card\s*\{[^}]*border-radius:\s*12px/);
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opp-main h2\s*\{[^}]*overflow-wrap:\s*break-word/);
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opp-main p\s*\{[^}]*overflow-wrap:\s*break-word/);
    // Arrow is explicitly displayed on mobile
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.opportunity-card>svg:last-child\s*\{[^}]*display:\s*block/);
  });

  await t.test('5. Safety padding prevents floating chatbot widget from overlapping bottom page content', () => {
    // Listing page or page content has bottom padding on mobile
    assert.match(css, /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.listing-page\s*\{[^}]*padding-bottom:\s*clamp\(50px/);
  });

  await t.test('6. Narrow viewports (320px–360px) are specifically optimized', () => {
    assert.match(css, /@media\s*\(\s*max-width:\s*360px\s*\)[^{]*\{[\s\S]*?\.opportunity-card\s*\{[^}]*grid-template-columns:\s*36px minmax\(0,\s*1fr\)\s*auto/);
    assert.match(css, /@media\s*\(\s*max-width:\s*360px\s*\)[^{]*\{[\s\S]*?\.opp-logo\s*\{[^}]*width:\s*36px/);
  });

  await t.test('7. main.jsx and LegacyPages.jsx filterBar structures are synchronized', () => {
    assert.match(mainJsx, /className="opportunity-search-row"/);
    assert.match(mainJsx, /className="opportunity-filter-controls"/);
    assert.match(legacyPagesJsx, /className="opportunity-search-row"/);
    assert.match(legacyPagesJsx, /className="opportunity-filter-controls"/);
  });

  await t.test('8. Desktop and tablet UI (>768px) is preserved without regression', () => {
    assert.match(css, /\.opportunity-card\s*\{[^}]*border-radius:\s*12px/);
    assert.match(css, /\.opportunity-search-row\s*\{[^}]*display:\s*flex/);
    assert.match(css, /\.opportunity-results-summary\s*\{/);
  });
});
