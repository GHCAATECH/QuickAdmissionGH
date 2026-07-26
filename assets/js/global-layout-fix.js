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
 * Force the document roots and app shells to allow page scrolling.
 * This protects against legacy page CSS like html,body{overflow:hidden}.
 */
function forceScrollableLayout() {
  document.documentElement.dataset.qaLayoutFix = "20260726-layout-fix-4";

  document.documentElement.style.setProperty("height", "auto", "important");
  document.documentElement.style.setProperty("overflow-x", "hidden", "important");
  document.documentElement.style.setProperty("overflow-y", "auto", "important");

  if (document.body && !document.body.classList.contains("modal-open")) {
    document.body.style.setProperty("height", "auto", "important");
    document.body.style.setProperty("overflow-x", "hidden", "important");
    document.body.style.setProperty("overflow-y", "auto", "important");
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
    element.style.setProperty("height", "auto", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty("overflow-x", "hidden", "important");
    element.style.setProperty("overflow-y", "visible", "important");
  });
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

window.addEventListener("orientationchange", () => {
  window.setTimeout(initialiseLayoutFix, 150);
});

let resizeTimer;

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(initialiseLayoutFix, 150);
});
