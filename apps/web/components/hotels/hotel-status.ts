import type { HotelBasicInformation } from "@werehere/contracts";

export const hotelStatusPresentation: Record<
  HotelBasicInformation["status"],
  { label: string; tone: "info" | "success" | "warning" }
> = {
  PREPARING: { label: "준비중", tone: "info" },
  ACTIVE: { label: "운영중", tone: "success" },
  SUSPENDED: { label: "운영중지", tone: "warning" },
};
