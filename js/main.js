document.getElementById("year").textContent = new Date().getFullYear();

// --- Tabs ---
const tabButtons = document.querySelectorAll(".tab-btn");
const galleries = {
  desktop: document.getElementById("gallery-desktop"),
  mobile: document.getElementById("gallery-mobile"),
};

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    Object.entries(galleries).forEach(([key, el]) => {
      el.hidden = key !== tab;
    });
    updateEmptyState(tab);
  });
});

const emptyMsg = document.getElementById("gallery-empty");
function updateEmptyState(activeTab) {
  const list = manifest[activeTab] || [];
  emptyMsg.hidden = list.length > 0;
}

// --- Lightbox ---
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
document.getElementById("lightbox-close").addEventListener("click", () => {
  lightbox.hidden = true;
});
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.hidden = true;
});

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.hidden = false;
}

// --- Load manifest & render galleries ---
// Loaded from assets/screenshots/manifest.js (window.NEXO_MANIFEST) via a
// <script> tag instead of fetch(), so this also works when the page is
// opened directly from disk (file://), where fetch() of local files is blocked.
let manifest = window.NEXO_MANIFEST || { desktop: [], mobile: [] };

renderGallery("desktop");
renderGallery("mobile");
updateEmptyState("desktop");

if (manifest.desktop && manifest.desktop.length > 0) {
  const heroFrame = document.getElementById("hero-frame");
  heroFrame.innerHTML = `<img src="assets/screenshots/desktop/${manifest.desktop[0]}" alt="Vista previa de NEXO">`;
}

function renderGallery(type) {
  const container = galleries[type];
  const files = manifest[type] || [];
  container.innerHTML = "";
  files.forEach((filename) => {
    const src = `assets/screenshots/${type}/${filename}`;
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.innerHTML = `<img src="${src}" alt="Captura de NEXO (${type})" loading="lazy">`;
    item.addEventListener("click", () => openLightbox(src));
    container.appendChild(item);
  });
}

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
