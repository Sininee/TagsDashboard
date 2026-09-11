const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const os = require("os");
const { exec } = require("child_process");

const app = express();
const ADMIN_PORT = Number(process.env.PORT || process.env.ADMIN_PORT || 7000);
const GUEST_PORT = Number(process.env.GUEST_PORT || 7002);
const PRIVATE_TAG = "private";
const ADMIN_ONLY_TAG = "admin-only";
const APP_DIR = __dirname;

function isGuestRequest(req) {
  return Number(req.socket.localPort) === GUEST_PORT;
}

function requireAdminPort(req, res, next) {
  if (isGuestRequest(req)) {
    return res.status(403).json({
      error: "This action is only available on the administrator port."
    });
  }

  next();
}

function sendDashboard(req, res) {
  const htmlPath = path.join(APP_DIR, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  const role = isGuestRequest(req) ? "guest" : "admin";
  const roleBootstrap = `
  <script>window.TAGS_DASHBOARD_ROLE = ${JSON.stringify(role)};</script>`;

  html = html.replace("</head>", `${roleBootstrap}
</head>`);
  res.type("html").send(html);
}

// Application files stay in /app; all user data lives in the persistent data directory.
const DATA_DIR = path.resolve(
  process.env.TAGSSERVER_DATA_DIR || path.join(APP_DIR, "data")
);
const configFile = path.join(DATA_DIR, "config.json");
const iconsDir = path.join(DATA_DIR, "icons");
const backgroundsDir = path.join(DATA_DIR, "backgrounds");

const defaultConfig = {
  version: 1,
  links: [],
  settings: {
    backgroundUrl: ""
  }
};

function cryptoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeConfig(config) {
  return {
    version: 1,
    links: Array.isArray(config?.links) ? config.links : [],
    settings: {
      backgroundUrl:
        typeof config?.settings?.backgroundUrl === "string"
          ? config.settings.backgroundUrl
          : ""
    }
  };
}

function writeConfig(config) {
  ensureDirectory(DATA_DIR);

  const normalized = normalizeConfig(config);
  const temporaryFile = `${configFile}.tmp`;

  fs.writeFileSync(temporaryFile, JSON.stringify(normalized, null, 2));
  fs.renameSync(temporaryFile, configFile);
}

function initializeDataStorage() {
  ensureDirectory(DATA_DIR);
  ensureDirectory(iconsDir);
  ensureDirectory(backgroundsDir);

  if (!fs.existsSync(configFile)) {
    writeConfig(defaultConfig);
    console.log("Created a new empty TagsServer configuration.");
  }
}

function readConfig() {
  initializeDataStorage();

  const config = readJsonFile(configFile, defaultConfig);
  return normalizeConfig(config);
}

function readLinks() {
  return readConfig().links;
}

function writeLinks(links) {
  const config = readConfig();
  config.links = Array.isArray(links) ? links : [];
  writeConfig(config);
}

function readSettings() {
  return readConfig().settings;
}

function writeSettings(settings) {
  const config = readConfig();
  config.settings = {
    backgroundUrl:
      typeof settings?.backgroundUrl === "string" ? settings.backgroundUrl : ""
  };
  writeConfig(config);
}

initializeDataStorage();

const allowedImageTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon"
];

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "background") {
        cb(null, backgroundsDir);
      } else {
        cb(null, iconsDir);
      }
    },
    filename: (req, file, cb) => {
      const safeOriginalName = file.originalname
        .replaceAll(" ", "-")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const uniqueName = `${Date.now()}-${safeOriginalName || "image"}`;
      cb(null, uniqueName);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PNG, JPG, JPEG, WEBP, SVG, and ICO files are allowed."));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

app.use(express.json());

// Serve only files the browser actually needs. User configuration and server
// source files are never exposed as static web files.
app.use("/icons", express.static(iconsDir));
app.use("/backgrounds", express.static(backgroundsDir));

app.get("/", sendDashboard);
app.get("/index.html", sendDashboard);

app.get("/app.js", (req, res) => {
  res.sendFile(path.join(APP_DIR, "app.js"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(APP_DIR, "style.css"));
});

app.get("/favicon.png", (req, res) => {
  res.sendFile(path.join(APP_DIR, "favicon.png"));
});

function deleteFileIfLocal(fileUrl, allowedFolderName) {
  if (!fileUrl || typeof fileUrl !== "string") return;

  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return;

  const expectedPrefix = `/${allowedFolderName}/`;
  if (!fileUrl.startsWith(expectedPrefix)) return;

  const fileName = path.basename(fileUrl);
  const folderPath = allowedFolderName === "icons" ? iconsDir : backgroundsDir;
  const filePath = path.join(folderPath, fileName);

  const resolvedFolder = path.resolve(folderPath) + path.sep;
  const resolvedFile = path.resolve(filePath);

  if (!resolvedFile.startsWith(resolvedFolder)) return;

  fs.unlink(filePath, error => {
    if (error && error.code !== "ENOENT") {
      console.error(`Could not delete ${filePath}:`, error.message);
    }
  });
}

function formatBytes(bytes) {
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(1)} GB`;
}

function getCpuUsage() {
  return new Promise(resolve => {
    const start = os.cpus();

    setTimeout(() => {
      const end = os.cpus();

      let idleDifference = 0;
      let totalDifference = 0;

      for (let i = 0; i < start.length; i++) {
        const startCpu = start[i].times;
        const endCpu = end[i].times;

        const startIdle = startCpu.idle;
        const endIdle = endCpu.idle;

        const startTotal = Object.values(startCpu).reduce((a, b) => a + b, 0);
        const endTotal = Object.values(endCpu).reduce((a, b) => a + b, 0);

        idleDifference += endIdle - startIdle;
        totalDifference += endTotal - startTotal;
      }

      if (totalDifference === 0) {
        return resolve(0);
      }

      const usage = 100 - Math.round((idleDifference / totalDifference) * 100);
      resolve(Math.max(0, Math.min(100, usage)));
    }, 250);
  });
}

function getStorageUsage() {
  return new Promise(resolve => {
    exec("df -k /", (error, stdout) => {
      if (error) {
        return resolve({
          percent: 0,
          used: "Unavailable",
          total: "Unavailable"
        });
      }

      const lines = stdout.trim().split("\n");

      if (lines.length < 2) {
        return resolve({
          percent: 0,
          used: "Unavailable",
          total: "Unavailable"
        });
      }

      const parts = lines[1].split(/\s+/);
      const totalKb = Number(parts[1]);
      const usedKb = Number(parts[2]);

      if (!totalKb || Number.isNaN(usedKb)) {
        return resolve({
          percent: 0,
          used: "Unavailable",
          total: "Unavailable"
        });
      }

      const percent = Math.round((usedKb / totalKb) * 100);

      resolve({
        percent,
        used: formatBytes(usedKb * 1024),
        total: formatBytes(totalKb * 1024)
      });
    });
  });
}

async function fetchWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 Tags Dashboard"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function findIconInHtml(html, pageUrl) {
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];

  const iconTags = linkTags.filter(tag => {
    const rel = tag.match(/\brel=["']?([^"'>\s]+(?:\s+[^"'>\s]+)*)/i);
    return rel && rel[1].toLowerCase().includes("icon");
  });

  for (const tag of iconTags) {
    const href = tag.match(/\bhref=["']([^"']+)["']/i);

    if (href && href[1]) {
      try {
        return new URL(href[1], pageUrl).toString();
      } catch {}
    }
  }

  return null;
}

app.get("/api/role", (req, res) => {
  res.json({ role: isGuestRequest(req) ? "guest" : "admin" });
});

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

app.get("/api/links", (req, res) => {
  const links = readLinks();

  // Never send #private or #admin-only webpages to the visitor port.
  // Their titles, URLs, tags, and icon references stay out of the guest API
  // response rather than merely being hidden by browser-side JavaScript.
  if (isGuestRequest(req)) {
    return res.json(links.filter(link =>
      !hasSecretsTag(link) && !hasAdminOnlyTag(link)
    ));
  }

  res.json(links);
});

app.post("/api/links", requireAdminPort, (req, res) => {
  const { title, url, tags, iconUrl } = req.body;

  if (!title || !url) {
    return res.status(400).json({
      error: "Title and URL are required"
    });
  }

  const links = readLinks();

  const newLink = {
    id: cryptoId(),
    title,
    url,
    tags: Array.isArray(tags) && tags.length ? tags : ["saved"],
    iconUrl: iconUrl || ""
  };

  links.unshift(newLink);
  writeLinks(links);

  res.json(links);
});

app.put("/api/links/:id", requireAdminPort, (req, res) => {
  const { title, url, tags, iconUrl } = req.body;

  if (!title || !url) {
    return res.status(400).json({
      error: "Title and URL are required"
    });
  }

  const links = readLinks();
  const linkIndex = links.findIndex(link => link.id === req.params.id);

  if (linkIndex === -1) {
    return res.status(404).json({
      error: "Webpage not found"
    });
  }

  const currentLink = links[linkIndex];
  const updatedIconUrl =
    typeof iconUrl === "string" ? iconUrl : currentLink.iconUrl || "";

  if (
    currentLink.iconUrl &&
    currentLink.iconUrl !== updatedIconUrl
  ) {
    deleteFileIfLocal(currentLink.iconUrl, "icons");
  }

  links[linkIndex] = {
    ...currentLink,
    title,
    url,
    tags: Array.isArray(tags) && tags.length ? tags : ["saved"],
    iconUrl: updatedIconUrl
  };

  writeLinks(links);
  res.json(links);
});

app.post("/api/links/reorder", requireAdminPort, (req, res) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({
      error: "orderedIds must be an array"
    });
  }

  const links = readLinks();

  const orderedLinks = orderedIds
    .map(id => links.find(link => link.id === id))
    .filter(Boolean);

  const missingLinks = links.filter(link => !orderedIds.includes(link.id));
  const updatedLinks = [...orderedLinks, ...missingLinks];

  writeLinks(updatedLinks);
  res.json(updatedLinks);
});

app.delete("/api/links/:id", requireAdminPort, (req, res) => {
  const links = readLinks();
  const linkToDelete = links.find(link => link.id === req.params.id);

  if (linkToDelete && linkToDelete.iconUrl) {
    deleteFileIfLocal(linkToDelete.iconUrl, "icons");
  }

  const updatedLinks = links.filter(link => link.id !== req.params.id);

  writeLinks(updatedLinks);
  res.json(updatedLinks);
});

app.get("/api/settings", (req, res) => {
  res.json(readSettings());
});

app.get("/api/system", async (req, res) => {
  try {
    const cpuPercent = await getCpuUsage();

    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const ramPercent = Math.round((usedRam / totalRam) * 100);

    const storage = await getStorageUsage();

    res.json({
      cpu: {
        percent: cpuPercent
      },
      ram: {
        percent: ramPercent,
        used: formatBytes(usedRam),
        total: formatBytes(totalRam)
      },
      storage
    });
  } catch {
    res.status(500).json({
      error: "Could not load system stats"
    });
  }
});

app.post("/api/upload-icon", requireAdminPort, upload.single("icon"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No icon uploaded"
    });
  }

  res.json({
    iconUrl: `/icons/${req.file.filename}`
  });
});

app.post("/api/upload-background", requireAdminPort, upload.single("background"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No background uploaded"
    });
  }

  const settings = readSettings();

  if (settings.backgroundUrl) {
    deleteFileIfLocal(settings.backgroundUrl, "backgrounds");
  }

  settings.backgroundUrl = `/backgrounds/${req.file.filename}`;

  writeSettings(settings);
  res.json(settings);
});

app.delete("/api/background", requireAdminPort, (req, res) => {
  const settings = readSettings();

  if (settings.backgroundUrl) {
    deleteFileIfLocal(settings.backgroundUrl, "backgrounds");
  }

  settings.backgroundUrl = "";

  writeSettings(settings);
  res.json(settings);
});

app.get("/api/favicon", async (req, res) => {
  try {
    const pageUrl = new URL(req.query.url);

    if (!['http:', 'https:'].includes(pageUrl.protocol)) {
      return res.status(400).send("Invalid URL");
    }

    const pageResponse = await fetchWithTimeout(pageUrl.toString());
    const html = await pageResponse.text();

    let iconUrl = findIconInHtml(html, pageUrl.toString());

    if (!iconUrl) {
      iconUrl = new URL("/favicon.ico", pageUrl.origin).toString();
    }

    const iconResponse = await fetchWithTimeout(iconUrl);

    if (!iconResponse.ok) {
      return res.status(404).send("Icon not found");
    }

    const contentType = iconResponse.headers.get("content-type") || "image/x-icon";
    const buffer = Buffer.from(await iconResponse.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch {
    res.status(404).send("Icon not found");
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File is too large. Maximum file size is 20 MB."
      });
    }
  }

  res.status(400).json({
    error: error.message || "Something went wrong."
  });
});

app.listen(ADMIN_PORT, "0.0.0.0", () => {
  console.log(`Tags dashboard administrator port: http://0.0.0.0:${ADMIN_PORT}`);
  console.log(`Persistent data directory: ${DATA_DIR}`);
});

if (GUEST_PORT !== ADMIN_PORT) {
  app.listen(GUEST_PORT, "0.0.0.0", () => {
    console.log(`Tags dashboard guest port: http://0.0.0.0:${GUEST_PORT}`);
  });
} else {
  console.warn("GUEST_PORT matches the administrator port, so the guest port was not started.");
}
