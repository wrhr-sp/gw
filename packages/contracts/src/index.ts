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
  "AUTH_FLOW_INVALID",
  "AUTH_RATE_LIMITED",
  "AUTH_PROVIDER_NOT_CONFIGURED",
  "AUTH_PROVIDER_UNAVAILABLE",
  "IDENTITY_NOT_PROVISIONED",
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

export const authRoutes = {
  login: "/api/auth/login",
  callback: "/api/auth/callback",
  logout: "/api/auth/logout",
  session: "/api/auth/session",
} as const;

export const authenticatedPrincipalSchema = z.object({
  companyId: z.uuid(),
  identityId: z.uuid(),
  sessionId: z.uuid(),
  userId: z.uuid(),
  userType: hotelUserTypeSchema,
  displayName: z.string().trim().min(1),
}).strict();
export type AuthenticatedPrincipal = z.infer<typeof authenticatedPrincipalSchema>;

export const authSessionResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    authenticated: z.literal(true),
    principal: authenticatedPrincipalSchema,
  }).strict(),
  error: z.null(),
}).strict();

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
