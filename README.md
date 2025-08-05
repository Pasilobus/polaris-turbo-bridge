# Polaris‑Turbo‑Bridge

> Let every [`<s-button>`](https://shopify.dev/docs/api/app-home/polaris-web-components/actions/button) and [`<s-link>`](https://shopify.dev/docs/api/app-home/polaris-web-components/actions/link) from **@shopify/polaris** behave like a first‑class Hotwire **Turbo Drive** link.

*Zero dependencies, <2 kB minified, works with Import‑Map, esbuild, Vite, Webpacker.*

---

## Why?

Polaris Web Components render their own `<a>` tag inside **Shadow DOM**.  
Turbo Drive’s global click listener never “sees” that anchor, so navigation is blocked.  
This bridge captures clicks on the host element, honours `data‑turbo-*` attributes, and
delegates to `Turbo.visit()` (or a hidden form for REST verbs).

```
<s-button href="/posts" icon="products">Posts</s-button>

<s-button href="/posts/42"
          data-turbo-method="delete"
          data-turbo-confirm="Really?"
          tone="critical">
  Delete
</s-button>
```

---

## Install

### 1 · Load the Polaris Web Component bundle

Polaris Web Components are distributed only as a pre‑built script.
Add it once in your HTML <head> (Rails layout or equivalent):

```
<!-- app/views/layouts/application.html.erb -->
<head>
  …
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge-ui-experimental.js"></script>
</head>
```

### 2 · Pin and start the Turbo bridge

#### Rails 8 + Import‑Map

```bash
pin "polaris-turbo-bridge",
    to: "https://ga.jspm.io/npm:polaris-turbo-bridge@0.0.7/index.js",
    preload: true
```

```js
// app/javascript/application.js
import "@hotwired/turbo-rails";
import { PolarisTurboBridge } from "polaris-turbo-bridge";

PolarisTurboBridge();
```

#### npm / pnpm / yarn

```bash
npm i polaris-turbo-bridge
```

```js
import { PolarisTurboBridge } from "polaris-turbo-bridge";
PolarisTurboBridge();
```

---

## Features

* **GET navigation** via `Turbo.visit()`  
* **`data-turbo-method`** (`delete`, `patch`, etc.) via hidden form with CSRF token  
* **`data-turbo-confirm`** native prompt (override for custom modals)  
* **`data-turbo-frame`** partial updates  
* Respects ⌘‑click, Ctrl‑click, Shift‑click, `target="_blank"`  
* Works everywhere Turbo works (Rails, Phoenix, Django, Laravel…)

---

## API

### `PolarisTurboBridge(options)`

Initialises the global click listener. Call once after Turbo has loaded.  
Set `window.POLARIS_TURBO_AUTOSTART = true` **before** the script tag if you
want the bridge to start automatically.

#### Options (optional)

Hide the body during navigation to prevent layout shift:

```js
PolarisTurboBridge({
  hideBodyOnNavigation: true,
  bodyHideClass: 'hidden',
  pageSelector: 's-page'
});
```

This will add the `hidden` class to `<s-page>` elements during navigation.

---

## Contributing

1. `pnpm i`
2. `pnpm test` (coming soon)
3. Submit a PR

---

## License

MIT © 2025 — see [LICENSE](./LICENSE)
