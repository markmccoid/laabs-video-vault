# @lvv/ui

The Organic Desktop design system's CSS, shared by `apps/desktop` and `apps/extension`:

- `tokens.css` is generated from the system's `tokens.json` (Light and Dark, `data-theme` override). Regenerate it rather than editing by hand when tokens change.
- `organic.css` is the system's component layer (`components/bundle.css`).
- `fonts.css` bundles the fonts through `@fontsource` instead of Google Fonts.

Import them in that order (fonts, tokens, organic), then the app's own layout CSS. CSS only: components stay in each app.
