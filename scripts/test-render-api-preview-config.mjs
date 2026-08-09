import { readFile } from "node:fs/promises";

const source=await readFile(new URL("./render-api-preview-config.mjs",import.meta.url),"utf8");
for(const name of ["GOOGLE_CALENDAR_OAUTH_CLIENT_ID","GOOGLE_CALENDAR_OAUTH_REDIRECT_URI","CALENDAR_CREDENTIAL_AES_CURRENT_KEY_VERSION","CALENDAR_FINGERPRINT_HMAC_CURRENT_KEY_VERSION"]){if(!source.includes(`required("${name}")`))throw new Error(`${name} is not fail-closed`);}
for(const secret of ["GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET","CALENDAR_CREDENTIAL_AES_KEYRING_JSON","CALENDAR_FINGERPRINT_HMAC_KEYRING_JSON"]){if(source.includes(secret))throw new Error(`${secret} must not be rendered into vars`);}
if(!source.includes("/api/admin/calendar-connections/oauth/callback"))throw new Error("Google Calendar callback contract is missing");
console.log("API_GOOGLE_CALENDAR_PREVIEW_RENDER_CONTRACT_OK");
