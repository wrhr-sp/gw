import {
  inspectionRoutes,
  submitInspectionRequestSchema,
  transitionProcessExecutionRequestSchema,
  type AuthenticatedPrincipal,
  type CreateManualInspectionRequest,
  type SaveInspectionItemResultRequest,
} from "@werehere/contracts";
import type { InspectionApiRepository } from "@werehere/db";
import type { z } from "zod";
import { sha256 } from "../auth/crypto";

type MutationPrincipal = AuthenticatedPrincipal & { sessionToken: string };
type SubmitRequest = z.infer<typeof submitInspectionRequestSchema>;
type TransitionRequest = z.infer<
  typeof transitionProcessExecutionRequestSchema
>;

type InspectionServiceCode =
  | "DB_NOT_CONFIGURED"
  | "FORBIDDEN"
  | "IDEMPOTENCY_CONFLICT"
  | "INSPECTION_FINAL_LOCKED"
  | "INSPECTION_RESULT_EVIDENCE_REQUIRED"
  | "INTERNAL_ERROR"
  | "INVALID_STATE_TRANSITION"
  | "PROCESS_DEFAULT_REQUIRED"
  | "RESOURCE_NOT_FOUND"
  | "VERSION_CONFLICT";

export class InspectionServiceError extends Error {
  constructor(
    public readonly code: InspectionServiceCode,
    public readonly httpStatus: 403 | 404 | 409 | 422 | 500 | 503,
    public readonly retryable = false,
  ) {
    super(code);
  }
}

export interface InspectionService {
  close?(): Promise<void>;
  createManualInspection(
    principal: MutationPrincipal,
    hotelId: string,
    value: CreateManualInspectionRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  saveResult(
    principal: MutationPrincipal,
    hotelId: string,
    inspectionId: string,
    itemSnapshotId: string,
    value: SaveInspectionItemResultRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  submit(
    principal: MutationPrincipal,
    hotelId: string,
    inspectionId: string,
    value: SubmitRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  transition(
    principal: MutationPrincipal,
    hotelId: string,
    inspectionId: string,
    value: TransitionRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
}

async function hash(value: unknown): Promise<string> {
  const digest = await sha256(JSON.stringify(value));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function failure(status: string): never {
  const mapped: Partial<
    Record<string, [InspectionServiceCode, 403 | 404 | 409 | 422]>
  > = {
    FORBIDDEN: ["FORBIDDEN", 403],
    IDEMPOTENCY_CONFLICT: ["IDEMPOTENCY_CONFLICT", 409],
    INSPECTION_FINAL_LOCKED: ["INSPECTION_FINAL_LOCKED", 409],
    INSPECTION_RESULT_EVIDENCE_REQUIRED: [
      "INSPECTION_RESULT_EVIDENCE_REQUIRED",
      422,
    ],
    INVALID_STATE_TRANSITION: ["INVALID_STATE_TRANSITION", 409],
    NOT_FOUND: ["RESOURCE_NOT_FOUND", 404],
    PROCESS_DEFAULT_REQUIRED: ["PROCESS_DEFAULT_REQUIRED", 422],
    VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
  };
  const mappedFailure = mapped[status];
  if (mappedFailure)
    throw new InspectionServiceError(mappedFailure[0], mappedFailure[1]);
  throw new InspectionServiceError("INTERNAL_ERROR", 500);
}

export function createInspectionService(
  repository: InspectionApiRepository,
): InspectionService {
  async function mutateAndRead(input: {
    action: string;
    expectedVersion: number;
    hotelId: string;
    httpMethod: "POST" | "PUT";
    idempotencyKey: string;
    inspectionId: string;
    operationPath: string;
    principal: MutationPrincipal;
    value: unknown;
  }) {
    const result = await repository.command({
      action: input.action,
      auditEventId: crypto.randomUUID(),
      companyId: input.principal.companyId,
      expectedVersion: input.expectedVersion,
      hotelId: input.hotelId,
      httpMethod: input.httpMethod,
      idempotencyKey: input.idempotencyKey,
      idempotencyRecordId: crypto.randomUUID(),
      operationPath: input.operationPath,
      requestHash: await hash({
        method: input.httpMethod,
        path: input.operationPath,
        value: input.value,
      }),
      resourceId: input.inspectionId,
      sessionId: input.principal.sessionId,
      sessionToken: input.principal.sessionToken,
      traceId: crypto.randomUUID(),
      value: input.value,
    });
    if (!["CREATED", "UPDATED", "REPLAYED"].includes(result.status))
      failure(result.status);
    const resourceId =
      result.payload &&
      typeof result.payload === "object" &&
      "id" in result.payload &&
      typeof result.payload.id === "string"
        ? result.payload.id
        : input.inspectionId;
    const read = await repository.readInspection({
      companyId: input.principal.companyId,
      hotelId: input.hotelId,
      inspectionId: resourceId,
      sessionId: input.principal.sessionId,
      sessionToken: input.principal.sessionToken,
    });
    if (read.status !== "OK") failure(read.status);
    if (!read.payload) throw new InspectionServiceError("INTERNAL_ERROR", 500);
    return read.payload;
  }

  return {
    close: () => repository.close(),
    createManualInspection(principal, hotelId, value, idempotencyKey) {
      const inspectionId = crypto.randomUUID();
      return mutateAndRead({
        action: "CREATE_MANUAL",
        expectedVersion: 0,
        hotelId,
        httpMethod: "POST",
        idempotencyKey,
        inspectionId,
        operationPath: inspectionRoutes.createManual(hotelId),
        principal,
        value: {
          ...value,
          processExecutionId: crypto.randomUUID(),
          reason: "수시점검 생성",
        },
      });
    },
    saveResult(
      principal,
      hotelId,
      inspectionId,
      itemSnapshotId,
      value,
      idempotencyKey,
    ) {
      return mutateAndRead({
        action: "SAVE_RESULT",
        expectedVersion: value.version,
        hotelId,
        httpMethod: "PUT",
        idempotencyKey,
        inspectionId,
        operationPath: inspectionRoutes.result(
          hotelId,
          inspectionId,
          itemSnapshotId,
        ),
        principal,
        value: {
          ...value,
          historyId: crypto.randomUUID(),
          itemSnapshotId,
          resultId: crypto.randomUUID(),
        },
      });
    },
    submit(principal, hotelId, inspectionId, value, idempotencyKey) {
      return mutateAndRead({
        action: "SUBMIT",
        expectedVersion: value.version,
        hotelId,
        httpMethod: "POST",
        idempotencyKey,
        inspectionId,
        operationPath: inspectionRoutes.submit(hotelId, inspectionId),
        principal,
        value: { historyId: crypto.randomUUID(), reason: value.reason },
      });
    },
    transition(principal, hotelId, inspectionId, value, idempotencyKey) {
      return mutateAndRead({
        action: "TRANSITION",
        expectedVersion: value.version,
        hotelId,
        httpMethod: "POST",
        idempotencyKey,
        inspectionId,
        operationPath: inspectionRoutes.transition(hotelId, inspectionId),
        principal,
        value: { ...value, historyId: crypto.randomUUID() },
      });
    },
  };
}
