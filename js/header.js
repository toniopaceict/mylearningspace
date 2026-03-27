function initTonioHeader() {
  const headerPlaceholder = document.getElementById("header-placeholder");
  if (!headerPlaceholder) return;

  fetch("https://toniopaceict.github.io/level4_css/html/header.html?v=1")
    .then(response => {
      if (!response.ok) {
        throw new Error("Header file could not be loaded.");
      }
      return response.text();
    })
    .then(data => {
      headerPlaceholder.innerHTML = data;

      const currentPage = window.location.pathname.split("/").pop() || "index.html";
      const links = headerPlaceholder.querySelectorAll(".side-nav a");

      links.forEach(link => {
        const href = link.getAttribute("href");
        if (href === currentPage) {
          link.classList.add("active");

          const parentSection = link.closest(".side-nav-section");
          if (parentSection) {
            parentSection.classList.add("open");
          }
        }
      });

      const toggles = headerPlaceholder.querySelectorAll(".side-nav-toggle");
      toggles.forEach(toggle => {
        toggle.addEventListener("click", () => {
          const section = toggle.closest(".side-nav-section");
          if (!section) return;
          section.classList.toggle("open");
        });
      });

      const mobileMenuBtn = document.getElementById("mobileMenuBtn");
      const sideNav = document.getElementById("sideNav");
      const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");

      function closeMobileMenu() {
        if (sideNav) sideNav.classList.remove("mobile-open");
        if (mobileMenuBackdrop) mobileMenuBackdrop.classList.remove("show");
        document.body.classList.remove("menu-open");
      }

      function openMobileMenu() {
        if (sideNav) sideNav.classList.add("mobile-open");
        if (mobileMenuBackdrop) mobileMenuBackdrop.classList.add("show");
        document.body.classList.add("menu-open");
      }

      if (mobileMenuBtn && sideNav) {
        mobileMenuBtn.addEventListener("click", () => {
          const isOpen = sideNav.classList.contains("mobile-open");
          if (isOpen) {
            closeMobileMenu();
          } else {
            openMobileMenu();
          }
        });
      }

      if (mobileMenuBackdrop) {
        mobileMenuBackdrop.addEventListener("click", closeMobileMenu);
      }

      links.forEach(link => {
        link.addEventListener("click", () => {
          if (window.innerWidth <= 900) {
            closeMobileMenu();
          }
        });
      });

      window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
          closeMobileMenu();
        }
      });
    })
    .catch(error => {
      console.error("Error loading header:", error);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTonioHeader);
} else {
  initTonioHeader();
}
