// Pre-load this with --require to:
// 1. Load .env.local so POSTGRES_URL / API keys are available before any imports execute
// 2. Stub server-only so Next.js server-only modules can be imported in plain tsx scripts
// Usage: pnpm tsx --require ./discussions/personal-os/testing/stub-server-only.cjs <script>
require("dotenv").config({ path: ".env.local" });

const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
  children: [],
  parent: null,
  paths: [],
};
