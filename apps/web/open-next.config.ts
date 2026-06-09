import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Phase 1 skeleton keeps incremental cache off so local build/preview work
  // without provisioning R2 yet.
});
