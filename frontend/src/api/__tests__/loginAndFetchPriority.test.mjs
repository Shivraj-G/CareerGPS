import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../..');

describe('NaviGoa Login Redesign & fetchPriority Console Warning Fix Suite', () => {
  const mainJsxPath = path.join(frontendDir, 'src/main.jsx');
  const loginJsxPath = path.join(frontendDir, 'src/pages/Login.jsx');
  const stylesCssPath = path.join(frontendDir, 'src/styles.css');

  const mainJsxContent = fs.readFileSync(mainJsxPath, 'utf8');
  const loginJsxContent = fs.readFileSync(loginJsxPath, 'utf8');
  const stylesCssContent = fs.readFileSync(stylesCssPath, 'utf8');

  test('1. fetchPriority warning is eliminated at root source by using standard HTML fetchpriority in React 18', () => {
    // Must NOT contain camelCase fetchPriority which React 18 rejects with a DOM warning
    assert.strictEqual(
      mainJsxContent.includes('fetchPriority='),
      false,
      'main.jsx must not contain camelCase fetchPriority prop'
    );

    // Must contain lowercase fetchpriority="high"
    assert.strictEqual(
      mainJsxContent.includes('fetchpriority="high"'),
      true,
      'main.jsx hero image must include fetchpriority="high"'
    );

    // Verify React 18 renders it to DOM without any warning
    const originalConsoleError = console.error;
    let warningLogged = false;
    console.error = (msg, ...args) => {
      if (typeof msg === 'string' && msg.includes('fetchPriority')) {
        warningLogged = true;
      }
      originalConsoleError(msg, ...args);
    };

    try {
      const rendered = ReactDOMServer.renderToString(
        React.createElement('img', {
          src: '/goa-fontainhas-street.jpg',
          alt: 'Fontainhas',
          fetchpriority: 'high',
        })
      );
      assert.strictEqual(rendered.includes('fetchpriority="high"'), true);
      assert.strictEqual(warningLogged, false, 'No React warning should be logged for fetchpriority');
    } finally {
      console.error = originalConsoleError;
    }
  });

  test('2. Login page establishes an intentional unified composition with the NaviGoa logo and card', () => {
    assert.strictEqual(
      mainJsxContent.includes('className="auth-container"'),
      true,
      'Login must wrap brand and card in unified auth-container'
    );
    assert.strictEqual(
      mainJsxContent.includes('className="auth-brand-header"'),
      true,
      'Login must have auth-brand-header'
    );
    assert.strictEqual(
      mainJsxContent.includes('className="auth-logo-img"'),
      true,
      'Login must have dedicated auth-logo-img'
    );
    assert.strictEqual(
      mainJsxContent.includes('src="/navigoa-logo.jpg"'),
      true,
      'Login must use official NaviGoa logo'
    );
  });

  test('3. Welcome content matches NaviGoa brand standards and professional career guidance tone', () => {
    assert.strictEqual(
      mainJsxContent.includes('<h1>Welcome back</h1>'),
      true,
      'Login must feature Welcome back heading'
    );
    assert.strictEqual(
      mainJsxContent.includes('Sign in to continue your NaviGoa career journey.'),
      true,
      'Login must feature prompt-specified welcome copy'
    );
  });

  test('4. Form includes password visibility toggle and accessible aria labels', () => {
    assert.strictEqual(
      mainJsxContent.includes('showPassword ? "text" : "password"'),
      true,
      'Login must support dynamic password visibility'
    );
    assert.strictEqual(
      mainJsxContent.includes('className="auth-password-toggle"'),
      true,
      'Login must have auth-password-toggle button'
    );
    assert.strictEqual(
      mainJsxContent.includes('aria-label={showPassword ? "Hide password" : "Show password"}'),
      true,
      'Password toggle must have accessible aria-label'
    );
  });

  test('5. Form includes accessible email and password inputs with autofill attributes', () => {
    assert.strictEqual(
      mainJsxContent.includes('autoComplete="email"'),
      true,
      'Email input must have autoComplete="email"'
    );
    assert.strictEqual(
      mainJsxContent.includes('autoComplete="current-password"'),
      true,
      'Password input must have autoComplete="current-password"'
    );
    assert.strictEqual(
      mainJsxContent.includes('aria-describedby='),
      true,
      'Inputs must have aria-describedby for validation error binding'
    );
  });

  test('6. Authentication states and error messaging are fully preserved', () => {
    assert.strictEqual(
      mainJsxContent.includes('api.login({'),
      true,
      'handleSubmit must call api.login'
    );
    assert.strictEqual(
      mainJsxContent.includes('UNKNOWN_EMAIL'),
      true,
      'Must handle UNKNOWN_EMAIL error'
    );
    assert.strictEqual(
      mainJsxContent.includes('INVALID_PASSWORD'),
      true,
      'Must handle INVALID_PASSWORD error'
    );
    assert.strictEqual(
      mainJsxContent.includes('if (submitting) return;'),
      true,
      'Must prevent multiple submissions while in flight'
    );
  });

  test('7. Navigation links preserve account creation and return-home pathways', () => {
    assert.strictEqual(
      mainJsxContent.includes('New to NaviGoa? <Link to="/signup">Create an account</Link>'),
      true,
      'Must preserve Create an account link pointing to /signup'
    );
    assert.strictEqual(
      mainJsxContent.includes('className="auth-back-link"'),
      true,
      'Must provide return to home link'
    );
  });

  test('8. Responsive CSS eliminates floating absolute logo and provides balanced layout', () => {
    // .auth-brand must NOT be position: absolute
    assert.strictEqual(
      stylesCssContent.includes('.auth-brand{position:absolute'),
      false,
      '.auth-brand must no longer be absolutely positioned in top-left'
    );
    assert.strictEqual(
      stylesCssContent.includes('.auth-brand{left:18px}'),
      false,
      '.auth-brand must not have mobile left offset'
    );

    // .auth-logo-img preserves 3:2 aspect ratio
    assert.strictEqual(
      stylesCssContent.includes('aspect-ratio:3/2') || stylesCssContent.includes('aspect-ratio: 3 / 2'),
      true,
      'Logo must have explicit aspect-ratio: 3/2'
    );
    assert.strictEqual(
      stylesCssContent.includes('object-fit:contain') || stylesCssContent.includes('object-fit: contain'),
      true,
      'Logo must have object-fit: contain to prevent distortion'
    );

    // .auth-page supports 100dvh for mobile keyboards
    assert.strictEqual(
      stylesCssContent.includes('min-height:100dvh'),
      true,
      '.auth-page must support dynamic viewport height'
    );

    // Mobile width handling (e.g. 320px-440px)
    assert.strictEqual(
      stylesCssContent.includes('@media (max-width: 440px)') || stylesCssContent.includes('@media(max-width:440px)'),
      true,
      'Must include targeted mobile breakpoint for narrow screens'
    );

    // Prefers reduced motion
    assert.strictEqual(
      stylesCssContent.includes('prefers-reduced-motion'),
      true,
      'Must support prefers-reduced-motion'
    );
  });

  test('9. src/pages/Login.jsx is kept completely synchronized with main.jsx implementation', () => {
    assert.strictEqual(
      loginJsxContent.includes('className="auth-container"'),
      true,
      'Login.jsx must have auth-container'
    );
    assert.strictEqual(
      loginJsxContent.includes('Sign in to continue your NaviGoa career journey.'),
      true,
      'Login.jsx must have updated welcome copy'
    );
    assert.strictEqual(
      loginJsxContent.includes('auth-password-toggle'),
      true,
      'Login.jsx must have password toggle'
    );
  });
});
