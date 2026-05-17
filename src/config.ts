import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-roast-or-toast",
  description: "Rotating hot seat 30s; rapid fire/rose reactions; cumulative leaderboard.",
  accentHex: "#ff3399",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
