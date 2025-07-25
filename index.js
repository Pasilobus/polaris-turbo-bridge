// Polaris Turbo Bridge — v.0.0.1
// Lets <s-button> and <s-link> Shadow‑DOM elements from @shopify/polaris
// behave like normal Turbo Drive links in HTML‑over‑the‑wire apps.
//
// Zero dependencies. Works with Rails Import‑Map, esbuild, Vite, etc.

function csrfToken() {
  return document
    .querySelector("meta[name='csrf-token']")?.getAttribute("content") || "";
}

function submitViaForm(url, method) {
  const form = Object.assign(document.createElement("form"), {
    action: url,
    method: ["get", "post"].includes(method) ? method : "post",
    hidden: true,
  });

  if (!["get", "post"].includes(method)) {
    form.insertAdjacentHTML(
      "beforeend",
      `<input type="hidden" name="_method" value="${method.toUpperCase()}">`
    );
  }

  const token = csrfToken();
  if (token) {
    form.insertAdjacentHTML(
      "beforeend",
      `<input type="hidden" name="authenticity_token" value="${token}">`
    );
  }

  document.body.appendChild(form);
  form.requestSubmit();
}

export function PolarisTurboBridge() {
  document.addEventListener(
    "click",
    (event) => {
      const el = event.target.closest("s-button[href], s-link[href]");
      if (!el) return;

      // Respect modifier keys and external targets
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        el.getAttribute("target") === "_blank"
      ) return;

      event.preventDefault();

      const url         = el.getAttribute("href");
      const method      = (el.dataset.turboMethod || "get").toLowerCase();
      const frame       = el.dataset.turboFrame;
      const confirmText = el.dataset.turboConfirm;

      if (confirmText && !confirm(confirmText)) return;

      if (method === "get") {
        // Requires @hotwired/turbo-rails or turbo.js already loaded
        Turbo.visit(url, { frame });
      } else {
        submitViaForm(url, method);
      }
    },
    true // capture phase (before Polaris stops propagation)
  );
}

// Auto‑start if the flag is set ──────────────────────────────────────────
if (typeof window !== "undefined" && window.POLARIS_TURBO_AUTOSTART) {
  if (typeof window.Turbo !== "undefined") {
    PolarisTurboBridge();                // ✅ Turbo present → start
  } else {
    console.warn(
      "[polaris‑turbo‑bridge] POLARIS_TURBO_AUTOSTART is true, " +
        "but Turbo is not loaded. Bridge disabled."
    );
  }
}