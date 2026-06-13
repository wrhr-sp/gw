import { mobileShellDescriptor, mobileTabs } from "./src/index";

const config = {
  expo: {
    name: "GW Mobile Skeleton",
    slug: "gw-mobile-skeleton",
    scheme: "gwmobile",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    platforms: ["ios", "android"],
    assetBundlePatterns: ["**/*"],
    experiments: {
      tsconfigPaths: true,
    },
    extra: {
      phase: "19-native-mobile-internal-pilot-draft",
      appDirectory: "apps/mobile",
      primaryTabs: mobileTabs.map((tab) => tab.id),
      sameOriginPolicy: mobileShellDescriptor.apiPolicyLabel,
      sessionBridgePolicy: mobileShellDescriptor.sessionPolicyLabel,
      internalPilotLaneIds: mobileShellDescriptor.internalPilotLanes.map((lane) => lane.id),
      smokeChecklistStepIds: mobileShellDescriptor.internalPilotSmokeChecklist.map((item) => item.id),
      releaseGate: "App Store / Play Console / TestFlight / EAS / push / device-permission approval required",
    },
  },
} as const;

export default config;
