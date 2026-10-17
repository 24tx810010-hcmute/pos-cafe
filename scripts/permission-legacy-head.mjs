import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const LEGACY_PERMISSION_HEAD = "ef2c372aec60d8362549e47b7aedb27126129479";

const digest = value => createHash("sha256").update(value).digest("hex");
const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function assertInside(parent, target) {
  const path = relative(parent, target);
  if (!path || path === ".." || path.startsWith(`..${sep}`) || resolve(parent, path) !== target) {
    throw new Error("UNSAFE_LEGACY_ARTIFACT_PATH");
  }
}

function treeDigest(directory) {
  const hash = createHash("sha256");
  const visit = current => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        hash.update(relative(directory, path).replaceAll("\\", "/"));
        hash.update("\0");
        hash.update(readFileSync(path));
        hash.update("\0");
      }
    }
  };
  visit(directory);
  return hash.digest("hex");
}

function environmentBinding() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("LEGACY_BUILD_SUPABASE_ENV_REQUIRED");
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) throw new Error("NONLOCAL_LEGACY_BUILD_REFUSED");
  return digest(JSON.stringify({ origin: parsed.origin, anonKey }));
}

export function legacyArtifactPaths(root = process.cwd(), ref = LEGACY_PERMISSION_HEAD) {
  if (!/^[0-9a-f]{40}$/.test(ref)) throw new Error("INVALID_LEGACY_HEAD");
  root = resolve(root);
  const artifacts = resolve(root, "artifacts", "permission-legacy-head");
  const target = resolve(artifacts, ref);
  assertInside(artifacts, target);
  return { root, artifacts, target, source: join(target, "source"), archive: join(target, "source.tar"), report: join(target, "manifest.json") };
}

export function prepareLegacyArtifact(root = process.cwd(), ref = LEGACY_PERMISSION_HEAD) {
  const paths = legacyArtifactPaths(root, ref);
  const resolved = git(paths.root, ["rev-parse", `${ref}^{commit}`]);
  if (resolved !== ref) throw new Error("LEGACY_HEAD_MISMATCH");
  const tree = git(paths.root, ["rev-parse", `${ref}^{tree}`]);
  const envBinding = environmentBinding();
  const archivedLock = execFileSync("git", ["show", `${ref}:package-lock.json`], { cwd: paths.root });
  const workspaceLock = readFileSync(resolve(paths.root, "package-lock.json"));
  const packageLockSha256 = digest(archivedLock);
  // Git emits the committed blob with LF while the Windows checkout uses
  // CRLF. Compare the dependency content after only that checkout transform.
  const workspaceLockGitBytes = Buffer.from(workspaceLock.toString("utf8").replaceAll("\r\n", "\n"));
  if (digest(workspaceLockGitBytes) !== packageLockSha256) throw new Error("LEGACY_DEPENDENCY_LOCK_MISMATCH");

  if (existsSync(paths.report)) {
    const report = JSON.parse(readFileSync(paths.report, "utf8"));
    if (report.legacyHead === ref && report.tree === tree && report.environmentBinding === envBinding
      && report.packageLockSha256 === packageLockSha256
      && existsSync(paths.archive) && report.archiveSha256 === digest(readFileSync(paths.archive))
      && existsSync(join(paths.source, "dist", "index.html")) && report.distSha256 === treeDigest(join(paths.source, "dist"))) return report;
  }

  mkdirSync(paths.artifacts, { recursive: true });
  if (existsSync(paths.target)) {
    assertInside(paths.artifacts, paths.target);
    rmSync(paths.target, { recursive: true, force: true });
  }
  mkdirSync(paths.source, { recursive: true });
  execFileSync("git", ["archive", "--format=tar", `--output=${paths.archive}`, ref], { cwd: paths.root, stdio: "inherit" });
  execFileSync("tar", ["-xf", paths.archive, "-C", paths.source], { cwd: paths.root, stdio: "inherit" });

  // The artifact is nested below the repository, so normal Node resolution
  // reaches the workspace node_modules without copying or linking dependencies
  // into the archived source tree.
  if (!existsSync(resolve(paths.root, "node_modules"))) throw new Error("WORKSPACE_DEPENDENCIES_REQUIRED");
  mkdirSync(join(paths.source, "node_modules", ".cache"), { recursive: true });

  execFileSync(process.execPath, [resolve(paths.root, "node_modules", "typescript", "bin", "tsc"), "-b"], {
    cwd: paths.source, env: process.env, stdio: "inherit",
  });
  execFileSync(process.execPath, [resolve(paths.root, "node_modules", "vite", "bin", "vite.js"), "build"], {
    cwd: paths.source, env: process.env, stdio: "inherit",
  });

  const report = {
    schemaVersion: 1,
    legacyHead: ref,
    tree,
    archiveFormat: "git-archive-tar",
    archiveSha256: digest(readFileSync(paths.archive)),
    packageLockSha256,
    environmentBinding: envBinding,
    distSha256: treeDigest(join(paths.source, "dist")),
    node: process.version,
  };
  writeFileSync(paths.report, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function serve() {
  const paths = legacyArtifactPaths();
  const report = prepareLegacyArtifact(paths.root, LEGACY_PERMISSION_HEAD);
  process.stdout.write(`${JSON.stringify({ status: "LEGACY_ARTIFACT_READY", ...report })}\n`);
  const host = process.env.PERMISSION_LEGACY_HOST ?? "127.0.0.1";
  const port = process.env.PERMISSION_LEGACY_PORT ?? "5179";
  const child = spawn(process.execPath, [resolve(paths.root, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", host, "--port", port, "--strictPort"], {
    cwd: paths.source, env: process.env, stdio: "inherit",
  });
  const stop = signal => { if (!child.killed) child.kill(signal); };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", value => resolveExit(value ?? 1));
  });
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] !== "serve" || process.argv.length !== 3) {
    process.stderr.write("USAGE: node scripts/permission-legacy-head.mjs serve\n");
    process.exitCode = 1;
  } else {
    serve().catch(error => {
      process.stderr.write(`${error instanceof Error ? error.message : "LEGACY_ARTIFACT_FAILED"}\n`);
      process.exitCode = 1;
    });
  }
}
