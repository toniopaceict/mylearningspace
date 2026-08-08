/* =========================================================
   TONIO LIGHTBOX MODULE
   Reusable image modal with draggable support

   HOW TO USE:
   1. Include lightbox HTML in your page
   2. Add class="question-image" to images
   3. (Optional) add data-full="large-image.png"

   This script will automatically:
   - open image in modal on click
   - allow dragging
   - allow closing via X or background
   ========================================================= */

const TonioLightbox = (function () {
  function initLightbox() {
    const lightbox = document.getElementById("lightbox");
    const lightboxBox = document.getElementById("lightboxBox");
    const lightboxImg = document.getElementById("lightboxImg");
    const lightboxHeader = document.getElementById("lightboxHeader");
    const lightboxClose = document.querySelector(".lightbox-close");

    /* =====================================================
       SAFETY CHECK
       Do nothing if lightbox HTML is not present
       ===================================================== */
    if (
      !lightbox ||
      !lightboxBox ||
      !lightboxImg ||
      !lightboxHeader ||
      !lightboxClose
    ) {
      return;
    }

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    /* =====================================================
       OPEN LIGHTBOX
       ===================================================== */
    function openLightbox(src) {
      lightboxImg.src = src;
      lightbox.classList.add("show");

      /* Reset position */
      if (window.innerWidth <= 600) {
        lightboxBox.style.left = "20px";
        lightboxBox.style.top = "70px";
        lightboxBox.style.transform = "none";
      } else {
        lightboxBox.style.left = "50%";
        lightboxBox.style.top = "90px";
        lightboxBox.style.transform = "translateX(-50%)";
      }
    }

    /* =====================================================
       CLOSE LIGHTBOX
       ===================================================== */
    function closeLightbox() {
      lightbox.classList.remove("show");
      lightboxImg.src = "";
      isDragging = false;
    }

    /* =====================================================
       CLICK IMAGE TO OPEN
       ===================================================== */
    document.addEventListener("click", function (e) {
      const img = e.target.closest(".question-image");
      if (!img) return;

      const src = img.getAttribute("data-full") || img.src;
      openLightbox(src);
    });

    /* =====================================================
       CLOSE EVENTS
       ===================================================== */
    lightboxClose.addEventListener("click", closeLightbox);

    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    /* =====================================================
       DRAG FUNCTIONALITY
       ===================================================== */
    lightboxHeader.addEventListener("mousedown", function (e) {
      isDragging = true;

      const boxRect = lightboxBox.getBoundingClientRect();
      dragOffsetX = e.clientX - boxRect.left;
      dragOffsetY = e.clientY - boxRect.top;

      lightboxBox.style.transform = "none";
      lightboxBox.style.left = boxRect.left + "px";
      lightboxBox.style.top = boxRect.top + "px";
    });

    document.addEventListener("mousemove", function (e) {
      if (!isDragging) return;

      let newLeft = e.clientX - dragOffsetX;
      let newTop = e.clientY - dragOffsetY;

      const maxLeft = window.innerWidth - lightboxBox.offsetWidth - 10;
      const maxTop = window.innerHeight - lightboxBox.offsetHeight - 10;

      newLeft = Math.max(10, Math.min(newLeft, maxLeft));
      newTop = Math.max(10, Math.min(newTop, maxTop));

      lightboxBox.style.left = newLeft + "px";
      lightboxBox.style.top = newTop + "px";
    });

    document.addEventListener("mouseup", function () {
      isDragging = false;
    });
  }

  /* =========================================================
     AUTO INIT AFTER PAGE LOAD
     ========================================================= */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLightbox, { once: true });
  } else {
    initLightbox();
  }

  /* OPTIONAL: expose for manual use if needed */
  return {
    init: initLightbox
  };
})();