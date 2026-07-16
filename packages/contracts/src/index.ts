import { z } from "zod";

export const hotelUserTypeSchema = z.enum([
  "INTERNAL_STAFF",
  "ROOM_OPERATIONS",
  "BRANCH_OWNER",
]);
export type HotelUserType = z.infer<typeof hotelUserTypeSchema>;

export const hotelStatusSchema = z.enum([
  "PREPARING",
  "ACTIVE",
  "SUSPENDED",
]);
export type HotelStatus = z.infer<typeof hotelStatusSchema>;

export const hotelErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "RESOURCE_NOT_FOUND",
  "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_STATE_TRANSITION",
  "DB_NOT_CONFIGURED",
  "SCHEMA_NOT_READY",
  "FILE_STORAGE_NOT_CONFIGURED",
  "INTERNAL_ERROR",
]);
export type HotelErrorCode = z.infer<typeof hotelErrorCodeSchema>;

const hotelPath = (hotelId: string) => `/api/hotels/${encodeURIComponent(hotelId)}` as const;

export const hotelRoutes = {
  list: "/api/hotels",
  create: "/api/hotels",
  detail: (hotelId: string) => hotelPath(hotelId),
  activate: (hotelId: string) => `${hotelPath(hotelId)}/activate` as const,
  suspend: (hotelId: string) => `${hotelPath(hotelId)}/suspend` as const,
  reactivate: (hotelId: string) => `${hotelPath(hotelId)}/reactivate` as const,
  staffAssignments: (hotelId: string) => `${hotelPath(hotelId)}/staff-assignments` as const,
  housekeepingLinks: (hotelId: string) => `${hotelPath(hotelId)}/housekeeping-links` as const,
  ownerTransfer: (hotelId: string) => `${hotelPath(hotelId)}/owner-transfer` as const,
  rooms: (hotelId: string) => `${hotelPath(hotelId)}/rooms` as const,
  inspections: (hotelId: string) => `${hotelPath(hotelId)}/inspections` as const,
  issues: (hotelId: string) => `${hotelPath(hotelId)}/issues` as const,
  dailySales: (hotelId: string) => `${hotelPath(hotelId)}/daily-sales` as const,
  inquiries: (hotelId: string) => `${hotelPath(hotelId)}/inquiries` as const,
  files: "/api/hotel-files",
  permissions: "/api/admin/hotel-permissions",
} as const;
