const log = document.getElementById("log");
const folderStatus = document.getElementById("folder-status");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const typeButtons = document.querySelectorAll(".type-toggle button");
const uploadedGrids = {
  desktop: document.getElementById("uploaded-desktop"),
  mobile: document.getElementById("uploaded-mobile"),
};
const uploadedEmptyMsgs = {
  desktop: document.getElementById("uploaded-desktop-empty"),
  mobile: document.getElementById("uploaded-mobile-empty"),
};

let projectDirHandle = null;
let currentType = "desktop";
const objectUrls = [];
let dragState = null; // { type, filename } of the item currently being dragged

function buildDeviceMockup(type, src) {
  if (type === "desktop") {
    return `
      <div class="device-mockup device-mockup-desktop">
        <div class="device-frame device-frame-desktop">
          <div class="device-cam" aria-hidden="true"></div>
          <div class="device-screen"><img src="${src}" alt=""></div>
        </div>
        <div class="device-stand" aria-hidden="true">
          <div class="device-stand-neck"></div>
          <div class="device-stand-base"></div>
        </div>
      </div>
    `;
  }
  return `
    <div class="device-mockup device-mockup-mobile">
      <div class="device-frame device-frame-mobile">
        <div class="device-island" aria-hidden="true"></div>
        <div class="device-screen">
          <img src="${src}" alt="">
          <div class="device-home-indicator" aria-hidden="true"></div>
        </div>
      </div>
      <div class="device-btn device-btn-mute" aria-hidden="true"></div>
      <div class="device-btn device-btn-vol-up" aria-hidden="true"></div>
      <div class="device-btn device-btn-vol-down" aria-hidden="true"></div>
      <div class="device-btn device-btn-power" aria-hidden="true"></div>
    </div>
  `;
}

function logLine(text, cls) {
  const span = document.createElement("div");
  if (cls) span.className = cls;
  span.textContent = text;
  log.prepend(span);
}

if (!window.showDirectoryPicker) {
  logLine(
    "Tu navegador no soporta esta función. Usá Chrome o Edge en escritorio.",
    "err"
  );
}

typeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    typeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
  });
});

document.getElementById("pick-folder").addEventListener("click", async () => {
  try {
    projectDirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    // Sanity check: make sure it looks like the right folder.
    let looksRight = false;
    for await (const name of projectDirHandle.keys()) {
      if (name === "index.html") looksRight = true;
    }
    if (!looksRight) {
      logLine(
        "⚠️ No encontré index.html en esa carpeta. Verificá que sea la carpeta raíz de NEXO.",
        "err"
      );
    }
    folderStatus.textContent = `Carpeta seleccionada: ${projectDirHandle.name}`;
    logLine(`Carpeta del proyecto conectada: ${projectDirHandle.name}`, "ok");
    await refreshUploadedGallery();
  } catch (err) {
    if (err.name !== "AbortError") logLine("Error al elegir la carpeta: " + err.message, "err");
  }
});

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
  fileInput.value = "";
});

async function getScreenshotsDir() {
  const assetsDir = await projectDirHandle.getDirectoryHandle("assets", { create: true });
  return assetsDir.getDirectoryHandle("screenshots", { create: true });
}

async function handleFiles(fileList) {
  if (!projectDirHandle) {
    logLine("Primero elegí la carpeta del proyecto (Paso 1).", "err");
    return;
  }
  const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  if (files.length === 0) return;

  const hasPermission = await ensureWritePermission(projectDirHandle);
  if (!hasPermission) {
    logLine(
      "No se pudo obtener permiso de escritura. Volvé a elegir la carpeta (Paso 1) y aceptá el permiso.",
      "err"
    );
    return;
  }

  try {
    const screenshotsDir = await getScreenshotsDir();
    const targetDir = await screenshotsDir.getDirectoryHandle(currentType, { create: true });

    const manifest = await readManifest(screenshotsDir);

    for (const file of files) {
      const safeName = sanitizeFilename(file.name);
      const fileHandle = await targetDir.getFileHandle(safeName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();
      if (!manifest[currentType].includes(safeName)) {
        manifest[currentType].push(safeName);
      }
      logLine(`✔ Guardada: assets/screenshots/${currentType}/${safeName}`, "ok");
    }

    await writeManifest(screenshotsDir, manifest);
    logLine(`Manifiesto actualizado (${currentType}: ${manifest[currentType].length} capturas).`, "ok");
    await refreshUploadedGallery();
  } catch (err) {
    logLine("Error al guardar: " + err.message, "err");
  }
}

async function deleteScreenshot(type, filename) {
  if (!confirm(`¿Borrar "${filename}"? Esta acción no se puede deshacer.`)) return;

  try {
    const screenshotsDir = await getScreenshotsDir();
    const targetDir = await screenshotsDir.getDirectoryHandle(type, { create: true });
    await targetDir.removeEntry(filename);

    const manifest = await readManifest(screenshotsDir);
    manifest[type] = manifest[type].filter((name) => name !== filename);
    await writeManifest(screenshotsDir, manifest);

    logLine(`🗑 Borrada: assets/screenshots/${type}/${filename}`, "ok");
    await refreshUploadedGallery();
  } catch (err) {
    logLine("Error al borrar: " + err.message, "err");
  }
}

async function refreshUploadedGallery() {
  if (!projectDirHandle) return;

  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.length = 0;

  const screenshotsDir = await getScreenshotsDir();
  const manifest = await readManifest(screenshotsDir);

  for (const type of ["desktop", "mobile"]) {
    const grid = uploadedGrids[type];
    const emptyMsg = uploadedEmptyMsgs[type];
    grid.innerHTML = "";

    const filenames = manifest[type] || [];
    emptyMsg.hidden = filenames.length > 0;

    if (filenames.length === 0) continue;

    const targetDir = await screenshotsDir.getDirectoryHandle(type, { create: true });

    for (const filename of filenames) {
      let url;
      try {
        const fileHandle = await targetDir.getFileHandle(filename);
        const file = await fileHandle.getFile();
        url = URL.createObjectURL(file);
        objectUrls.push(url);
      } catch {
        continue; // File referenced in manifest but missing on disk; skip.
      }

      const item = document.createElement("div");
      item.className = "uploaded-item";
      item.draggable = true;
      item.dataset.type = type;
      item.dataset.filename = filename;
      item.innerHTML = `
        <span class="order-badge">${filenames.indexOf(filename) + 1}</span>
        <button class="uploaded-delete" title="Borrar">✕</button>
        ${buildDeviceMockup(type, url)}
        <span class="filename">${filename}</span>
      `;
      item.querySelector(".uploaded-delete").addEventListener("click", () => {
        deleteScreenshot(type, filename);
      });
      attachDragHandlers(item, type, filename);
      grid.appendChild(item);
    }
  }
}

function attachDragHandlers(item, type, filename) {
  item.addEventListener("dragstart", (e) => {
    dragState = { type, filename };
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    // Firefox requires data to be set for the drag to start at all.
    e.dataTransfer.setData("text/plain", filename);
  });

  item.addEventListener("dragend", () => {
    dragState = null;
    item.classList.remove("dragging");
    item.parentElement
      ?.querySelectorAll(".uploaded-item.drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
  });

  item.addEventListener("dragover", (e) => {
    if (!dragState || dragState.type !== type || dragState.filename === filename) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    item.classList.add("drag-over");
  });

  item.addEventListener("dragleave", () => {
    item.classList.remove("drag-over");
  });

  item.addEventListener("drop", async (e) => {
    e.preventDefault();
    item.classList.remove("drag-over");
    if (!dragState || dragState.type !== type || dragState.filename === filename) return;
    await reorderScreenshot(type, dragState.filename, filename);
  });
}

async function reorderScreenshot(type, draggedFilename, targetFilename) {
  try {
    const screenshotsDir = await getScreenshotsDir();
    const manifest = await readManifest(screenshotsDir);
    const list = manifest[type];

    const fromIndex = list.indexOf(draggedFilename);
    const toIndex = list.indexOf(targetFilename);
    if (fromIndex === -1 || toIndex === -1) return;

    list.splice(fromIndex, 1);
    list.splice(toIndex, 0, draggedFilename);

    await writeManifest(screenshotsDir, manifest);
    logLine(`Orden actualizado (${type}).`, "ok");
    await refreshUploadedGallery();
  } catch (err) {
    logLine("Error al reordenar: " + err.message, "err");
  }
}

async function ensureWritePermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}

function sanitizeFilename(name) {
  return name.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.\-_]/g, "");
}

async function readManifest(screenshotsDir) {
  try {
    const fileHandle = await screenshotsDir.getFileHandle("manifest.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.desktop) data.desktop = [];
    if (!data.mobile) data.mobile = [];
    return data;
  } catch {
    return { desktop: [], mobile: [] };
  }
}

async function writeManifest(screenshotsDir, manifest) {
  const json = JSON.stringify(manifest, null, 2);

  const jsonHandle = await screenshotsDir.getFileHandle("manifest.json", { create: true });
  const jsonWritable = await jsonHandle.createWritable();
  await jsonWritable.write(json);
  await jsonWritable.close();

  // manifest.js lets index.html load screenshots via <script src>, which works
  // even when the page is opened directly from disk (file://), unlike fetch().
  const jsHandle = await screenshotsDir.getFileHandle("manifest.js", { create: true });
  const jsWritable = await jsHandle.createWritable();
  await jsWritable.write(`window.NEXO_MANIFEST = ${json};\n`);
  await jsWritable.close();
}
