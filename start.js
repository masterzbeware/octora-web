import { execSync, spawn } from "child_process";
import fs from "fs";
import http from "http";
import path from "path";

/* ===================
   CONFIG
====================== */
const ROOT = "/home/container";
const APP_PORT = 3000;
const APP_START_TIMEOUT_MS = 60_000;

// Ambil dari environment variable, jangan hardcode di file
const GIT_TOKEN = process.env.GIT_TOKEN || "";
const CF_TUNNEL_TOKEN = process.env.CF_TUNNEL_TOKEN || "";

const OWNER = "masterzbeware";
const REPO = "octora-web";
const BRANCH = "main";
const GIT_URL = GIT_TOKEN
  ? `https://${GIT_TOKEN}@github.com/${OWNER}/${REPO}.git`
  : `https://github.com/${OWNER}/${REPO}.git`;

const LAST_COMMIT = path.join(ROOT, ".last_commit");
const LAST_PKG_HASH = path.join(ROOT, ".last_package_hash");
const BUILD_ID = path.join(ROOT, ".next/BUILD_ID");
const CLOUDFLARED_BIN = path.join(ROOT, "cloudflared");

/* ======================
   UTIL
====================== */
function sh(cmd, ignoreError = false) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
  } catch (error) {
    if (!ignoreError) throw error;
  }
}

function out(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function writeFileSafe(filePath, content) {
  fs.writeFileSync(filePath, `${content}\n`);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function hash(file) {
  const fullPath = path.join(ROOT, file);
  if (!fileExists(fullPath)) return "";
  return out(`md5sum "${fullPath}" | awk '{print $1}'`);
}

function ensureExecutable(filePath) {
  if (!fileExists(filePath)) {
    throw new Error(`File tidak ditemukan: ${filePath}`);
  }
  fs.chmodSync(filePath, 0o755);
}

function run(cmd, args, name, options = {}) {
  console.log(`[${name}] start`);

  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  child.on("spawn", () => {
    console.log(`[${name}] pid=${child.pid}`);
  });

  child.on("exit", (code, signal) => {
    console.log(`[${name}] exited code=${code} signal=${signal ?? "none"}`);
  });

  child.on("error", (err) => {
    console.error(`[${name}] error: ${err.message}`);
  });

  return child;
}

function waitPort(port, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let done = false;
    let timer = null;

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      fn(value);
    };

    const check = () => {
      if (done) return;

      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          method: "HEAD",
          timeout: 1000,
        },
        () => {
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          console.log(`[PORT] ${port} ready after ${elapsed}s`);
          finish(resolve, true);
        }
      );

      req.on("error", () => {
        if (done) return;

        if (Date.now() - start >= timeoutMs) {
          finish(
            reject,
            new Error(`Port ${port} tidak siap dalam ${timeoutMs / 1000} detik`)
          );
          return;
        }

        timer = setTimeout(check, 500);
      });

      req.on("timeout", () => {
        req.destroy();

        if (done) return;

        if (Date.now() - start >= timeoutMs) {
          finish(
            reject,
            new Error(`Port ${port} timeout dan tidak siap dalam ${timeoutMs / 1000} detik`)
          );
          return;
        }

        timer = setTimeout(check, 500);
      });

      req.end();
    };

    check();
  });
}

function validateConfig() {
  if (!CF_TUNNEL_TOKEN) {
    throw new Error("CF_TUNNEL_TOKEN belum diisi.");
  }
}

function ensureRequiredFiles() {
  const packageJson = path.join(ROOT, "package.json");

  if (!fileExists(packageJson)) {
    throw new Error("package.json tidak ditemukan.");
  }

  if (!fileExists(CLOUDFLARED_BIN)) {
    throw new Error("Binary cloudflared tidak ditemukan di /home/container/cloudflared.");
  }
}

function setupGitRepo() {
  if (!fileExists(path.join(ROOT, ".git"))) {
    console.log("[GIT] init repo");
    sh("git init");
  }

  const originUrl = out("git remote get-url origin");

  if (!originUrl) {
    console.log("[GIT] add origin");
    sh(`git remote add origin ${GIT_URL}`);
  } else if (originUrl !== GIT_URL) {
    console.log("[GIT] set origin");
    sh(`git remote set-url origin ${GIT_URL}`);
  }

  console.log("[GIT] fetch");
  sh(`git fetch origin ${BRANCH}`);
  sh(`git reset --hard origin/${BRANCH}`);
}

function installDependenciesIfNeeded() {
  const pkgHash = hash("package.json");
  const lastPkgHash = readFileSafe(LAST_PKG_HASH);
  const nodeModulesExists = fileExists(path.join(ROOT, "node_modules"));

  if (!nodeModulesExists || !pkgHash || pkgHash !== lastPkgHash) {
    console.log("[NPM] install");
    sh("npm install");
    if (pkgHash) writeFileSafe(LAST_PKG_HASH, pkgHash);
  } else {
    console.log("[NPM] skip");
  }
}

function buildIfNeeded(currentCommit) {
  const lastCommit = readFileSafe(LAST_COMMIT);
  const buildExists = fileExists(BUILD_ID);

  if (!buildExists || currentCommit !== lastCommit) {
    console.log("[BUILD] run");
    sh("rm -rf .next", true);
    sh("npm run build", true);
    writeFileSafe(LAST_COMMIT, currentCommit);
  } else {
    console.log("[BUILD] skip");
  }
}

/* ======================
   MAIN
====================== */
(async () => {
  let appProcess = null;
  let tunnelProcess = null;

  try {
    console.log("=== DEPLOY START ===");

    validateConfig();
    ensureRequiredFiles();
    ensureExecutable(CLOUDFLARED_BIN);

    sh("killall node 2>/dev/null", true);
    sh("rm -f .git/index.lock", true);

    setupGitRepo();

    const currentCommit = out("git rev-parse HEAD");
    if (!currentCommit) {
      throw new Error("Gagal membaca commit HEAD dari repository.");
    }

    installDependenciesIfNeeded();
    buildIfNeeded(currentCommit);

    console.log("=== START APPLICATION ===");
    appProcess = run("npm", ["run", "start"], "APP");

    await waitPort(APP_PORT, APP_START_TIMEOUT_MS);

    console.log("=== START TUNNEL ===");
    tunnelProcess = run(
      CLOUDFLARED_BIN,
      ["tunnel", "run", "--token", CF_TUNNEL_TOKEN],
      "CLOUDFLARED"
    );

    console.log("=== APP & TUNNEL RUNNING ===");

    const shutdown = (signal) => {
      console.log(`=== SHUTDOWN ${signal} ===`);

      if (tunnelProcess && !tunnelProcess.killed) {
        tunnelProcess.kill("SIGTERM");
      }

      if (appProcess && !appProcess.killed) {
        appProcess.kill("SIGTERM");
      }

      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("=== FATAL ERROR ===");
    console.error(error?.message || error);

    if (tunnelProcess && !tunnelProcess.killed) {
      tunnelProcess.kill("SIGTERM");
    }

    if (appProcess && !appProcess.killed) {
      appProcess.kill("SIGTERM");
    }

    process.exit(1);
  }
})();