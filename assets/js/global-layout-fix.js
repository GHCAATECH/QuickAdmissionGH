"use strict";

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

  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "auto",
  });
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
    document.documentElement.style.setProperty(
      "overflow-y",
      adminGatePresent ? "scroll" : "auto",
      "important"
    );
    document.body.style.setProperty("overflow-x", "clip", "important");
    document.body.style.setProperty(
      "overflow-y",
      "visible",
      "important"
    );
  }
}

/**
 * Force the document roots and app shells to allow page scrolling.
 * This protects against legacy page CSS like html,body{overflow:hidden}.
 */
function forceScrollableLayout() {
  const adminGatePresent = Boolean(document.getElementById("authGate"));

  document.documentElement.dataset.qaLayoutFix =
    "20260731-admin-login-scroll-14";

  document.documentElement.style.setProperty("height", "auto", "important");
  document.documentElement.style.setProperty("overflow-x", "hidden", "important");
  document.documentElement.style.setProperty(
    "overflow-y",
    adminGatePresent ? "scroll" : "auto",
    "important"
  );

  if (document.body && !document.body.classList.contains("modal-open")) {
    document.body.style.setProperty("height", "auto", "important");
    document.body.style.setProperty(
      "overflow-x",
      "clip",
      "important"
    );
    document.body.style.setProperty(
      "overflow-y",
      "visible",
      "important"
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
    element.style.setProperty("overflow-x", "hidden", "important");
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
  removeInvalidInlineHeights();
  removeEmptyLayoutBlocks();
  forceScrollableLayout();

  document.documentElement.style.removeProperty("height");
  if (document.body) {
    document.body.style.removeProperty("min-height");
  }
  forceScrollableLayout();
}

document.addEventListener("DOMContentLoaded", initialiseLayoutFix);

const layoutMutationObserver = new MutationObserver(() => {
  updateLoginScreenScrollbarMode();
});

document.addEventListener("DOMContentLoaded", () => {
  if (document.body) {
    layoutMutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });
  }
});

window.addEventListener("orientationchange", () => {
  window.setTimeout(initialiseLayoutFix, 150);
});

let resizeTimer;

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(initialiseLayoutFix, 150);
});
