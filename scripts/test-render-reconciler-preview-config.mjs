import { readFile } from "node:fs/promises";

const source=await readFile(new URL("./render-reconciler-preview-config.mjs",import.meta.url),"utf8");
for(const name of ["GOOGLE_CALENDAR_OAUTH_CLIENT_ID","CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION","CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION"]){if(!source.includes(`required("${name}")`))throw new Error(`${name} is not fail-closed`);}
for(const secret of ["GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET","CALENDAR_CREDENTIAL_AES_KEYRING_JSON","CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON"]){if(source.includes(secret))throw new Error(`${secret} must not be rendered into vars`);}
console.log("RECONCILER_GOOGLE_CALENDAR_PREVIEW_RENDER_CONTRACT_OK");
