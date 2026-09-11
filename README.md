<div align="center">
  <img src="./favicon.png" alt="Tags Dashboard icon" width="110">

# Tags Dashboard

**A lightweight, self-hosted dashboard for organizing websites and self-hosted services.**

Separate **administrator** and **read-only guest** views, custom tags, icons, backgrounds, and persistent container storage.

![Docker](https://img.shields.io/badge/Docker-supported-2496ED?logo=docker&logoColor=white)
![Podman](https://img.shields.io/badge/Podman-supported-892CA0?logo=podman&logoColor=white)
![ARM64](https://img.shields.io/badge/ARM64-supported-lightgrey)
![AMD64](https://img.shields.io/badge/AMD64-supported-lightgrey)

</div>

---

## ✨ Features

- 🏷️ **Tag-based organization** for websites and self-hosted services
- 🔎 **Search and filtering**
- 🖱️ **Drag-and-drop ordering**
- 🖼️ **Automatic favicons**
- 🎨 **Custom icons and backgrounds**
- 📊 **CPU, RAM, and storage information**
- 👤 **Separate administrator and guest views**
- 🔒 **Private and administrator-only links**
- 💾 **Persistent data stored outside the container**
- 🐳 **Runs with Podman or Docker**
- 🧩 **Prebuilt ARM64 and AMD64 container images**

## 🚀 Installation

The easiest way to run Tags Dashboard is with one of the prebuilt container images attached to the latest GitHub Release.

### Requirements

You only need **one** of these:

- Podman
- Docker

No Node.js, npm, or build tools are required when using a prebuilt image.

### 1. Choose the correct image

Download the image that matches your system from the latest GitHub **Release**:

| System | Architecture | Release file |
| --- | --- | --- |
| Raspberry Pi / ARM Linux | `linux/arm64` | `tagsdashboard-arm64.tar` |
| Ubuntu / x86-64 PC or server | `linux/amd64` | `tagsdashboard-amd64.tar` |

If you are unsure which architecture your Linux system uses, run:

```bash
uname -m
```

Common results:

```text
aarch64  = ARM64
x86_64   = AMD64 / x86-64
```

Both release archives contain the container image:

```text
tagsdashboard:latest
```

---

## 🦭 Run with Podman

### ARM64 / Raspberry Pi

Load the image:

```bash
podman load -i tagsdashboard-arm64.tar
```

### AMD64 / x86-64

Load the image:

```bash
podman load -i tagsdashboard-amd64.tar
```

Then create a directory for persistent dashboard data:

```bash
mkdir -p "$HOME/TagsServerData"
```

Start Tags Dashboard:

```bash
podman run -d \
  --name TagsDashboard \
  --restart=unless-stopped \
  -p 7000:7000 \
  -p 7002:7002 \
  -v "$HOME/TagsServerData:/app/data:Z" \
  tagsdashboard:latest
```

Check that it is running:

```bash
podman ps
```

View the logs:

```bash
podman logs TagsDashboard
```

---

## 🐳 Run with Docker

### ARM64 / Raspberry Pi

Load the image:

```bash
docker load -i tagsdashboard-arm64.tar
```

### AMD64 / x86-64

Load the image:

```bash
docker load -i tagsdashboard-amd64.tar
```

Then create a directory for persistent dashboard data:

```bash
mkdir -p "$HOME/TagsServerData"
```

Start Tags Dashboard:

```bash
docker run -d \
  --name TagsDashboard \
  --restart=unless-stopped \
  -p 7000:7000 \
  -p 7002:7002 \
  -v "$HOME/TagsServerData:/app/data" \
  tagsdashboard:latest
```

Check that it is running:

```bash
docker ps
```

View the logs:

```bash
docker logs TagsDashboard
```

---

## 🌐 Open the dashboard

By default Tags Dashboard uses two ports:

| View | Port | Purpose |
| --- | ---: | --- |
| Administrator | `7000` | Add, edit, delete, reorder, and configure links |
| Guest | `7002` | Read-only dashboard |

Open:

```text
Administrator: http://YOUR-SERVER-IP:7000
Guest:         http://YOUR-SERVER-IP:7002
```

If you are running it on the same computer:

```text
http://localhost:7000
```

## 🔐 Administrator and guest views

The **administrator view** can:

- Add links
- Edit links
- Delete links
- Change tags
- Reorder cards
- Upload icons
- Change dashboard settings

The **guest view** is read-only.

Guest restrictions are enforced by the server, not just hidden in the browser interface. Requests that attempt to modify dashboard data through the guest port are rejected.

### Reserved tags

Tags Dashboard includes two special tags:

- **`private`** — hidden until explicitly selected by the administrator and never returned to guests.
- **`admin-only`** — visible normally to the administrator but completely omitted from the guest API.

> [!IMPORTANT]
> Tags Dashboard does **not** currently include built-in authentication. Port `7000` should be treated as a trusted administrator interface. Do not expose it directly to the public Internet without an authentication or reverse-proxy layer.

## 💾 Persistent data

Your links and uploaded files are stored outside the container in:

```text
~/TagsServerData/
```

Inside it, Tags Dashboard creates data similar to:

```text
TagsServerData/
├── config.json
├── icons/
└── backgrounds/
```

This means you can remove, recreate, or update the container without losing your dashboard configuration.

## 🔄 Updating Tags Dashboard

Download the newer image for your system from the latest GitHub Release.

### Podman

Stop and remove the old container:

```bash
podman stop TagsDashboard
podman rm TagsDashboard
```

Load the new image:

```bash
podman load -i tagsdashboard-arm64.tar
```

or:

```bash
podman load -i tagsdashboard-amd64.tar
```

Then run the same `podman run` command again.

### Docker

Stop and remove the old container:

```bash
docker stop TagsDashboard
docker rm TagsDashboard
```

Load the new image:

```bash
docker load -i tagsdashboard-arm64.tar
```

or:

```bash
docker load -i tagsdashboard-amd64.tar
```

Then run the same `docker run` command again.

Your dashboard data remains safe in:

```text
~/TagsServerData
```

## 🛠️ Building from source

The repository also contains the source code and Dockerfile for anyone who wants to modify or build Tags Dashboard themselves.

Build with Docker:

```bash
docker build -t tagsdashboard:latest .
```

Or build with Podman:

```bash
podman build -t tagsdashboard:latest .
```

The prebuilt release images are not required when building from source.

### Verify the image architecture

You can check a locally built Docker image with:

```bash
docker image inspect tagsdashboard:latest --format '{{.Os}}/{{.Architecture}}'
```

Typical results:

```text
linux/arm64
```

or:

```text
linux/amd64
```

## 📁 Project structure

```text
TagsDashboard/
├── app.js
├── index.html
├── style.css
├── server.js
├── favicon.png
├── package.json
├── package-lock.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
└── README.md
```

Runtime data, dependencies, and container image exports are intentionally excluded from the Git repository.

The prebuilt `.tar` images are distributed through **GitHub Releases** instead.

## 🛡️ Security

Before publishing a fork or modified copy, make sure you do not commit private runtime data such as:

```text
data/
links.json
settings.json
config.json
icons/
backgrounds/
node_modules/
```

These may contain saved URLs, local addresses, uploaded images, or other information specific to your installation.

## 🧰 Technology

- Node.js
- Express
- Multer
- SortableJS
- HTML
- CSS
- JavaScript
- Docker / Podman

## 📜 License

See the `LICENSE` file for licensing information.

---

<div align="center">
  <strong>Tags Dashboard</strong><br>
  A simple home for your self-hosted services and favorite links.
</div>
