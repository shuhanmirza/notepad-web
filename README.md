# notepad-web

A small, private, browser-based plain text editor. It has no accounts, text
formatting, analytics, or backend database—just a fast place to write and keep
plain text.

The primary deployment is [txt.shuhanmirza.com](https://txt.shuhanmirza.com).

## Features

- Create, rename, edit, and delete plain-text documents
- Save documents automatically in the browser with IndexedDB
- Synchronize changes between tabs in the same browser
- Show when the current document is open in multiple tabs
- Display word, character, and line counts
- Copy a document to the clipboard or download it as a `.txt` file
- Choose between Carbon, Paper, and Midnight themes
- Support `Ctrl/Command + S` to save
- Work on desktop and mobile screen sizes

## How storage works

Documents are stored locally in the browser profile that created them. The web
server only delivers the application files and never receives document
contents.

Documents remain available after refreshing the page, closing the browser, or
replacing the Docker container. They are not shared between different devices,
browsers, or browser profiles. Clearing the site's browser data will delete the
stored documents.

## Technology

- [Vue 3](https://vuejs.org/) for the user interface
- [TypeScript](https://www.typescriptlang.org/) for application code
- [Vite](https://vite.dev/) for development and production builds
- IndexedDB for local document persistence
- BroadcastChannel for cross-tab synchronization
- [Vitest](https://vitest.dev/) for automated tests
- [Docker](https://www.docker.com/) and Docker Compose for container deployment
- [Nginx](https://nginx.org/) for serving the production build

## Local development

Requirements:

- Node.js 22 or newer
- npm

Clone the repository and install its dependencies:

```bash
git clone https://github.com/shuhanmirza/notepad-web.git
cd notepad-web
npm ci
npm run dev
```

Vite will print the local development URL in the terminal.

Useful commands:

```bash
npm test       # Run the automated tests
npm run build  # Create a production build in dist/
npm run preview
```

## Docker development

The included Compose files can publish the container directly on a host port
for testing. Create the shared Docker network once, copy the development
configuration, and start the application:

```bash
docker network create nginx-proxy
cp .env.example .env
./compose.sh up -d --build
```

The default `.env` values are:

```env
PUBLISH_HOST_PORT=true
HOST_PORT=8001
```

The editor will be available at `http://localhost:8001`. Change `HOST_PORT` if
that port is already in use.

Stop the development container with:

```bash
./compose.sh down
```

## Production deployment with an Nginx reverse proxy

The included `docker-compose.yml` is an example deployment for a server using
an automated Nginx reverse proxy for Docker containers, such as
[nginx-proxy](https://github.com/nginx-proxy/nginx-proxy) with
[acme-companion](https://github.com/nginx-proxy/acme-companion) for TLS
certificates.

Before deploying:

1. Point the domain's DNS record to the server.
2. Install Docker and Docker Compose.
3. Run the Nginx reverse proxy and this application on the same Docker network.
4. Update `VIRTUAL_HOST`, `LETSENCRYPT_HOST`, and `LETSENCRYPT_EMAIL` in
   `docker-compose.yml` for the deployment.

Create the shared network if the reverse-proxy setup has not already created
it:

```bash
docker network create nginx-proxy
```

Create the production environment file and deploy:

```bash
cp .env.production.example .env.production
ENV_FILE=.env.production ./compose.sh up -d --build
```

The production setting is:

```env
PUBLISH_HOST_PORT=false
```

With this setting, Docker does not publish the application's port on the host.
The Nginx proxy reaches the application's internal port `8000` through the
shared `nginx-proxy` network.

Running the following command directly is also production-safe because the base
Compose file does not contain a `ports` entry:

```bash
docker compose up -d --build
```

Check the deployment with:

```bash
docker compose ps
docker compose logs --tail=100 notepad
```

## Project structure

```text
.
├── src/
│   ├── App.vue              Main editor interface and document actions
│   ├── config.ts            Shared project and browser-storage identifiers
│   ├── document.ts          Document creation, versioning, and text statistics
│   ├── favicon.ts           Theme-aware favicon rendering
│   ├── storage.ts           IndexedDB persistence
│   ├── sync.ts              Cross-tab updates and tab presence
│   ├── styles.css           Application layout and visual design
│   ├── main.ts              Vue application entry point
│   └── *.test.ts            Unit and storage tests
├── Dockerfile               Builds the Vue app and serves it with Nginx
├── nginx.conf               Production web-server configuration
├── docker-compose.yml       Production-safe reverse-proxy deployment
├── docker-compose.dev.yml   Optional development host-port binding
├── compose.sh               Selects Compose files from the env configuration
├── .env.example             Development configuration example
└── .env.production.example  Production configuration example
```

## Acknowledgment

[OpenAI Codex](https://openai.com/codex/) was used to help design, develop, and
test this website.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
