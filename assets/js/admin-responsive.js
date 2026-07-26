"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const sidebar =
    document.getElementById("adminSidebar") ||
    document.getElementById("sidebar") ||
    document.querySelector(".admin-sidebar, .sidebar");

  const overlay =
    document.getElementById("sidebarOverlay") ||
    document.getElementById("backdrop") ||
    document.querySelector(".sidebar-overlay, .backdrop");

  const menuButton =
    document.getElementById("mobileMenuButton") ||
    document.getElementById("hamburger") ||
    document.querySelector(".mobile-menu-button, .hamburger");

  const closeButton =
    document.getElementById("sidebarClose") ||
    document.querySelector(".sidebar-close");

  if (!sidebar || !overlay || !menuButton) {
    return;
  }

  const sidebarLinks = document.querySelectorAll(
    ".sidebar-link, .nav-item, .nav-sub"
  );

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("show");
    document.body.classList.add("sidebar-open");
    overlay.setAttribute("aria-hidden", "false");
    menuButton.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
    document.body.classList.remove("sidebar-open");
    overlay.setAttribute("aria-hidden", "true");
    menuButton.setAttribute("aria-expanded", "false");
  }

  menuButton.setAttribute("aria-controls", sidebar.id || "admin-sidebar");
  menuButton.setAttribute("aria-expanded", "false");
  overlay.setAttribute("aria-hidden", "true");

  menuButton.addEventListener("click", () => {
    if (isMobile()) {
      openSidebar();
    }
  });

  overlay.addEventListener("click", closeSidebar);

  if (closeButton) {
    closeButton.addEventListener("click", closeSidebar);
  }

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (isMobile()) {
        closeSidebar();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
    }
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      closeSidebar();
    }
  });
});
