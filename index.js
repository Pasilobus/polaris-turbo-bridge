// Polaris Turbo Bridge — v0.0.6
// Lets <s-button> and <s-link> Shadow‑DOM elements work with Turbo
// and neutralises Shopify App‑Bridge auto‑redirects.
//
// Zero deps – usable with Import‑Map, esbuild, Vite, etc.

function csrfToken() {
  return (
    document.querySelector("meta[name='csrf-token']")?.getAttribute("content") ||
    ""
  );
}

function markNoAppRedirect(el) {
  // 1 · on the host element
  if (
    el.getAttribute("data-turbo") !== "false" &&
    !el.hasAttribute("data-app-redirect")
  ) {
    el.setAttribute("data-app-redirect", "false");
  }

  // 2 · inside the shadow anchor (App‑Bridge looks there)
  const anchor = el.shadowRoot?.querySelector("a[href]");
  if (
    anchor &&
    anchor.getAttribute("data-turbo") !== "false" &&
    !anchor.hasAttribute("data-app-redirect")
  ) {
    anchor.setAttribute("data-app-redirect", "false");
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
  const scan = (root) =>
    root
      .querySelectorAll("s-button[href], s-link[href], s-clickable[href]")
      .forEach(markNoAppRedirect);

  scan(document); // initial DOM

  const mo = new MutationObserver((muts) => {
    muts.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          if (node.matches("s-button[href], s-link[href], s-clickable[href]")) markNoAppRedirect(node);
          scan(node); // nested
        }
      });
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener(
    "click",
    (event) => {
      const el = event.target.closest("s-button[href], s-link[href], s-clickable[href]");
      if (!el) return;

      // Skip if already loading
      if (el.getAttribute('loading') === 'true') {
        event.preventDefault();
        return;
      }

      // Respect modifier keys / new‑tab
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        el.getAttribute("target") === "_blank"
      )
        return;

      // Check if already handled
      if (event.defaultPrevented) return;
      
      // Mark as handled
      event.preventDefault();
      event.stopImmediatePropagation(); // <- stop App‑Bridge listeners

      const url = el.getAttribute("href");
      const method = (el.dataset.turboMethod || "get").toLowerCase();
      const frame = el.dataset.turboFrame;
      const confirmText = el.dataset.turboConfirm;

      if (confirmText && !confirm(confirmText)) return;

      // Check element type
      const tagName = el.tagName.toLowerCase();
      const isLink = tagName === 's-link';
      const needsLoading = (tagName === 's-button' || tagName === 's-clickable') && !frame;

      if (needsLoading) {
        // For buttons and clickables: show loading state with delay
        el.setAttribute('loading', 'true');
        
        // Force browser to render the loading state
        void el.offsetHeight;
        
        // Small delay to ensure loading spinner is visible
        setTimeout(() => {
          if (method === "get") {
            Turbo.visit(url, { frame });
          } else {
            submitViaForm(url, method);
          }
        }, 100);
      } else {
        // For links and frame navigations: go immediately
        if (method === "get") {
          Turbo.visit(url, { frame });
        } else {
          submitViaForm(url, method);
        }
      }
    },
    true
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