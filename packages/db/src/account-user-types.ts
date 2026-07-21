import type { HotelUserType } from "@werehere/contracts";

export type StoredHotelUserType =
  | HotelUserType
  | "ROOM_OPERATIONS"
  | "BRANCH_OWNER";

export function normalizeStoredHotelUserType(value: string): HotelUserType {
  switch (value) {
    case "INTERNAL_STAFF":
      return "INTERNAL_STAFF";
    case "ROOM_OPERATIONS":
    case "HOUSEKEEPING":
      return "HOUSEKEEPING";
    case "BRANCH_OWNER":
    case "HOTEL_OWNER":
      return "HOTEL_OWNER";
    default:
      throw new Error("Unsupported stored hotel user type");
  }
}

export function toExpandCompatibleStoredUserType(
  value: HotelUserType,
): StoredHotelUserType {
  switch (value) {
    case "INTERNAL_STAFF":
      return "INTERNAL_STAFF";
    case "HOUSEKEEPING":
      return "ROOM_OPERATIONS";
    case "HOTEL_OWNER":
      return "BRANCH_OWNER";
  }
}
