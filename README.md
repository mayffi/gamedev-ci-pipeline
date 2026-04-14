# gamedev-ci-pipeline

A CI/CD pipeline project built around a Node.js application, focused on build reliability, artifact versioning, dependency caching, and pipeline observability. The monitoring stack runs locally via Docker Compose and surfaces build metrics in Grafana.

This is not a deployment pipeline. The scope is deliberately contained to the build stage, which is where most of the interesting engineering problems live.

---

## Project Structure

```
.github/
  workflows/
    build.yaml          # GitHub Actions workflow
monitoring/             # Docker Compose stack: InfluxDB + Grafana
script/                 # Python script to pull GitHub Actions run data into InfluxDB
src/
  build.js              # Build script, outputs to src/dist/
  package.json
  package-lock.json
docker-compose.yml
README.md
```

---

## Pipeline

The workflow is triggered manually via `workflow_dispatch` and runs on `ubuntu-latest`. Steps execute in this order:

| Step | What it does |
|---|---|
| Checkout | Pulls the repo onto the runner via `actions/checkout@v4` |
| Cache dependencies | Restores `node_modules` from cache if `package-lock.json` is unchanged |
| Install dependencies | Runs `npm ci` for a clean, deterministic install |
| Build | Runs `node build.js`, writes output to `src/dist/` |
| Set build version | Resolves version from a git tag if present, falls back to commit SHA |
| Upload artifact | Uploads `src/dist/` as a versioned artifact via `actions/upload-artifact@v4` |

### Dependency Caching

Caching uses `actions/cache@v4` with the cache key based on a hash of `package-lock.json`:

```yaml
key: ${{ runner.os }}-node-${{ hashFiles('src/package-lock.json') }}
```

If `package-lock.json` has not changed, `node_modules` is restored from cache and npm skips re-downloading packages. If the file changes, the hash changes, the key misses, and a fresh install runs. Run time dropped from approximately X seconds to Y seconds on cache hit runs, visible on the Grafana dashboard.

> Note: Fill in X and Y after capturing your first set of dashboard metrics.

### Artifact Versioning

Each successful build produces a uniquely named artifact. The version is resolved at runtime:

```yaml
- name: Set build version
  run: |
    if git describe --tags --exact-match 2>/dev/null; then
      echo "BUILD_VERSION=$(git describe --tags --exact-match)" >> $GITHUB_ENV
    else
      echo "BUILD_VERSION=${{ github.sha }}" >> $GITHUB_ENV
    fi
```

If the current commit has a git tag the tag is used as the version, for example `game-build-v1.0.0`. If no tag exists the commit SHA is used instead, for example `game-build-a3f9c12`. This means every run produces a uniquely named artifact regardless of whether it is a formal release or a development build.

---

## Failure Scenarios

### Scenario 1: ENOENT - package.json not found

The Install dependencies step failed immediately on the first pipeline run with this error:

```
npm error code ENOENT
npm error path /home/runner/work/gamedev-ci-pipeline/gamedev-ci-pipeline/package.json
npm error enoent Could not read package.json
```

`package.json` lives inside `src/` but the runner executes commands from the repo root by default. The fix was adding `working-directory: src/` to both the Install dependencies and Build steps so commands run in the correct context.

### Scenario 2: MODULE_NOT_FOUND - missing dependency

The Build step failed after `npm ci` completed successfully:

```
Error: Cannot find module 'uuid'
Require stack:
- /home/runner/work/gamedev-ci-pipeline/gamedev-ci-pipeline/src/build.js
```

`uuid` was required in `build.js` but was not listed in `package.json`. Since `npm ci` installs only what is declared in `package-lock.json`, the module was never installed. The install step passed cleanly and the failure only surfaced at runtime. This is a common class of CI failure where a dependency works locally because it exists in a developer's global environment but is not declared in the project manifest.

The fix was running `npm install uuid` locally to add the dependency to `package.json` and regenerate `package-lock.json`, then committing the updated lockfile.

---

## Monitoring Stack

The observability layer runs locally via Docker Compose and consists of InfluxDB for storing time series pipeline metrics and Grafana for visualising them. A Python script in `script/` pulls run data from the GitHub Actions API and writes it to InfluxDB. The Grafana dashboard tracks build duration, cache hit and miss rate, and build status per run.

To start the stack:

```bash
docker compose up -d
```

Grafana is available at `http://localhost:3000`.

---

## What This Project Demonstrates

- GitHub Actions workflow structure and step composition
- Deterministic dependency installation with `npm ci`
- Cache invalidation strategy tied to lockfile hash
- Artifact versioning with tag and SHA fallback
- Diagnosing and documenting real pipeline failures with root cause analysis
- Pipeline observability with InfluxDB and Grafana