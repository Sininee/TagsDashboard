let links = [];
let sortableCards = null;
let editingLinkId = null;

const isAdmin = window.TAGS_DASHBOARD_ROLE !== "guest";
const PRIVATE_TAG = "private";
const ADMIN_ONLY_TAG = "admin-only";

const defaultBodyBackground = "radial-gradient(circle at top, #141b2d 0, var(--bg) 45%)";

const statusBar = document.querySelector(".status-bar");
const systemInfoToggle = document.getElementById("systemInfoToggle");
const hideIpToggle = document.getElementById("hideIpToggle");

const cpuValue = document.getElementById("cpuValue");
const cpuFill = document.getElementById("cpuFill");
const ramValue = document.getElementById("ramValue");
const ramFill = document.getElementById("ramFill");
const storageValue = document.getElementById("storageValue");
const storageFill = document.getElementById("storageFill");

const grid = document.getElementById("grid");
const tagRow = document.getElementById("tagRow");
const searchInput = document.getElementById("searchInput");
const empty = document.getElementById("empty");

const openModalButton = document.getElementById("openModalButton");
const closeModalButton = document.getElementById("closeModalButton");
const cancelButton = document.getElementById("cancelButton");
const modalBackdrop = document.getElementById("modalBackdrop");
const addWebpageForm = document.getElementById("addWebpageForm");
const nameInput = document.getElementById("nameInput");
const ipInput = document.getElementById("ipInput");
const tagsInput = document.getElementById("tagsInput");
const formError = document.getElementById("formError");
const iconFileInput = document.getElementById("iconFileInput");
const chooseIconButton = document.getElementById("chooseIconButton");
const selectedIconName = document.getElementById("selectedIconName");
const linkModalTitle = document.getElementById("linkModalTitle");
const saveWebpageButton = document.getElementById("saveWebpageButton");

const openSettingsButton = document.getElementById("openSettingsButton");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const backgroundFileInput = document.getElementById("backgroundFileInput");
const chooseBackgroundButton = document.getElementById("chooseBackgroundButton");
const selectedBackgroundName = document.getElementById("selectedBackgroundName");
const resetBackgroundButton = document.getElementById("resetBackgroundButton");

if (!isAdmin) {
  if (openModalButton) openModalButton.style.display = "none";

  // Visitors can still use their local display settings, but only the
  // administrator is allowed to change the shared dashboard background.
  const backgroundSettingsGroup = backgroundFileInput?.closest(".form-group");
  if (backgroundSettingsGroup) backgroundSettingsGroup.style.display = "none";
  if (resetBackgroundButton) resetBackgroundButton.style.display = "none";
}

let selectedTag = "all";

function applySystemInfoVisibility(showSystemInfo) {
  if (!statusBar || !systemInfoToggle) return;

  statusBar.classList.toggle("hidden", !showSystemInfo);
  systemInfoToggle.checked = showSystemInfo;
  localStorage.setItem("showSystemInfo", showSystemInfo ? "true" : "false");

  if (showSystemInfo) {
    loadSystemStats();
  }
}

function applyHideIpSetting(hideIp) {
  if (hideIpToggle) {
    hideIpToggle.checked = hideIp;
  }

  document.body.classList.toggle("hide-ip-addresses", hideIp);
  localStorage.setItem("hideIpAddresses", hideIp ? "true" : "false");
}

async function loadSystemStats() {
  if (!systemInfoToggle || !systemInfoToggle.checked) return;

  try {
    const response = await fetch("/api/system");
    if (!response.ok) throw new Error("Could not load system stats");

    const stats = await response.json();

    cpuValue.textContent = `${stats.cpu.percent}%`;
    cpuFill.style.width = `${stats.cpu.percent}%`;

    ramValue.textContent = `${stats.ram.percent}% · ${stats.ram.used} / ${stats.ram.total}`;
    ramFill.style.width = `${stats.ram.percent}%`;

    storageValue.textContent = `${stats.storage.percent}% · ${stats.storage.used} / ${stats.storage.total}`;
    storageFill.style.width = `${stats.storage.percent}%`;
  } catch {
    cpuValue.textContent = "Unavailable";
    ramValue.textContent = "Unavailable";
    storageValue.textContent = "Unavailable";
  }
}

async function loadLinksFromServer() {
  try {
    const response = await fetch("/api/links");
    links = await response.json();
    renderTags();
    renderLinks();
  } catch (error) {
    console.error("Could not load links", error);
    empty.textContent = "Could not load saved webpages. Is the server running?";
    empty.style.display = "block";
  }
}

async function addLinkToServer(link) {
  const response = await fetch("/api/links", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(link)
  });

  if (!response.ok) {
    throw new Error("Could not save webpage");
  }

  links = await response.json();
}

async function updateLinkOnServer(id, link) {
  const response = await fetch(`/api/links/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(link)
  });

  if (!response.ok) {
    throw new Error("Could not update webpage");
  }

  links = await response.json();
}

async function saveLinkOrderToServer() {
  try {
    const orderedIds = links.map(link => link.id);

    const response = await fetch("/api/links/reorder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ orderedIds })
    });

    if (!response.ok) {
      throw new Error("Could not save link order");
    }

    links = await response.json();
  } catch (error) {
    console.error("Could not save link order", error);
    alert("Could not save the new order. Check that server.js has /api/links/reorder.");
  }
}

async function deleteLinkFromServer(id) {
  const response = await fetch(`/api/links/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Could not delete webpage");
  }

  links = await response.json();
}

async function uploadIconToServer(file) {
  const formData = new FormData();
  formData.append("icon", file);

  const response = await fetch("/api/upload-icon", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Could not upload icon");
  }

  const data = await response.json();
  return data.iconUrl;
}

async function loadSettingsFromServer() {
  try {
    const response = await fetch("/api/settings");
    const settings = await response.json();
    applyBackground(settings.backgroundUrl || "");
  } catch (error) {
    console.error("Could not load settings", error);
  }
}

async function uploadBackgroundToServer(file) {
  const formData = new FormData();
  formData.append("background", file);

  const response = await fetch("/api/upload-background", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Could not upload background");
  }

  const data = await response.json();
  applyBackground(data.backgroundUrl || "");
  return data.backgroundUrl;
}

async function resetBackgroundOnServer() {
  const response = await fetch("/api/background", {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Could not reset background");
  }

  applyBackground("");
}

function applyBackground(backgroundUrl) {
  if (!backgroundUrl) {
    document.body.style.background = defaultBodyBackground;
    document.body.style.backgroundSize = "";
    document.body.style.backgroundPosition = "";
    document.body.style.backgroundAttachment = "";
    document.body.style.backgroundRepeat = "";
    return;
  }

  document.body.style.background = `linear-gradient(rgba(8, 8, 8, 0.42), rgba(8, 8, 8, 0.76)), url("${backgroundUrl}")`;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center top";
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.backgroundAttachment = "fixed";
}

function hasTag(link, tagName) {
  return Array.isArray(link?.tags) && link.tags.some(tag =>
    String(tag).trim().toLowerCase() === tagName
  );
}

function hasSecretsTag(link) {
  return hasTag(link, PRIVATE_TAG);
}

function hasAdminOnlyTag(link) {
  return hasTag(link, ADMIN_ONLY_TAG);
}

function getAllTags() {
  const tags = new Set(["all"]);

  // #private is always available to the administrator, even when there
  // are currently no secret webpages. Guests never see reserved private tags.
  if (isAdmin) {
    tags.add(PRIVATE_TAG);
  }

  links.forEach(link => {
    link.tags.forEach(tag => {
      const normalizedTag = String(tag).trim().toLowerCase();
      if (isAdmin || (normalizedTag !== PRIVATE_TAG && normalizedTag !== ADMIN_ONLY_TAG)) {
        tags.add(tag);
      }
    });
  });

  return Array.from(tags);
}

function renderTags() {
  tagRow.innerHTML = "";

  getAllTags().forEach(tag => {
    const button = document.createElement("button");

    button.className = "tag" + (selectedTag === tag ? " active" : "");
    button.textContent = tag === "all" ? "All" : `#${tag}`;

    button.onclick = () => {
      selectedTag = tag;
      renderTags();
      renderLinks();
    };

    tagRow.appendChild(button);
  });
}

function matchesSearch(link, query) {
  const text = `${link.title} ${link.url} ${link.tags.join(" ")}`.toLowerCase();
  return text.includes(query.toLowerCase());
}

function getVisibleLinks() {
  const query = searchInput.value.trim();

  return links.filter(link => {
    const secret = hasSecretsTag(link);

    // #private keeps the old private-view behavior: secret webpages stay out
    // of All, search results, and normal tag filters until #private is chosen.
    if (secret && (!isAdmin || selectedTag !== PRIVATE_TAG)) {
      return false;
    }

    // When #private is selected, show only webpages carrying that tag.
    if (selectedTag === PRIVATE_TAG && !secret) {
      return false;
    }

    // #admin-only needs no special filtering here on the administrator page.
    // The server removes those webpages entirely from the guest API response.
    const tagMatch = selectedTag === "all" || link.tags.includes(selectedTag);
    const searchMatch = matchesSearch(link, query);
    return tagMatch && searchMatch;
  });
}

function renderLinks() {
  const filtered = getVisibleLinks();

  grid.innerHTML = "";
  empty.textContent = "No webpages found.";
  empty.style.display = filtered.length ? "none" : "block";

  filtered.forEach(link => {
    const wrap = document.createElement("div");
    wrap.className = "card-wrap";
    wrap.dataset.id = link.id;

    const card = document.createElement("a");
    card.className = "card";
    card.href = link.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    card.innerHTML = `
      <div class="card-header-row">
        <div class="icon" data-url="${escapeHtml(link.url)}"></div>
        <div class="title">${escapeHtml(link.title)}</div>
      </div>
      <div class="url">${escapeHtml(link.url)}</div>
      <div class="tags">
        ${link.tags.map(tag => `<span class="mini-tag">#${escapeHtml(tag)}</span>`).join("")}
      </div>
    `;

    wrap.appendChild(card);

    if (isAdmin) {
      const dragHandle = document.createElement("button");
      dragHandle.className = "drag-handle";
      dragHandle.innerHTML = "☰";
      dragHandle.title = "Drag to move";

      dragHandle.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
      };

      const editButton = document.createElement("button");
      editButton.className = "edit-button";
      editButton.innerHTML = "✎";
      editButton.title = "Edit webpage";

      editButton.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        openModal(link);
      };

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.innerHTML = "×";
      deleteButton.title = "Delete webpage";

      deleteButton.onclick = async event => {
        event.preventDefault();
        event.stopPropagation();

        const shouldDelete = confirm(`Delete ${link.title}?`);
        if (!shouldDelete) return;

        try {
          await deleteLinkFromServer(link.id);
          renderTags();
          renderLinks();
        } catch {
          alert("Could not delete webpage.");
        }
      };

      wrap.appendChild(dragHandle);
      wrap.appendChild(editButton);
      wrap.appendChild(deleteButton);
    }

    grid.appendChild(wrap);

    const iconBox = card.querySelector(".icon");
    loadFavicon(iconBox, link.url, link.title, link.iconUrl);
  });

  setupSortableCards();
}

function setupSortableCards() {
  if (!isAdmin) {
    if (sortableCards) {
      sortableCards.destroy();
      sortableCards = null;
    }
    return;
  }

  if (typeof Sortable === "undefined") {
    console.error("SortableJS is not loaded.");
    return;
  }

  if (sortableCards) {
    sortableCards.destroy();
  }

  sortableCards = new Sortable(grid, {
    animation: 180,
    handle: ".drag-handle",
    draggable: ".card-wrap",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    forceFallback: true,
    fallbackOnBody: true,
    swapThreshold: 0.65,

    onEnd: async () => {
      const visibleOrderedIds = Array.from(grid.querySelectorAll(".card-wrap"))
        .map(item => item.dataset.id)
        .filter(Boolean);

      const visibleOrderedLinks = visibleOrderedIds
        .map(id => links.find(link => link.id === id))
        .filter(Boolean);

      const visibleIdSet = new Set(visibleOrderedIds);

      const updatedLinks = [];
      let visibleIndex = 0;

      links.forEach(link => {
        if (visibleIdSet.has(link.id)) {
          updatedLinks.push(visibleOrderedLinks[visibleIndex]);
          visibleIndex += 1;
        } else {
          updatedLinks.push(link);
        }
      });

      links = updatedLinks;

      await saveLinkOrderToServer();
    }
  });
}

function getSpecialIconSources(linkUrl, title = "") {
  const text = `${title} ${linkUrl}`.toLowerCase();

  if (text.includes("navidrome")) {
    return [
      "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/navidrome.svg",
      "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/navidrome.png"
    ];
  }

  return [];
}

function loadFavicon(iconBox, linkUrl, title = "", customIconUrl = "") {
  if (customIconUrl) {
    const image = document.createElement("img");
    const fallback = document.createElement("span");

    fallback.className = "fallback-icon";
    fallback.textContent = "🌐";
    fallback.style.display = "none";

    image.alt = "";
    image.onerror = () => {
      image.style.display = "none";
      fallback.style.display = "block";
    };
    image.src = customIconUrl;

    iconBox.appendChild(image);
    iconBox.appendChild(fallback);
    return;
  }

  let origin;

  try {
    origin = new URL(linkUrl).origin;
  } catch {
    iconBox.innerHTML = `<span class="fallback-icon">🌐</span>`;
    return;
  }

  const faviconSources = [
    `/api/favicon?url=${encodeURIComponent(linkUrl)}`,
    ...getSpecialIconSources(linkUrl, title),
    `${origin}/favicon.ico`,
    `${origin}/favicon.png`,
    `${origin}/favicon.svg`,
    `${origin}/apple-touch-icon.png`
  ];

  let sourceIndex = 0;

  const image = document.createElement("img");
  const fallback = document.createElement("span");

  fallback.className = "fallback-icon";
  fallback.textContent = "🌐";
  fallback.style.display = "none";

  image.alt = "";
  image.onerror = () => {
    sourceIndex += 1;

    if (sourceIndex < faviconSources.length) {
      image.src = faviconSources[sourceIndex];
    } else {
      image.style.display = "none";
      fallback.style.display = "block";
    }
  };

  image.src = faviconSources[sourceIndex];
  iconBox.appendChild(image);
  iconBox.appendChild(fallback);
}

function normalizeUrl(value) {
  const trimmed = value.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `http://${trimmed}`;
}

function cleanTags(value) {
  return value
    .split(",")
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);
}

function openSettings() {
  settingsBackdrop.classList.add("open");
}

function closeSettings() {
  settingsBackdrop.classList.remove("open");
  backgroundFileInput.value = "";
  selectedBackgroundName.textContent =
    "Supported background types: PNG, JPG, JPEG, WEBP, and SVG. Maximum file size: 20 MB.";
}

function openModal(link = null) {
  editingLinkId = link ? link.id : null;
  addWebpageForm.reset();
  formError.style.display = "none";

  if (editingLinkId) {
    linkModalTitle.textContent = "Edit webpage";
    saveWebpageButton.textContent = "Save changes";
    nameInput.value = link.title || "";
    ipInput.value = link.url || "";
    tagsInput.value = Array.isArray(link.tags) ? link.tags.join(", ") : "";
    selectedIconName.textContent = link.iconUrl
      ? "Current custom icon will be kept unless you choose a new picture."
      : "Optional. Choose a custom icon picture, or leave this unchanged to keep automatic favicon detection.";
  } else {
    linkModalTitle.textContent = "Add webpage";
    saveWebpageButton.textContent = "Save webpage";
    selectedIconName.textContent =
      "Optional. Supported icon types: PNG, JPG, JPEG, WEBP, SVG, and ICO. Maximum file size: 20 MB.";
  }

  modalBackdrop.classList.add("open");
  setTimeout(() => nameInput.focus(), 50);
}

function closeModal() {
  modalBackdrop.classList.remove("open");
  editingLinkId = null;
  addWebpageForm.reset();
  linkModalTitle.textContent = "Add webpage";
  saveWebpageButton.textContent = "Save webpage";
  selectedIconName.textContent =
    "Optional. Supported icon types: PNG, JPG, JPEG, WEBP, SVG, and ICO. Maximum file size: 20 MB.";
  formError.style.display = "none";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

searchInput.addEventListener("input", renderLinks);

if (isAdmin) {
  openModalButton.addEventListener("click", openModal);
  closeModalButton.addEventListener("click", closeModal);
  cancelButton.addEventListener("click", closeModal);
}

openSettingsButton.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);

systemInfoToggle.addEventListener("change", () => {
  applySystemInfoVisibility(systemInfoToggle.checked);
});

hideIpToggle.addEventListener("change", () => {
  applyHideIpSetting(hideIpToggle.checked);
});

chooseIconButton.addEventListener("click", () => {
  if (!isAdmin) return;
  iconFileInput.click();
});

iconFileInput.addEventListener("change", () => {
  const file = iconFileInput.files[0];
  selectedIconName.textContent = file ? `Selected: ${file.name}` : "No icon selected.";
});

if (isAdmin) {
  chooseBackgroundButton.addEventListener("click", () => {
    backgroundFileInput.click();
  });

  backgroundFileInput.addEventListener("change", async () => {
    const file = backgroundFileInput.files[0];

    if (!file) {
      selectedBackgroundName.textContent = "No background selected.";
      return;
    }

    selectedBackgroundName.textContent = `Uploading: ${file.name}`;

    try {
      await uploadBackgroundToServer(file);
      selectedBackgroundName.textContent = `Current background: ${file.name}`;
    } catch {
      selectedBackgroundName.textContent = "Could not upload background. Check file type and 20 MB limit.";
    }
  });

  resetBackgroundButton.addEventListener("click", async () => {
    try {
      await resetBackgroundOnServer();
      selectedBackgroundName.textContent = "Background removed. Using the default background.";
    } catch {
      selectedBackgroundName.textContent = "Could not reset background. Is the server running?";
    }
  });
}

modalBackdrop.addEventListener("click", event => {
  if (event.target === modalBackdrop) {
    closeModal();
  }
});

settingsBackdrop.addEventListener("click", event => {
  if (event.target === settingsBackdrop) {
    closeSettings();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (modalBackdrop.classList.contains("open")) {
      closeModal();
    }

    if (settingsBackdrop.classList.contains("open")) {
      closeSettings();
    }
  }
});

addWebpageForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin) return;

  const title = nameInput.value.trim();
  const ipValue = ipInput.value.trim();
  const url = normalizeUrl(ipValue);
  const tags = cleanTags(tagsInput.value);
  const editingLink = editingLinkId
    ? links.find(link => link.id === editingLinkId)
    : null;
  let iconUrl = editingLink?.iconUrl || "";

  if (!title || !ipValue) {
    formError.textContent = "Please add both a webpage name and an IP/URL.";
    formError.style.display = "block";
    return;
  }

  try {
    const iconFile = iconFileInput.files[0];

    if (iconFile) {
      iconUrl = await uploadIconToServer(iconFile);
    }

    const linkData = {
      title,
      url,
      tags: tags.length ? tags : ["saved"],
      iconUrl
    };

    if (editingLinkId) {
      await updateLinkOnServer(editingLinkId, linkData);
    } else {
      await addLinkToServer(linkData);
    }

    selectedTag = "all";
    searchInput.value = "";
    renderTags();
    renderLinks();
    closeModal();
  } catch {
    formError.textContent = editingLinkId
      ? "Could not update webpage. Is the server running?"
      : "Could not save webpage. Is the server running?";
    formError.style.display = "block";
  }
});

const savedSystemInfoSetting = localStorage.getItem("showSystemInfo");
const showSystemInfo = savedSystemInfoSetting === null ? true : savedSystemInfoSetting === "true";

const savedHideIpSetting = localStorage.getItem("hideIpAddresses");
const hideIpAddresses = savedHideIpSetting === null ? false : savedHideIpSetting === "true";

applySystemInfoVisibility(showSystemInfo);
applyHideIpSetting(hideIpAddresses);

loadSettingsFromServer();

setInterval(() => {
  if (systemInfoToggle.checked) {
    loadSystemStats();
  }
}, 5000);

loadLinksFromServer();