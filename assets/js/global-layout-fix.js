"use strict";

const QA_SYSTEM_FOOTER_LOGO = new URL(
  "../../logo-icon.svg",
  document.currentScript?.src || window.location.href
).href;

function enhanceSystemFooters() {
  document
    .querySelectorAll("body > footer.system-footer")
    .forEach((footer) => {
      if (footer.dataset.qaIndexFooter === "true") return;

      footer.dataset.qaIndexFooter = "true";
      footer.classList.add("qa-index-footer");
      footer.innerHTML = `
        <div class="qa-index-footer-main">
          <div class="qa-index-footer-brand">
            <div class="qa-index-footer-logo">
              <img src="${QA_SYSTEM_FOOTER_LOGO}" alt="QuickAdmissionGH logo">
            </div>
            <div>
              <h2>QuickAdmissionGH</h2>
              <p>Connecting students to a secure, transparent and convenient Senior High School admission process across Ghana.</p>
            </div>
          </div>
          <div class="qa-index-footer-support" aria-label="QuickAdmissionGH support">
            <h3>Support</h3>
            <a href="tel:0256744028">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/></svg>
              <span>0256744028</span>
            </a>
            <a href="mailto:admissions@quickadmissiongh.com">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
              <span>admissions@quickadmissiongh.com</span>
            </a>
            <span class="qa-index-footer-hours">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              <span>Monday - Friday: 8:00 AM - 5:00 PM</span>
            </span>
          </div>
        </div>
        <div class="qa-index-footer-bottom">
          <div class="qa-index-footer-bottom-inner">
            <span>&copy; 2026 QuickAdmissionGH. All rights reserved.</span>
            <span>Powered by <strong>AXIOMBYTE HUB</strong></span>
          </div>
        </div>`;
    });
}

function usesMobileViewportLayout() {
  return window.matchMedia("(max-width: 1024px)").matches;
}

function platformDirectoryOwnsScroll() {
  return Boolean(document.body?.classList.contains("platform-directory-active"));
}

function syncGlobalMobileViewport() {
  if (!usesMobileViewportLayout() || platformDirectoryOwnsScroll()) {
    document.documentElement.style.removeProperty("--qa-mobile-viewport-height");
    return;
  }

  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty(
    "--qa-mobile-viewport-height",
    `${Math.ceil(viewportHeight)}px`
  );
}

/**
 * Display one application view and hide all others.
 * Kept global so legacy inline handlers can use it if needed.
 *
 * @param {string} viewId
 */
function showView(viewId) {
  const views = document.querySelectorAll(
    ".app-view, .portal-screen, .page-view, .system-view"
  );

  views.forEach((view) => {
    view.classList.remove("active");
    view.setAttribute("aria-hidden", "true");
  });

  const selectedView = document.getElementById(viewId);

  if (!selectedView) {
    console.error(`View "${viewId}" was not found.`);
    return;
  }

  selectedView.classList.add("active");
  selectedView.setAttribute("aria-hidden", "false");

  if (usesMobileViewportLayout() && !platformDirectoryOwnsScroll()) {
    document.body.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
}

window.showView = window.showView || showView;

/**
 * Remove inline height styles that may create long empty mobile pages.
 */
function removeInvalidInlineHeights() {
  const selectors = [
    "body",
    "#app",
    ".app-wrapper",
    ".page-wrapper",
    ".layout-wrapper",
    "main",
    ".main-content",
    ".page-content",
    ".content-wrapper",
    ".dashboard-content",
    ".portal-content",
    ".login-page",
    ".auth-page",
    ".page-container",
  ];

  document.querySelectorAll(selectors.join(",")).forEach((element) => {
    const inlineHeight = element.style.height || "";
    const inlineMinHeight = element.style.minHeight || "";

    if (
      inlineHeight.includes("vh") ||
      inlineHeight.includes("dvh") ||
      inlineHeight.includes("px")
    ) {
      element.style.removeProperty("height");
    }

    if (
      inlineMinHeight.includes("vh") ||
      inlineMinHeight.includes("dvh") ||
      inlineMinHeight.includes("px")
    ) {
      element.style.removeProperty("min-height");
    }
  });
}

/**
 * Mark when the public login screen is active so its outer scrollbar can be
 * visually hidden without disabling page scrolling.
 */
function updateLoginScreenScrollbarMode() {
  const loginScreenActive = Boolean(
    document.querySelector("#s-login.screen.active")
  );
  const adminGatePresent = Boolean(document.getElementById("authGate"));

  document.documentElement.classList.toggle(
    "qa-login-screen-active",
    loginScreenActive
  );

  if (document.body) {
    document.body.classList.toggle("qa-login-screen-active", loginScreenActive);

    if (platformDirectoryOwnsScroll()) {
      document.documentElement.style.removeProperty("overflow-y");
      document.body.style.removeProperty("overflow-x");
      document.body.style.removeProperty("overflow-y");
      return;
    }

    const mobileLayout = usesMobileViewportLayout();
    document.documentElement.style.setProperty(
      "overflow-y",
      mobileLayout ? "hidden" : adminGatePresent ? "scroll" : "auto",
      "important"
    );
    document.body.style.setProperty("overflow-x", "clip", "important");
    document.body.style.setProperty(
      "overflow-y",
      mobileLayout ? "auto" : "visible",
      "important"
    );
  }
}

/**
 * Keep the complete sign-in experience visible on a desktop viewport.  The
 * student and administrator pages deliberately carry useful context beside
 * their forms, so simply clipping the overflow would hide controls.  Instead
 * scale the login shell only when the resulting controls remain comfortably
 * readable. Short desktop windows keep their normal document scrolling
 * instead of being squeezed into an overly small login card.
 */
function fitDesktopLoginToViewport() {
  const isDesktop = window.matchMedia("(min-width: 769px)").matches;
  const studentLogin = document.querySelector("#s-login.screen.active");
  const loginShells = [
    studentLogin?.querySelector(".portal-login-wrap, .qa-page-shell"),
    document.querySelector("#authGate .qa-login-shell"),
  ].filter(Boolean);

  loginShells.forEach((loginShell) => {
    if (!isDesktop || window.innerHeight < 560) {
      loginShell.style.removeProperty("zoom");
      loginShell.removeAttribute("data-qa-login-zoom");
      return;
    }

    // Measure at the unscaled size first. This also overrides the older
    // fixed 90% student-login rule so every desktop height gets a fitting
    // scale instead of only a one-size-fits-all reduction.
    loginShell.style.setProperty("zoom", "1", "important");

    const shellHeight = loginShell.getBoundingClientRect().height;
    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0
    );
    const otherContentHeight = Math.max(0, documentHeight - shellHeight);
    const availableShellHeight = Math.max(
      0,
      window.innerHeight - otherContentHeight - 4
    );
    const idealZoom = Math.min(
      0.94,
      availableShellHeight / Math.max(shellHeight, 1)
    );

    // Below 78% the form becomes too dense to use comfortably. Leave the
    // document in its regular scrollable layout at that size instead.
    if (idealZoom < 0.78) {
      loginShell.style.removeProperty("zoom");
      loginShell.removeAttribute("data-qa-login-zoom");
      return;
    }

    loginShell.style.setProperty("zoom", idealZoom.toFixed(3), "important");
    loginShell.dataset.qaLoginZoom = idealZoom.toFixed(3);
  });
}

let loginFitTimer;

function scheduleDesktopLoginFit() {
  window.clearTimeout(loginFitTimer);
  loginFitTimer = window.setTimeout(fitDesktopLoginToViewport, 60);
}

/**
 * Force the document roots and app shells to allow page scrolling.
 * This protects against legacy page CSS like html,body{overflow:hidden}.
 */
function forceScrollableLayout() {
  const adminGatePresent = Boolean(document.getElementById("authGate"));
  const mobileLayout = usesMobileViewportLayout();

  if (platformDirectoryOwnsScroll()) {
    ["height", "min-height", "max-height", "overflow-x", "overflow-y"].forEach(
      (property) => document.documentElement.style.removeProperty(property)
    );
    if (document.body) {
      ["height", "min-height", "max-height", "overflow-x", "overflow-y"].forEach(
        (property) => document.body.style.removeProperty(property)
      );
    }
    return;
  }

  syncGlobalMobileViewport();

  document.documentElement.dataset.qaLayoutFix =
    "20260808-mobile-scroll-owner-20";

  document.documentElement.style.setProperty(
    "height",
    mobileLayout ? "var(--qa-mobile-viewport-height, 100dvh)" : "auto",
    "important"
  );
  document.documentElement.style.setProperty(
    "min-height",
    mobileLayout ? "0" : "100%",
    "important"
  );
  document.documentElement.style.setProperty(
    "max-height",
    mobileLayout ? "var(--qa-mobile-viewport-height, 100dvh)" : "none",
    "important"
  );
  document.documentElement.style.setProperty("overflow-x", "hidden", "important");
  document.documentElement.style.setProperty(
    "overflow-y",
    mobileLayout ? "hidden" : adminGatePresent ? "scroll" : "auto",
    "important"
  );

  if (document.body && !document.body.classList.contains("modal-open")) {
    document.body.style.setProperty(
      "height",
      mobileLayout ? "var(--qa-mobile-viewport-height, 100dvh)" : "auto",
      "important"
    );
    document.body.style.setProperty(
      "min-height",
      mobileLayout ? "0" : "auto",
      "important"
    );
    document.body.style.setProperty(
      "max-height",
      mobileLayout ? "var(--qa-mobile-viewport-height, 100dvh)" : "none",
      "important"
    );
    document.body.style.setProperty(
      "overflow-x",
      "clip",
      "important"
    );
    document.body.style.setProperty(
      "overflow-y",
      mobileLayout ? "auto" : "visible",
      "important"
    );
    document.body.style.setProperty(
      "overscroll-behavior-y",
      mobileLayout ? "contain" : "auto",
      "important"
    );
    document.body.style.setProperty(
      "-webkit-overflow-scrolling",
      mobileLayout ? "touch" : "auto"
    );
  }

  const shellSelectors = [
    "#app",
    ".app",
    ".app-shell",
    ".app-wrapper",
    ".page-wrapper",
    ".layout-wrapper",
    ".main-wrapper",
    ".dashboard-wrapper",
    ".portal-wrapper",
    ".admin-wrapper",
    ".student-wrapper",
    "main",
    ".main",
    ".main-content",
    ".page-content",
    ".content",
    ".content-wrapper",
    ".dashboard-content",
    ".portal-content",
    ".admin-content",
    ".student-content",
  ];

  document.querySelectorAll(shellSelectors.join(",")).forEach((element) => {
    if (element.closest("#authGate")) {
      return;
    }

    element.style.setProperty("height", "auto", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty(
      "overflow-x",
      mobileLayout ? "clip" : "hidden",
      "important"
    );
    element.style.setProperty("overflow-y", "visible", "important");
  });

  // The school-admin dashboard uses a fixed desktop shell with one dedicated
  // scrolling content pane. Preserve that contract after the generic mobile
  // layout repair above; otherwise its content is clipped by the shell and
  // neither the page nor the pane can be scrolled.
  const desktopAppContent =
    window.matchMedia("(min-width: 1025px)").matches &&
    document.querySelector(".school-admin-login-wrapper")
      ? document.querySelector(".app > .main > .content")
      : null;

  if (desktopAppContent) {
    const desktopApp = desktopAppContent.closest(".app");
    const desktopMain = desktopAppContent.closest(".main");

    if (desktopApp) {
      desktopApp.style.setProperty("height", "100dvh", "important");
      desktopApp.style.setProperty("min-height", "0", "important");
      desktopApp.style.setProperty("overflow", "hidden", "important");
    }

    if (desktopMain) {
      desktopMain.style.setProperty("height", "100dvh", "important");
      desktopMain.style.setProperty("min-height", "0", "important");
      desktopMain.style.setProperty("overflow", "hidden", "important");
    }

    desktopAppContent.style.setProperty("height", "auto", "important");
    desktopAppContent.style.setProperty("min-height", "0", "important");
    desktopAppContent.style.setProperty("max-height", "none", "important");
    desktopAppContent.style.setProperty("overflow-x", "hidden", "important");
    desktopAppContent.style.setProperty("overflow-y", "auto", "important");
  }

  document
    .querySelectorAll(
      "#authGate, #authGate .qa-login-shell, #authGate .qa-brand-panel, #authGate .qa-login-panel, #authGate .qa-login-card"
    )
    .forEach((element) => {
      element.style.setProperty("height", "auto", "important");
      element.style.setProperty("max-height", "none", "important");
      element.style.setProperty("overflow-x", "visible", "important");
      element.style.setProperty("overflow-y", "visible", "important");
    });

  document
    .querySelectorAll("#s-login .qa-page-shell")
    .forEach((element) => {
      element.style.setProperty("align-items", "start", "important");
      element.style.setProperty("max-height", "none", "important");
      element.style.setProperty("overflow-y", "visible", "important");
    });

  document.querySelectorAll("#s-login .qa-hero-panel").forEach((element) => {
    element.style.setProperty("align-self", "start", "important");
    element.style.setProperty("height", "auto", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty("overflow-x", "hidden", "important");
    element.style.setProperty("overflow-y", "hidden", "important");
    element.style.setProperty("scrollbar-width", "none", "important");
  });

  document.querySelectorAll("#s-login.screen.active").forEach((element) => {
    element.style.setProperty("scrollbar-width", "none", "important");
  });

  updateLoginScreenScrollbarMode();
  scheduleDesktopLoginFit();
}

/**
 * Hide empty elements that may be adding large space.
 */
function removeEmptyLayoutBlocks() {
  const selectors = [
    ".empty-section",
    ".empty-container",
    ".empty-footer",
    ".placeholder",
  ];

  document.querySelectorAll(selectors.join(",")).forEach((element) => {
    if (!element.textContent.trim() && element.children.length === 0) {
      element.style.display = "none";
    }
  });
}

/**
 * Initialise the global mobile layout correction.
 */
function initialiseLayoutFix() {
  enhanceSystemFooters();
  removeInvalidInlineHeights();
  removeEmptyLayoutBlocks();
  syncGlobalMobileViewport();
  forceScrollableLayout();
}

document.addEventListener("DOMContentLoaded", initialiseLayoutFix);

const layoutMutationObserver = new MutationObserver(() => {
  updateLoginScreenScrollbarMode();
  scheduleDesktopLoginFit();
});

document.addEventListener("DOMContentLoaded", () => {
  if (document.body) {
    layoutMutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleDesktopLoginFit);
    }
  }
});

window.addEventListener("orientationchange", () => {
  window.setTimeout(initialiseLayoutFix, 150);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    syncGlobalMobileViewport();
    forceScrollableLayout();
  }, { passive: true });
}

let resizeTimer;

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(initialiseLayoutFix, 150);
});
