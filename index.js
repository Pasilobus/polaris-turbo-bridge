
// Polaris Turbo Bridge — v0.0.9
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

export function PolarisTurboBridge(options = {}) {
  // Configuration options
  const config = {
    hideBodyOnNavigation: options.hideBodyOnNavigation || false,
    bodyHideClass: options.bodyHideClass || 'hidden',
    pageSelector: options.pageSelector || 's-page',
    ...options
  };

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

  // Handle form submissions to add loading state to submit buttons
  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      // Find s-button elements with type="submit" or variant="primary"
      let submitButton = form.querySelector('s-button[type="submit"]');
      
      // If no explicit submit button, look for primary variant
      if (!submitButton) {
        submitButton = form.querySelector('s-button[variant="primary"]');
      }
      
      // If still not found, check if the submitter is an s-button
      if (!submitButton && event.submitter) {
        const submitterButton = event.submitter.tagName.toLowerCase() === 's-button' ? event.submitter : event.submitter.closest('s-button');
        if (submitterButton) {
          // Verify it's a submit type or primary variant
          const type = submitterButton.getAttribute('type');
          const variant = submitterButton.getAttribute('variant');
          if (type === 'submit' || variant === 'primary' || (!type && !variant)) {
            submitButton = submitterButton;
          }
        }
      }
      
      if (submitButton && submitButton.tagName.toLowerCase() === 's-button') {
        submitButton.setAttribute('loading', 'true');
      }

      // If Shopify App Bridge is available, show global loading state
      if (typeof window.shopify !== 'undefined' && window.shopify.loading) {
        window.shopify.loading(true);
      }

      // Check if this is a delete form (either method="delete" or has _method=DELETE input)
      const formMethod = form.method.toLowerCase();
      const hasDeleteMethodInput = form.querySelector('input[name="_method"][value="DELETE"]');
      const isDeleteForm = formMethod === 'delete' || hasDeleteMethodInput || form.hasAttribute('data-turbo-confirm');

      // Optionally hide body on form submission if it's a GET request and NOT a delete
      if (config.hideBodyOnNavigation && formMethod === 'get' && !isDeleteForm) {
        const pageElement = document.body.querySelector(config.pageSelector);
        if (pageElement) {
          pageElement.classList.add(config.bodyHideClass);
        }
      }
    },
    true
  );

  // Remove loading state when Turbo completes navigation
  document.addEventListener("turbo:load", () => {
    // Remove loading from all buttons and clickables
    document.querySelectorAll('s-button[loading="true"], s-clickable[loading="true"]').forEach(el => {
      el.removeAttribute('loading');
      
      // Restore original content for s-clickable if it was replaced
      if (el.tagName.toLowerCase() === 's-clickable' && el.hasAttribute('data-original-content')) {
        el.innerHTML = el.getAttribute('data-original-content');
        el.removeAttribute('data-original-content');
      }
    });

    // Remove hidden class from body if it was added
    if (config.hideBodyOnNavigation) {
      const pageElement = document.body.querySelector(config.pageSelector);
      if (pageElement) {
        pageElement.classList.remove(config.bodyHideClass);
      }
    }

    // If Shopify App Bridge is available, hide global loading state
    if (typeof window.shopify !== 'undefined' && window.shopify.loading) {
      window.shopify.loading(false);
    }
  });

  // Also handle turbo:frame-load for frame navigations
  document.addEventListener("turbo:frame-load", () => {
    // Remove loading from buttons and clickables within the frame
    document.querySelectorAll('s-button[loading="true"], s-clickable[loading="true"]').forEach(el => {
      el.removeAttribute('loading');
      
      // Restore original content for s-clickable if it was replaced
      if (el.tagName.toLowerCase() === 's-clickable' && el.hasAttribute('data-original-content')) {
        el.innerHTML = el.getAttribute('data-original-content');
        el.removeAttribute('data-original-content');
      }
    });
  });

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

      const url = el.getAttribute("href");
      const target = el.getAttribute("target");

      // Handle _blank and _top with open
      if (target === "_blank" || target === "_top") {
        event.preventDefault();
        event.stopImmediatePropagation();
        open(url, target);
        return;
      }

      // Respect modifier keys / other targets
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        target === "_parent" ||
        target === "_self"
      )
        return;

      // Check if already handled
      if (event.defaultPrevented) return;
      
      // Mark as handled
      event.preventDefault();
      event.stopImmediatePropagation(); // <- stop App‑Bridge listeners

      const method = (el.dataset.turboMethod || "get").toLowerCase();
      const frame = el.dataset.turboFrame;
      const confirmText = el.dataset.turboConfirm;

      if (confirmText && !confirm(confirmText)) return;

      // Check element type
      const tagName = el.tagName.toLowerCase();
      const isLink = tagName === 's-link';
      const needsLoading = (tagName === 's-button' || tagName === 's-clickable') && !frame;
      const isDeleteAction = method === 'delete';

      // Hide body on navigation if configured - but NOT for delete actions
      if (config.hideBodyOnNavigation && !frame && !isDeleteAction && (isLink || tagName === 's-button')) {
        const pageElement = document.body.querySelector(config.pageSelector);
        if (pageElement) {
          pageElement.classList.add(config.bodyHideClass);
        }
      }

      if (needsLoading) {
        // For buttons and clickables: show loading state with delay
        el.setAttribute('loading', 'true');
        
        // For s-clickable, replace content with spinner
        if (tagName === 's-clickable') {
          // Store original content to restore later if needed
          el.setAttribute('data-original-content', el.innerHTML);
          el.innerHTML = '<s-spinner accessibilityLabel="Loading" size="small"></s-spinner>';
        }
        
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

  // Handle breadcrumb links separately
  document.addEventListener(
    "click",
    (event) => {
      const breadcrumbLink = event.target.closest('a.Polaris-Breadcrumbs__IconWrapper.Polaris-Breadcrumbs__IconWrapperLink.Polaris-Breadcrumbs__BreadcrumbImageWrapper');
      if (!breadcrumbLink) return;

      const href = breadcrumbLink.getAttribute('href');
      if (!href) return;

      // Check for modifier keys
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;

      // Prevent default navigation and stop all propagation
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Hide body if configured
      if (config.hideBodyOnNavigation) {
        const pageElement = document.body.querySelector(config.pageSelector);
        if (pageElement) {
          pageElement.classList.add(config.bodyHideClass);
        }
      }

      // Navigate with Turbo after a small delay
      setTimeout(() => {
        Turbo.visit(href);
      }, 50);
    },
    true
  );

  // Handle ui-title-bar breadcrumb buttons
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest('button[variant="breadcrumb"]');
      if (!button) return;

      // Check if button is in ui-title-bar
      const titleBar = button.closest('ui-title-bar');
      if (!titleBar) return;

      // Breadcrumb buttons are navigation, so add hidden class
      if (config.hideBodyOnNavigation) {
        const pageElement = document.body.querySelector(config.pageSelector);
        if (pageElement) {
          pageElement.classList.add(config.bodyHideClass);
        }
      }
    },
    true
  );

  // Handle ui-title-bar s-button links
  document.addEventListener(
    "click",
    (event) => {
      const sButtonLink = event.target.closest('a.s-button');
      if (!sButtonLink) return;

      // Check if link is in ui-title-bar
      const titleBar = sButtonLink.closest('ui-title-bar');
      if (!titleBar) return;

      const href = sButtonLink.getAttribute('href');
      if (!href) return;

      // Check if this is a delete action
      const turboMethod = sButtonLink.getAttribute('data-turbo-method');
      const isDeleteAction = turboMethod === 'delete';

      // Check for modifier keys
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;

      // For delete actions, let Turbo/Rails handle it naturally
      // Don't add hidden class and don't prevent default
      if (isDeleteAction) {
        return;
      }

      // For non-delete navigation, prevent default and add hidden class
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Add hidden class if configured
      if (config.hideBodyOnNavigation) {
        const pageElement = document.body.querySelector(config.pageSelector);
        if (pageElement) {
          pageElement.classList.add(config.bodyHideClass);
        }
      }

      // Navigate with Turbo
      setTimeout(() => {
        Turbo.visit(href);
      }, 50);
    },
    true
  );

  // Handle title bar buttons (for App Bridge transformed buttons)
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      // Check if button is in old-style title bar (App Bridge transformed)
      const titleBar = button.closest('._TitleBar_6rj2k_1, [class*="TitleBar"], ._ActionsMobileLayout_g9ncd_1');
      if (!titleBar) return;

      // Skip breadcrumb buttons as they're handled separately
      if (button.hasAttribute('variant') && button.getAttribute('variant') === 'breadcrumb') return;

      // Get button text (handle nested spans)
      const buttonText = button.textContent?.toLowerCase() || '';
      
      // Check if this is a delete button (by text or data attributes)
      const turboMethod = button.getAttribute('data-turbo-method');
      const isDeleteButton = turboMethod === 'delete' || buttonText.includes('delete');
      
      // Skip post buttons
      if (buttonText.includes('post')) return;

      // Skip if button is a dropdown trigger or has aria-expanded
      if (button.hasAttribute('aria-expanded') || button.hasAttribute('aria-controls')) return;

      // Skip if no navigation is expected (icon-only buttons without clear purpose)
      if (button.classList.contains('Polaris-Button--iconOnly') && 
          !button.hasAttribute('href') && 
          !button.hasAttribute('data-href') &&
          !button.getAttribute('onclick')?.includes('Turbo.visit')) return;

      // Check if button has onclick with Turbo.visit or data-href
      const onclickAttr = button.getAttribute('onclick');
      const hasTurboVisit = onclickAttr && onclickAttr.includes('Turbo.visit');
      const dataHref = button.getAttribute('data-href');

      // For buttons that might be transformed from s-button links
      // App Bridge may have added onclick handlers
      const hasAppBridgeClick = onclickAttr && !hasTurboVisit;
      
      // If this looks like a navigation button (not delete), add hidden class
      if (config.hideBodyOnNavigation && !isDeleteButton) {
        // Only add hidden class for non-delete buttons
        const pageElement = document.body.querySelector(config.pageSelector);
        if (pageElement) {
          pageElement.classList.add(config.bodyHideClass);
        }
      }

      // Only intercept and handle our own navigation if it's a Turbo.visit or data-href
      if (hasTurboVisit || dataHref) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        // Extract URL
        let url;
        if (hasTurboVisit) {
          const match = onclickAttr.match(/Turbo\.visit\(['"]([^'"]+)['"]\)/);
          url = match ? match[1] : null;
        } else if (dataHref) {
          url = dataHref;
        }

        // Navigate if we have a URL
        if (url) {
          setTimeout(() => {
            Turbo.visit(url);
          }, 50);
        }
      }
      // Otherwise, let App Bridge handle the click naturally
    },
    true
  );

  // Handle any button with Turbo.visit in onclick (not just title bar)
  document.addEventListener(
    "click",
    (event) => {
      const turboButton = event.target.closest('button[onclick*="Turbo.visit"]');
      if (!turboButton) return;

      // Skip if already handled by title bar handler
      if (turboButton.closest('._TitleBar_6rj2k_1, [class*="TitleBar"], ._ActionsMobileLayout_g9ncd_1')) return;

      // Add hidden class if configured
      if (config.hideBodyOnNavigation) {
        const pageElement = document.body.querySelector(config.pageSelector);
        if (pageElement) {
          pageElement.classList.add(config.bodyHideClass);
        }
      }
    },
    true
  );
}

if (typeof window !== "undefined" && window.POLARIS_TURBO_AUTOSTART) {
  if (typeof window.Turbo !== "undefined") {
    // Check for configuration in window object
    const config = window.POLARIS_TURBO_CONFIG || {};
    PolarisTurboBridge(config);
  } else {
    console.warn(
      "[polaris-turbo-bridge] POLARIS_TURBO_AUTOSTART is true, " +
        "but Turbo is not loaded; bridge disabled."
    );
  }
}