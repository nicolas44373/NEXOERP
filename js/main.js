document.getElementById("year").textContent = new Date().getFullYear();

// --- Tabs ---
const tabButtons = document.querySelectorAll(".tab-btn");
const carouselEls = {
  desktop: document.getElementById("carousel-desktop"),
  mobile: document.getElementById("carousel-mobile"),
};
const dotsEls = {
  desktop: document.getElementById("dots-desktop"),
  mobile: document.getElementById("dots-mobile"),
};

let activeTab = "desktop";

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    Object.keys(carouselEls).forEach((key) => {
      const isActive = key === activeTab;
      carouselEls[key].hidden = !isActive;
      dotsEls[key].hidden = !isActive;
    });
    updateEmptyState(activeTab);
  });
});

const emptyMsg = document.getElementById("gallery-empty");
function updateEmptyState(type) {
  const list = manifest[type] || [];
  emptyMsg.hidden = list.length > 0;
  dotsEls[type].hidden = list.length <= 1;
}

// --- Lightbox (with its own prev/next navigation) ---
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");
const lightboxState = { type: null, index: 0 };

document.getElementById("lightbox-close").addEventListener("click", () => {
  lightbox.hidden = true;
});
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.hidden = true;
});

function lightboxSrc() {
  const { type, index } = lightboxState;
  const filename = carousels[type].files[index];
  return `assets/screenshots/${type}/${filename}`;
}

function updateLightboxImage() {
  lightboxImg.src = lightboxSrc();
  const hasMultiple = carousels[lightboxState.type].files.length > 1;
  lightboxPrev.disabled = !hasMultiple;
  lightboxNext.disabled = !hasMultiple;
}

function openLightbox(type, index) {
  lightboxState.type = type;
  lightboxState.index = index;
  updateLightboxImage();
  lightbox.hidden = false;
}

function stepLightbox(delta) {
  const files = carousels[lightboxState.type].files;
  if (files.length === 0) return;
  lightboxState.index = (lightboxState.index + delta + files.length) % files.length;
  updateLightboxImage();
}

lightboxPrev.addEventListener("click", () => stepLightbox(-1));
lightboxNext.addEventListener("click", () => stepLightbox(1));

window.addEventListener("keydown", (e) => {
  if (lightbox.hidden) return;
  if (e.key === "Escape") {
    lightbox.hidden = true;
    return;
  }
  if (e.key === "ArrowLeft") stepLightbox(-1);
  if (e.key === "ArrowRight") stepLightbox(1);
});

// Touch swipe inside the lightbox
(() => {
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let dragging = false;

  const reset = () => {
    dragging = false;
    deltaX = 0;
  };

  lightbox.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      deltaX = 0;
      dragging = true;
    },
    { passive: true }
  );
  lightbox.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging) return;
      deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;
      // Once the gesture is clearly horizontal, claim it so the browser
      // doesn't hijack it for its own zoom/drag/navigation gestures.
      if (Math.abs(deltaX) > Math.abs(deltaY)) e.preventDefault();
    },
    { passive: false }
  );
  lightbox.addEventListener("touchend", () => {
    if (!dragging) return;
    if (Math.abs(deltaX) > 40) stepLightbox(deltaX < 0 ? 1 : -1);
    reset();
  });
  lightbox.addEventListener("touchcancel", reset);
})();

// --- Load manifest & render carousels ---
// Loaded from assets/screenshots/manifest.js (window.NEXO_MANIFEST) via a
// <script> tag instead of fetch(), so this also works when the page is
// opened directly from disk (file://), where fetch() of local files is blocked.
let manifest = window.NEXO_MANIFEST || { desktop: [], mobile: [] };

const carousels = {
  desktop: { index: 0, files: [] },
  mobile: { index: 0, files: [] },
};

renderCarousel("desktop");
renderCarousel("mobile");
updateEmptyState("desktop");

if (manifest.desktop && manifest.desktop.length > 0) {
  const heroFrame = document.getElementById("hero-frame");
  heroFrame.innerHTML = `<img src="assets/screenshots/desktop/${manifest.desktop[0]}" alt="Vista previa de Nexo ERP">`;
}

function buildSlide(type, filename, index) {
  const src = `assets/screenshots/${type}/${filename}`;
  const chrome =
    type === "desktop"
      ? `<div class="device-topbar"><span></span><span></span><span></span></div>`
      : `<div class="device-notch"></div>`;
  const slide = document.createElement("div");
  slide.className = "carousel-slide";
  slide.innerHTML = `
    <div class="device-frame device-frame-${type}">
      ${chrome}
      <div class="device-screen">
        <img src="${src}" alt="Captura de Nexo ERP (${type})" loading="lazy">
      </div>
    </div>
  `;
  slide.querySelector("img").addEventListener("click", () => openLightbox(type, index));
  return slide;
}

function renderCarousel(type) {
  const files = manifest[type] || [];
  const track = document.getElementById(`track-${type}`);
  track.innerHTML = "";
  files.forEach((filename, index) => track.appendChild(buildSlide(type, filename, index)));

  carousels[type].files = files;
  carousels[type].index = 0;
  renderDots(type);
  updateCarouselPosition(type);
}

function renderDots(type) {
  const container = dotsEls[type];
  const files = carousels[type].files;
  container.innerHTML = "";
  files.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "dot";
    dot.setAttribute("aria-label", `Ir a la captura ${i + 1}`);
    dot.addEventListener("click", () => goTo(type, i));
    container.appendChild(dot);
  });
}

function updateCarouselPosition(type) {
  const track = document.getElementById(`track-${type}`);
  const { index } = carousels[type];
  track.style.transform = `translateX(-${index * 100}%)`;

  dotsEls[type].querySelectorAll(".dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === index);
  });

  const carouselEl = carouselEls[type];
  const prevBtn = carouselEl.querySelector(".carousel-prev");
  const nextBtn = carouselEl.querySelector(".carousel-next");
  const hasMultiple = carousels[type].files.length > 1;
  prevBtn.disabled = !hasMultiple;
  nextBtn.disabled = !hasMultiple;
}

function goTo(type, index) {
  const { files } = carousels[type];
  if (files.length === 0) return;
  carousels[type].index = (index + files.length) % files.length;
  updateCarouselPosition(type);
}

function step(type, delta) {
  goTo(type, carousels[type].index + delta);
}

// Arrow buttons
Object.entries(carouselEls).forEach(([type, el]) => {
  el.querySelector(".carousel-prev").addEventListener("click", () => step(type, -1));
  el.querySelector(".carousel-next").addEventListener("click", () => step(type, 1));
});

// Keyboard navigation (← →), only while the "capturas" section is on screen
// and the user isn't typing in a form field.
let capturasInView = false;
const capturasSection = document.getElementById("capturas");
if ("IntersectionObserver" in window) {
  new IntersectionObserver(
    ([entry]) => {
      capturasInView = entry.isIntersecting;
    },
    { threshold: 0.3 }
  ).observe(capturasSection);
}

window.addEventListener("keydown", (e) => {
  if (!lightbox.hidden) return; // the lightbox has its own arrow-key handling
  if (!capturasInView) return;
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const tag = document.activeElement.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

  e.preventDefault();
  step(activeTab, e.key === "ArrowLeft" ? -1 : 1);
});

// Touch swipe on mobile
Object.entries(carouselEls).forEach(([type, el]) => {
  const viewport = el.querySelector(".carousel-viewport");
  let startX = 0;
  let deltaX = 0;
  let dragging = false;

  viewport.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      dragging = true;
    },
    { passive: true }
  );
  viewport.addEventListener(
    "touchmove",
    (e) => {
      if (!dragging) return;
      deltaX = e.touches[0].clientX - startX;
    },
    { passive: true }
  );
  viewport.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(deltaX) > 40) step(type, deltaX < 0 ? 1 : -1);
    deltaX = 0;
  });
});

// --- Contact form (sends via FormSubmit, no backend of our own) ---
const form = document.getElementById("contact-form");
const formNote = document.getElementById("form-note");
const formError = document.getElementById("form-error");
const formSubmitBtn = form.querySelector("button[type=submit]");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formNote.hidden = true;
  formError.hidden = true;
  formSubmitBtn.disabled = true;

  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form),
    });
    if (!response.ok) throw new Error("request failed");
    formNote.hidden = false;
    form.reset();
  } catch {
    formError.hidden = false;
  } finally {
    formSubmitBtn.disabled = false;
  }
});
