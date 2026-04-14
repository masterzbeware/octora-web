const { execSync, spawn } = require("child_process");
const fs = require("fs");
const http = require("http");

const ROOT = "/home/container";
const APP_PORT = Number(process.env.APP_PORT || 3000);

const OWNER = process.env.GIT_OWNER || "masterzbeware";
const REPO = process.env.GIT_REPO || "octora-web";
const BRANCH = process.env.GIT_BRANCH || "main";

const GIT_TOKEN = process.env.GIT_TOKEN || "";
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN || "eyJhIjoiZGNlZThhYzVhZTM0YmYzNzkxNThjOWQ3ZTExMWRjMGYiLCJ0IjoiZjZkN2U4MTAtNzg4Ny00MDZjLWFkM2YtYmE3ZDQ4YzRjZGY3IiwicyI6Ik1UZGhOekprTlRNdFl6TmlNeTAwTTJVMkxXSXpOak10WTJRME9UZGpZelUzT1dWaiJ9";

const GIT_URL = GIT_TOKEN
  ? `https://${GIT_TOKEN}@github.com/${OWNER}/${REPO}.git`
  : `https://github.com/${OWNER}/${REPO}.git`;

const LAST_COMMIT = `${ROOT}/.last_commit`;
const LAST_PKG_HASH = `${ROOT}/.last_package_hash`;
const BUILD_ID = `${ROOT}/.next/BUILD_ID`;

function sh(cmd, ignoreError = false) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
  } catch (e) {
    if (!ignoreError) throw e;
  }
}

function out(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function hash(file) {
  try {
    return out(`md5sum ${file} | awk '{print $1}'`);
  } catch {
    return "";
  }
}

function run(cmd, args, name) {
  console.log(`[${name}] start`);

  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
  });

  child.on("error", (err) => {
    console.error(`[${name}] error: ${err.message}`);
  });

  child.on("exit", (code, signal) => {
    console.log(`[${name}] exited with code=${code} signal=${signal}`);
  });

  return child;
}

function waitPort(port) {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          method: "HEAD",
          timeout: 500,
        },
        () => {
          const t = ((Date.now() - start) / 1000).toFixed(1);
          console.log(`[PORT] ${port} ready after ${t}s`);
          resolve(true);
        }
      );

      req.on("error", () => setTimeout(check, 500));
      req.on("timeout", () => {
        req.destroy();
        setTimeout(check, 500);
      });

      req.end();
    };

    check();
  });
}

function ensureEnv() {
  if (!TUNNEL_TOKEN) {
    throw new Error("TUNNEL_TOKEN belum diisi di environment variable/server startup.");
  }
}

(async () => {
  try {
    console.log("=== DEPLOY START ===");

    ensureEnv();

    sh("killall node 2>/dev/null", true);
    sh("rm -f .git/index.lock", true);

    if (!fs.existsSync(`${ROOT}/.git`)) {
      console.log("[GIT] init repo");
      sh("git init");
      sh(`git remote add origin ${GIT_URL}`);
      sh(`git fetch origin ${BRANCH}`);
      sh(`git reset --hard origin/${BRANCH}`);
    } else {
      console.log("[GIT] update");

      const currentRemote = out("git remote get-url origin");
      if (currentRemote !== GIT_URL) {
        console.log("[GIT] update remote origin");
        sh(`git remote set-url origin ${GIT_URL}`);
      }

      sh("git fetch origin");
      sh(`git reset --hard origin/${BRANCH}`);
    }

    const currentCommit = out("git rev-parse HEAD");
    const lastCommit = fs.existsSync(LAST_COMMIT)
      ? fs.readFileSync(LAST_COMMIT, "utf8")
      : "";

    const pkgHash = hash("package.json");
    const lastPkgHash = fs.existsSync(LAST_PKG_HASH)
      ? fs.readFileSync(LAST_PKG_HASH, "utf8")
      : "";

    if (!fs.existsSync(`${ROOT}/node_modules`) || pkgHash !== lastPkgHash) {
      console.log("[NPM] install");
      sh("npm install");
      fs.writeFileSync(LAST_PKG_HASH, pkgHash);
    } else {
      console.log("[NPM] skip");
    }

    if (!fs.existsSync(BUILD_ID) || currentCommit !== lastCommit) {
      console.log("[BUILD] run");
      sh("rm -rf .next", true);
      sh("npm run build");
      fs.writeFileSync(LAST_COMMIT, currentCommit);
    } else {
      console.log("[BUILD] skip");
    }

    console.log("=== START APPLICATION ===");
    run("npm", ["run", "start"], "APP");

    await waitPort(APP_PORT);

    run(
      "./cloudflared",
      ["tunnel", "run", "--token", TUNNEL_TOKEN],
      "CLOUDFLARED"
    );

    console.log("=== APP & TUNNEL RUNNING ===");
  } catch (err) {
    console.error("[FATAL]", err.message);
    process.exit(1);
  }
})();