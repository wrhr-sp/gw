import { verifyZitadelBootstrapIdentity } from "../src/zitadel-bootstrap-verifier";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("ZITADEL bootstrap identity verification failed");
  return value;
};

try {
  await verifyZitadelBootstrapIdentity({
    approvedSubjectFingerprint: required("ZITADEL_PREVIEW_SUBJECT_SHA256"),
    issuer: required("ZITADEL_ISSUER"),
    organizationId: required("ZITADEL_ORGANIZATION_ID"),
    subject: required("ZITADEL_PREVIEW_SUBJECT"),
    token: required("ZITADEL_USER_PROVISIONER_TOKEN"),
  });
  process.stdout.write("ZITADEL_BOOTSTRAP_IDENTITY_VERIFIED\n");
} catch {
  process.stderr.write("ZITADEL bootstrap identity verification failed\n");
  process.exitCode = 1;
}
