import {
  inspectionReviewSchema,
  inspectionRoutes,
  processRoutes,
  submitInspectionRequestSchema,
  transitionProcessExecutionRequestSchema,
  type AuthenticatedPrincipal,
  type CreateInspectionChecklistRevisionRequest,
  type CreateInspectionChecklistRevisionV2Request,
  type CreateInspectionRoutineRequest,
  type CreateInspectionRoutineV2Request,
  type CreateManualInspectionRequest,
  type CreateManualInspectionV2Request,
  type CreateProcessDefinitionRequest,
  type InspectionExecutionListQuery,
  type InspectionReviewListQuery,
  type SaveInspectionItemResultRequest,
  type SetDefaultProcessRequest,
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
  | "INSPECTION_CHECKLIST_EMPTY"
  | "INTERNAL_ERROR"
  | "INVALID_STATE_TRANSITION"
  | "PROCESS_DEFAULT_REQUIRED"
  | "PROCESS_ASSIGNEE_INVALID"
  | "PROCESS_GRAPH_INVALID"
  | "RESOURCE_NOT_FOUND"
  | "VALIDATION_ERROR"
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
  listProcessDefinitions(
    principal: MutationPrincipal,
    hotelId: string | null,
  ): Promise<unknown[]>;
  listProcessReviewerCandidates(
    principal: MutationPrincipal,
    hotelId: string,
  ): Promise<unknown[]>;
  getDefaultProcess(
    principal: MutationPrincipal,
    hotelId: string,
  ): Promise<unknown | null>;
  saveProcessDefinition(
    principal: MutationPrincipal,
    definitionId: string | null,
    value: CreateProcessDefinitionRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  setDefaultProcess(
    principal: MutationPrincipal,
    hotelId: string,
    value: SetDefaultProcessRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  getChecklist(
    principal: MutationPrincipal,
    hotelId: string,
  ): Promise<unknown | null>;
  saveChecklist(
    principal: MutationPrincipal,
    hotelId: string,
    value: CreateInspectionChecklistRevisionRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  getChecklistV2(
    principal: MutationPrincipal,
    hotelId: string,
  ): Promise<unknown | null>;
  saveChecklistV2(
    principal: MutationPrincipal,
    hotelId: string,
    value: CreateInspectionChecklistRevisionV2Request,
    idempotencyKey: string,
  ): Promise<unknown>;
  listRoutines(
    principal: MutationPrincipal,
    hotelId: string,
  ): Promise<unknown[]>;
  getRoutine(
    principal: MutationPrincipal,
    hotelId: string,
    routineId: string,
  ): Promise<unknown>;
  saveRoutine(
    principal: MutationPrincipal,
    hotelId: string,
    routineId: string | null,
    value: CreateInspectionRoutineRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  listRoutinesV2(
    principal: MutationPrincipal,
    hotelId: string,
  ): Promise<unknown[]>;
  getRoutineV2(
    principal: MutationPrincipal,
    hotelId: string,
    routineId: string,
  ): Promise<unknown>;
  saveRoutineV2(
    principal: MutationPrincipal,
    hotelId: string,
    routineId: string | null,
    value: CreateInspectionRoutineV2Request,
    idempotencyKey: string,
  ): Promise<unknown>;
  listInspections(
    principal: MutationPrincipal,
    hotelId: string,
    query: InspectionExecutionListQuery,
  ): Promise<unknown>;
  getInspection(
    principal: MutationPrincipal,
    hotelId: string,
    inspectionId: string,
  ): Promise<unknown>;
  listInspectionsV2(
    principal: MutationPrincipal,
    hotelId: string,
    query: InspectionExecutionListQuery,
  ): Promise<unknown>;
  getInspectionV2(
    principal: MutationPrincipal,
    hotelId: string,
    inspectionId: string,
  ): Promise<unknown>;
  listReviews(
    principal: MutationPrincipal,
    hotelId: string,
    query: InspectionReviewListQuery,
  ): Promise<unknown>;
  getReview(
    principal: MutationPrincipal,
    hotelId: string,
    inspectionId: string,
  ): Promise<unknown>;
  createManualInspection(
    principal: MutationPrincipal,
    hotelId: string,
    value: CreateManualInspectionRequest,
    idempotencyKey: string,
  ): Promise<unknown>;
  createManualInspectionV2(
    principal: MutationPrincipal,
    hotelId: string,
    value: CreateManualInspectionV2Request,
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
  saveResultV2(
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
  submitV2(
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
    INSPECTION_CHECKLIST_EMPTY: ["INSPECTION_CHECKLIST_EMPTY", 422],
    INSPECTION_ROUTINE_VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
    INVALID_STATE_TRANSITION: ["INVALID_STATE_TRANSITION", 409],
    INVALID_TARGET: ["VALIDATION_ERROR", 422],
    NOT_FOUND: ["RESOURCE_NOT_FOUND", 404],
    PROCESS_DEFAULT_REQUIRED: ["PROCESS_DEFAULT_REQUIRED", 422],
    PROCESS_ASSIGNEE_INVALID: ["PROCESS_ASSIGNEE_INVALID", 422],
    PROCESS_GRAPH_INVALID: ["PROCESS_GRAPH_INVALID", 422],
    PROCESS_VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
    VERSION_CONFLICT: ["VERSION_CONFLICT", 409],
  };
  const mappedFailure = mapped[status];
  if (mappedFailure)
    throw new InspectionServiceError(mappedFailure[0], mappedFailure[1]);
  throw new InspectionServiceError("INTERNAL_ERROR", 500);
}

function savedResultMatches(
  snapshot: unknown,
  itemSnapshotId: string,
  expected: SaveInspectionItemResultRequest,
) {
  if (!snapshot || typeof snapshot !== "object" || !("items" in snapshot))
    return false;
  const items = snapshot.items;
  if (!Array.isArray(items)) return false;
  const item = items.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      candidate.id === itemSnapshotId,
  );
  if (!item || typeof item !== "object" || !("result" in item)) return false;
  const result = item.result;
  if (!result || typeof result !== "object") return false;
  const files = "fileVersionIds" in result ? result.fileVersionIds : null;
  return (
    "version" in result &&
    result.version === expected.version + 1 &&
    "result" in result &&
    result.result === expected.result &&
    "description" in result &&
    result.description === expected.description &&
    "severity" in result &&
    result.severity === expected.severity &&
    Array.isArray(files) &&
    files.length === expected.fileVersionIds.length &&
    files.every((file, index) => file === expected.fileVersionIds[index])
  );
}

function isUndefinedDatabaseFunction(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42883"
  );
}

function adaptLegacyChecklistToV2(checklist: unknown): unknown | null {
  if (!checklist || typeof checklist !== "object") return null;
  const value = checklist as Record<string, unknown>;
  if (!Array.isArray(value.items)) return null;
  return {
    ...value,
    items: value.items.map((candidate) => {
      const item = candidate as Record<string, unknown>;
      return {
        itemId: item.itemId,
        targetType: "ROOM",
        source:
          item.source === "ROOM_TYPE_ADDED"
            ? "TARGET_TYPE_ADDED"
            : "HOTEL_COMMON",
        roomTypeId: item.roomTypeId ?? null,
        excludedRoomTypeIds: Array.isArray(item.excludedRoomTypeIds)
          ? item.excludedRoomTypeIds
          : [],
        name: item.name,
        description: item.description ?? null,
        isRequired: item.isRequired,
        displayOrder: item.displayOrder,
        defaultSeverity: item.defaultSeverity,
      };
    }),
  };
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
    requestValue: unknown;
    resultExpectation?: {
      itemSnapshotId: string;
      value: SaveInspectionItemResultRequest;
    };
    useV2?: boolean;
    value: unknown;
  }) {
    const mutation = input.useV2 ? repository.commandV3 : repository.command;
    if (!mutation)
      throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
    const result = await mutation({
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
        value: input.requestValue,
      }),
      resourceId: input.inspectionId,
      sessionId: input.principal.sessionId,
      sessionToken: input.principal.sessionToken,
      traceId: crypto.randomUUID(),
      value: input.value,
    });
    if (!["CREATED", "UPDATED", "REPLAYED"].includes(result.status))
      failure(result.status);
    if (
      input.resultExpectation &&
      !savedResultMatches(
        result.payload,
        input.resultExpectation.itemSnapshotId,
        input.resultExpectation.value,
      )
    )
      throw new InspectionServiceError("VERSION_CONFLICT", 409);
    const resourceId =
      result.payload &&
      typeof result.payload === "object" &&
      "id" in result.payload &&
      typeof result.payload.id === "string"
        ? result.payload.id
        : input.inspectionId;
    const readInspection = input.useV2
      ? repository.readInspectionV2
      : repository.readInspection;
    if (!readInspection)
      throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
    const read = await readInspection({
      companyId: input.principal.companyId,
      hotelId: input.hotelId,
      inspectionId: resourceId,
      sessionId: input.principal.sessionId,
      sessionToken: input.principal.sessionToken,
    });
    if (read.status !== "OK") failure(read.status);
    if (
      !read.payload ||
      typeof read.payload !== "object" ||
      !("inspection" in read.payload)
    )
      throw new InspectionServiceError("INTERNAL_ERROR", 500);
    const inspection = read.payload.inspection;
    if (
      input.resultExpectation &&
      !savedResultMatches(
        inspection,
        input.resultExpectation.itemSnapshotId,
        input.resultExpectation.value,
      )
    )
      throw new InspectionServiceError("VERSION_CONFLICT", 409);
    return inspection;
  }

  async function readReview(input: {
    hotelId: string;
    inspectionId: string | null;
    principal: MutationPrincipal;
    query: unknown;
  }) {
    const readInspectionReview = repository.readInspectionReview;
    if (!readInspectionReview)
      throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
    const result = await readInspectionReview({
      companyId: input.principal.companyId,
      hotelId: input.hotelId,
      inspectionId: input.inspectionId,
      query: input.query,
      sessionId: input.principal.sessionId,
      sessionToken: input.principal.sessionToken,
    });
    if (result.status !== "OK") failure(result.status);
    if (!result.payload || typeof result.payload !== "object")
      throw new InspectionServiceError("INTERNAL_ERROR", 500);
    return result.payload;
  }

  return {
    close: () => repository.close(),
    async listProcessDefinitions(principal, hotelId) {
      const processCommand = repository.processCommand;
      if (!processCommand)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await processCommand({
        action: "LIST_DEFINITIONS",
        companyId: principal.companyId,
        hotelId,
        resourceId: null,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        value: {},
      });
      if (result.status !== "OK") failure(result.status);
      if (
        !result.payload ||
        typeof result.payload !== "object" ||
        !("definitions" in result.payload) ||
        !Array.isArray(result.payload.definitions)
      )
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload.definitions;
    },
    async listProcessReviewerCandidates(principal, hotelId) {
      const processReviewerCandidates = repository.processReviewerCandidates;
      if (!processReviewerCandidates)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await processReviewerCandidates({
        companyId: principal.companyId,
        hotelId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (
        !result.payload ||
        typeof result.payload !== "object" ||
        !("candidates" in result.payload) ||
        !Array.isArray(result.payload.candidates)
      )
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload.candidates;
    },
    async getDefaultProcess(principal, hotelId) {
      const processDefaultRead = repository.processDefaultRead;
      if (!processDefaultRead)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await processDefaultRead({
        companyId: principal.companyId,
        hotelId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      return result.payload;
    },
    async saveProcessDefinition(
      principal,
      definitionId,
      value,
      idempotencyKey,
    ) {
      const processMutation = repository.processMutation;
      if (!processMutation)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const resourceId = definitionId ?? crypto.randomUUID();
      const operationPath = definitionId
        ? processRoutes.definition(definitionId)
        : processRoutes.definitions;
      const httpMethod = definitionId ? "PUT" : "POST";
      const commandValue = {
        ...value,
        revisionId: crypto.randomUUID(),
        stages: value.stages.map((stage) => ({
          ...stage,
          id: crypto.randomUUID(),
        })),
        transitions: value.transitions.map((transition) => ({
          ...transition,
          id: crypto.randomUUID(),
        })),
      };
      const result = await processMutation({
        action: "SAVE_DEFINITION",
        auditEventId: crypto.randomUUID(),
        companyId: principal.companyId,
        expectedVersion: value.version,
        hotelId: value.scope === "HOTEL" ? value.hotelId : null,
        httpMethod,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath,
        requestHash: await hash({
          method: httpMethod,
          path: operationPath,
          value,
        }),
        resourceId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        traceId: crypto.randomUUID(),
        value: commandValue,
      });
      if (!["CREATED", "UPDATED", "REPLAYED"].includes(result.status))
        failure(result.status);
      if (!result.payload)
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload;
    },
    async setDefaultProcess(principal, hotelId, value, idempotencyKey) {
      const processMutation = repository.processMutation;
      if (!processMutation)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const operationPath = processRoutes.hotelDefault(hotelId);
      const result = await processMutation({
        action: "SET_DEFAULT",
        auditEventId: crypto.randomUUID(),
        companyId: principal.companyId,
        expectedVersion: value.version,
        hotelId,
        httpMethod: "PUT",
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath,
        requestHash: await hash({ method: "PUT", path: operationPath, value }),
        resourceId: value.processDefinitionId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        traceId: crypto.randomUUID(),
        value,
      });
      if (!["UPDATED", "REPLAYED"].includes(result.status))
        failure(result.status);
      const canonical = await this.getDefaultProcess(principal, hotelId);
      if (
        !canonical ||
        typeof canonical !== "object" ||
        !("definition" in canonical) ||
        !canonical.definition ||
        typeof canonical.definition !== "object" ||
        !("id" in canonical.definition) ||
        canonical.definition.id !== value.processDefinitionId
      )
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return canonical;
    },
    async getChecklist(principal, hotelId) {
      const inspectionQuery = repository.inspectionQuery;
      if (!inspectionQuery)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await inspectionQuery({
        action: "READ_CHECKLIST",
        companyId: principal.companyId,
        hotelId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      return result.payload;
    },
    async saveChecklist(principal, hotelId, value, idempotencyKey) {
      const operationPath = inspectionRoutes.checklist(hotelId);
      const revisionId = crypto.randomUUID();
      const commandValue = {
        ...value,
        revisionId,
        items: value.items.map((item) => ({
          ...item,
          itemId: item.itemId ?? crypto.randomUUID(),
        })),
      };
      const result = await repository.command({
        action: "SAVE_CHECKLIST",
        auditEventId: crypto.randomUUID(),
        companyId: principal.companyId,
        expectedVersion: value.version,
        hotelId,
        httpMethod: "PUT",
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath,
        requestHash: await hash({ method: "PUT", path: operationPath, value }),
        resourceId: revisionId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        traceId: crypto.randomUUID(),
        value: commandValue,
      });
      if (!["CREATED", "UPDATED", "REPLAYED"].includes(result.status))
        failure(result.status);
      if (!result.payload)
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload;
    },
    async getChecklistV2(principal, hotelId) {
      const inspectionQuery = repository.inspectionQuery;
      if (!inspectionQuery)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      try {
        const result = await inspectionQuery({
          action: "READ_CHECKLIST_V2",
          companyId: principal.companyId,
          hotelId,
          sessionId: principal.sessionId,
          sessionToken: principal.sessionToken,
        });
        if (result.status !== "OK") failure(result.status);
        return result.payload;
      } catch (error) {
        if (!isUndefinedDatabaseFunction(error)) throw error;
        return adaptLegacyChecklistToV2(
          await this.getChecklist(principal, hotelId),
        );
      }
    },
    async saveChecklistV2(principal, hotelId, value, idempotencyKey) {
      const operationPath = inspectionRoutes.checklistV2(hotelId);
      const revisionId = crypto.randomUUID();
      const legacyRevisionId = crypto.randomUUID();
      const commandValue = {
        ...value,
        revisionId,
        legacyRevisionId,
        items: value.items.map((item) => ({
          ...item,
          itemId: item.itemId ?? crypto.randomUUID(),
          itemIsNew: item.itemId === null,
          snapshotId: crypto.randomUUID(),
          legacySnapshotId: crypto.randomUUID(),
        })),
      };
      let result;
      try {
        result = await repository.command({
          action: "SAVE_CHECKLIST_V2",
          auditEventId: crypto.randomUUID(),
          companyId: principal.companyId,
          expectedVersion: value.version,
          hotelId,
          httpMethod: "PUT",
          idempotencyKey,
          idempotencyRecordId: crypto.randomUUID(),
          operationPath,
          requestHash: await hash({ method: "PUT", path: operationPath, value }),
          resourceId: revisionId,
          sessionId: principal.sessionId,
          sessionToken: principal.sessionToken,
          traceId: crypto.randomUUID(),
          value: commandValue,
        });
      } catch (error) {
        if (isUndefinedDatabaseFunction(error))
          throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
        throw error;
      }
      if (!["CREATED", "UPDATED", "REPLAYED"].includes(result.status))
        failure(result.status);
      if (!result.payload)
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload;
    },
    async listRoutines(principal, hotelId) {
      const routineRead = repository.routineRead;
      if (!routineRead)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await routineRead({
        companyId: principal.companyId,
        hotelId,
        routineId: null,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (
        !result.payload ||
        typeof result.payload !== "object" ||
        !("routines" in result.payload) ||
        !Array.isArray(result.payload.routines)
      )
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload.routines;
    },
    async getRoutine(principal, hotelId, routineId) {
      const routineRead = repository.routineRead;
      if (!routineRead)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await routineRead({
        companyId: principal.companyId,
        hotelId,
        routineId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (
        !result.payload ||
        typeof result.payload !== "object" ||
        !("routine" in result.payload)
      )
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload.routine;
    },
    async saveRoutine(principal, hotelId, routineId, value, idempotencyKey) {
      const routineMutation = repository.routineMutation;
      if (!routineMutation)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const resourceId = routineId ?? crypto.randomUUID();
      const operationPath = routineId
        ? inspectionRoutes.routine(hotelId, routineId)
        : inspectionRoutes.routines(hotelId);
      const httpMethod = routineId ? "PUT" : "POST";
      const result = await routineMutation({
        auditEventId: crypto.randomUUID(),
        companyId: principal.companyId,
        expectedVersion: value.version,
        hotelId,
        httpMethod,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath,
        requestHash: await hash({
          method: httpMethod,
          path: operationPath,
          value,
        }),
        resourceId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        traceId: crypto.randomUUID(),
        value,
      });
      if (!["OK", "REPLAYED"].includes(result.status)) failure(result.status);
      if (!result.payload)
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload;
    },
    async listRoutinesV2(principal, hotelId) {
      const routineRead = repository.routineReadV2;
      if (!routineRead)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await routineRead({
        companyId: principal.companyId,
        hotelId,
        routineId: null,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (!result.payload || typeof result.payload !== "object" ||
          !("routines" in result.payload) || !Array.isArray(result.payload.routines))
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload.routines;
    },
    async getRoutineV2(principal, hotelId, routineId) {
      const routineRead = repository.routineReadV2;
      if (!routineRead)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await routineRead({
        companyId: principal.companyId,
        hotelId,
        routineId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (!result.payload || typeof result.payload !== "object" || !("routine" in result.payload))
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload.routine;
    },
    async saveRoutineV2(principal, hotelId, routineId, value, idempotencyKey) {
      const routineMutation = repository.routineMutationV2;
      if (!routineMutation)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const resourceId = routineId ?? crypto.randomUUID();
      const operationPath = routineId
        ? inspectionRoutes.routineV2(hotelId, routineId)
        : inspectionRoutes.routinesV2(hotelId);
      const httpMethod = routineId ? "PUT" : "POST";
      const result = await routineMutation({
        auditEventId: crypto.randomUUID(),
        companyId: principal.companyId,
        expectedVersion: value.version,
        hotelId,
        httpMethod,
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath,
        requestHash: await hash({ method: httpMethod, path: operationPath, value }),
        resourceId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        traceId: crypto.randomUUID(),
        value,
      });
      if (!["OK", "REPLAYED"].includes(result.status)) failure(result.status);
      if (!result.payload)
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload;
    },
    async listInspections(principal, hotelId, query) {
      const listInspections = repository.listInspections;
      if (!listInspections)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await listInspections({
        companyId: principal.companyId,
        hotelId,
        inspectionId: null,
        query,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (
        !result.payload ||
        typeof result.payload !== "object" ||
        !("inspections" in result.payload) ||
        !("pagination" in result.payload)
      )
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload;
    },
    async getInspection(principal, hotelId, inspectionId) {
      const result = await repository.readInspection({
        companyId: principal.companyId,
        hotelId,
        inspectionId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (
        !result.payload ||
        typeof result.payload !== "object" ||
        !("inspection" in result.payload)
      )
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload.inspection;
    },
    async listInspectionsV2(principal, hotelId, query) {
      const listInspections = repository.listInspectionsV2;
      if (!listInspections)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await listInspections({
        companyId: principal.companyId,
        hotelId,
        inspectionId: null,
        query,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (!result.payload || typeof result.payload !== "object" ||
          !("inspections" in result.payload) || !("pagination" in result.payload))
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload;
    },
    async getInspectionV2(principal, hotelId, inspectionId) {
      const readInspection = repository.readInspectionV2;
      if (!readInspection)
        throw new InspectionServiceError("DB_NOT_CONFIGURED", 503);
      const result = await readInspection({
        companyId: principal.companyId,
        hotelId,
        inspectionId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
      });
      if (result.status !== "OK") failure(result.status);
      if (!result.payload || typeof result.payload !== "object" || !("inspection" in result.payload))
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return result.payload.inspection;
    },
    async listReviews(principal, hotelId, query) {
      const payload = await readReview({
        hotelId,
        inspectionId: null,
        principal,
        query,
      });
      if (!("reviews" in payload) || !("pagination" in payload))
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return payload;
    },
    async getReview(principal, hotelId, inspectionId) {
      const payload = await readReview({
        hotelId,
        inspectionId,
        principal,
        query: {},
      });
      if (!("review" in payload))
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return payload.review;
    },
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
        requestValue: value,
        value: {
          ...value,
          processExecutionId: crypto.randomUUID(),
          reason: "수시점검 생성",
        },
      });
    },
    createManualInspectionV2(principal, hotelId, value, idempotencyKey) {
      const inspectionId = crypto.randomUUID();
      return mutateAndRead({
        action: "CREATE_MANUAL_V2",
        expectedVersion: 0,
        hotelId,
        httpMethod: "POST",
        idempotencyKey,
        inspectionId,
        operationPath: inspectionRoutes.createManualV2(hotelId),
        principal,
        requestValue: value,
        useV2: true,
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
        requestValue: value,
        resultExpectation: { itemSnapshotId, value },
        value: {
          ...value,
          historyId: crypto.randomUUID(),
          itemSnapshotId,
          resultId: crypto.randomUUID(),
        },
      });
    },
    saveResultV2(
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
        operationPath: inspectionRoutes.resultV2(
          hotelId,
          inspectionId,
          itemSnapshotId,
        ),
        principal,
        requestValue: value,
        resultExpectation: { itemSnapshotId, value },
        useV2: true,
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
        requestValue: value,
        value: { historyId: crypto.randomUUID(), reason: value.reason },
      });
    },
    submitV2(principal, hotelId, inspectionId, value, idempotencyKey) {
      return mutateAndRead({
        action: "SUBMIT",
        expectedVersion: value.version,
        hotelId,
        httpMethod: "POST",
        idempotencyKey,
        inspectionId,
        operationPath: inspectionRoutes.submitV2(hotelId, inspectionId),
        principal,
        requestValue: value,
        useV2: true,
        value: { historyId: crypto.randomUUID(), reason: value.reason },
      });
    },
    async transition(principal, hotelId, inspectionId, value, idempotencyKey) {
      const operationPath = inspectionRoutes.transition(hotelId, inspectionId);
      const result = await repository.command({
        action: "TRANSITION",
        auditEventId: crypto.randomUUID(),
        companyId: principal.companyId,
        expectedVersion: value.version,
        hotelId,
        httpMethod: "POST",
        idempotencyKey,
        idempotencyRecordId: crypto.randomUUID(),
        operationPath,
        requestHash: await hash({
          method: "POST",
          path: operationPath,
          value,
        }),
        resourceId: inspectionId,
        sessionId: principal.sessionId,
        sessionToken: principal.sessionToken,
        traceId: crypto.randomUUID(),
        value: { ...value, historyId: crypto.randomUUID() },
      });
      if (!["UPDATED", "REPLAYED"].includes(result.status))
        failure(result.status);
      const receipt = inspectionReviewSchema.safeParse(result.payload);
      if (!receipt.success)
        throw new InspectionServiceError("INTERNAL_ERROR", 500);
      return receipt.data;
    },
  };
}
