// Polaris Turbo Bridge — v0.0.3
// Lets <s-button> and <s-link> Shadow‑DOM elements work with Turbo
// and neutralises Shopify App‑Bridge auto‑redirects.
//
// Zero deps – usable with Import‑Map, esbuild, Vite, etc.

/* ---------- small helpers --------------------------------------- */
function csrfToken() {
  return (
    document.querySelector("meta[name='csrf-token']")?.getAttribute("content") ||
    ""
  );
}

function ensureNoAppRedirect(el) {
  if (
    el.getAttribute("data-turbo") !== "false" &&            // Turbo allowed
    !el.hasAttribute("data-app-redirect")                   // not set yet
  ) {
    el.setAttribute("data-app-redirect", "false");          // stop App‑Bridge
  }
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
  document
    .querySelectorAll("s-button[href]:not([data-app-redirect]), s-link[href]:not([data-app-redirect])")
    .forEach(ensureNoAppRedirect);

  const mo = new MutationObserver((muts) => {
    muts.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (
          node instanceof Element &&
          (node.matches("s-button[href]") || node.matches("s-link[href]"))
        ) {
          ensureNoAppRedirect(node);
        } else if (node.querySelectorAll) {
          node
            .querySelectorAll("s-button[href], s-link[href]")
            .forEach(ensureNoAppRedirect);
        }
      });
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

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
      )
        return;

      event.preventDefault();

      const url = el.getAttribute("href");
      const method = (el.dataset.turboMethod || "get").toLowerCase();
      const frame = el.dataset.turboFrame;
      const confirmText = el.dataset.turboConfirm;

      if (confirmText && !confirm(confirmText)) return;

      if (method === "get") {
        Turbo.visit(url, { frame });
      } else {
        submitViaForm(url, method);
      }
    },
    true // capture phase (runs before Polaris stops propagation)
  );
}

if (typeof window !== "undefined" && window.POLARIS_TURBO_AUTOSTART) {
  if (typeof window.Turbo !== "undefined") {
    PolarisTurboBridge();
  } else {
    console.warn(
      "[polaris-turbo-bridge] POLARIS_TURBO_AUTOSTART is true, " +
        "but Turbo is not loaded; bridge disabled."
    );
  }
}