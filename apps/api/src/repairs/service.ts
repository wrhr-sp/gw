import {
  createRepairCaseRequestSchema,
  createRepairVisitRequestSchema,
  repairCaseReadSchema,
  repairFollowUpListResponseSchema,
  repairListResponseSchema,
  repairPriorityListResponseSchema,
  repairProcessTransitionRequestSchema,
  repairRoutes,
  submitRepairReviewRequestSchema,
  type AuthenticatedPrincipal,
  type CreateRepairCaseRequest,
  type CreateRepairVisitRequest,
  type HotelErrorCode,
  type RepairCase,
} from "@werehere/contracts";
import type { RepairCommandInput, RepairRepository } from "@werehere/db";
import { sha256 } from "../auth/crypto";

type MutationPrincipal = AuthenticatedPrincipal & { sessionToken: string };
type RepairHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;
export class RepairServiceError extends Error {
  readonly retryable = false;
  constructor(
    public readonly code: HotelErrorCode,
    public readonly httpStatus: RepairHttpStatus,
  ) {
    super(code);
  }
}
const STATUS: Record<string, [HotelErrorCode, RepairHttpStatus]> = {
  FORBIDDEN: ["FORBIDDEN", 403], NOT_FOUND: ["RESOURCE_NOT_FOUND", 404], RESOURCE_NOT_FOUND: ["RESOURCE_NOT_FOUND", 404], VERSION_CONFLICT: ["VERSION_CONFLICT", 409], IDEMPOTENCY_CONFLICT: ["IDEMPOTENCY_CONFLICT", 409], PROCESS_DEFAULT_REQUIRED: ["PROCESS_DEFAULT_REQUIRED", 422], REPAIR_PRIORITY_REQUIRED: ["REPAIR_PRIORITY_REQUIRED", 422], REPAIR_EVIDENCE_REQUIRED: ["REPAIR_EVIDENCE_REQUIRED", 422], REPAIR_PERFORMER_INVALID: ["REPAIR_PERFORMER_INVALID", 422], REPAIR_VISIT_INVALID: ["REPAIR_VISIT_INVALID", 422], REPAIR_COMPLETED_LOCKED: ["REPAIR_COMPLETED_LOCKED", 409], REPAIR_FOLLOW_UP_INVALID: ["REPAIR_FOLLOW_UP_INVALID", 422], VALIDATION_ERROR: ["VALIDATION_ERROR", 400],
};
function failure(status: string): never { const mapped=STATUS[status] ?? ["INTERNAL_ERROR",500]; throw new RepairServiceError(mapped[0],mapped[1]); }
async function hash(value: unknown) { const digest=await sha256(JSON.stringify(value)); return Array.from(digest,(byte)=>byte.toString(16).padStart(2,"0")).join(""); }
function requireMutationPrincipal(principal: AuthenticatedPrincipal): MutationPrincipal {
  if (!("sessionToken" in principal) || typeof (principal as {sessionToken?:unknown}).sessionToken!=="string") throw new RepairServiceError("AUTHENTICATION_REQUIRED",401);
  return principal as MutationPrincipal;
}

export interface RepairService {
  close?(): Promise<void>;
  getRepair(principal: AuthenticatedPrincipal, hotelId: string, repairId: string): Promise<RepairCase>;
  listRepairs(principal: AuthenticatedPrincipal, hotelId: string, query: unknown): Promise<unknown>;
  listFollowUps(principal: AuthenticatedPrincipal, hotelId: string, repairId: string, query: unknown): Promise<unknown>;
  listPriorities(principal: AuthenticatedPrincipal, hotelId: string): Promise<unknown>;
  createRepair(principal: AuthenticatedPrincipal, hotelId: string, value: CreateRepairCaseRequest, idempotencyKey: string): Promise<RepairCase>;
  createVisit(principal: AuthenticatedPrincipal, hotelId: string, value: CreateRepairVisitRequest, idempotencyKey: string): Promise<unknown>;
  visitMutation(principal: AuthenticatedPrincipal, hotelId: string, visitId: string, action: string, version: number, value: unknown, idempotencyKey: string): Promise<unknown>;
  completeRepair(principal: AuthenticatedPrincipal, hotelId: string, repairId: string, version: number, value: unknown, idempotencyKey: string): Promise<RepairCase>;
  submitReview(principal: AuthenticatedPrincipal, hotelId: string, repairId: string, value: unknown, idempotencyKey: string): Promise<RepairCase>;
  transition(principal: AuthenticatedPrincipal, hotelId: string, repairId: string, value: unknown, idempotencyKey: string): Promise<RepairCase>;
}

export function createRepairService(repository: RepairRepository): RepairService {
  async function mutation(principal: AuthenticatedPrincipal, input: Omit<RepairCommandInput,"auditEventId"|"companyId"|"idempotencyRecordId"|"requestHash"|"sessionId"|"sessionToken"|"traceId">, target: "case"|"transition"|"visit") {
    const actor=requireMutationPrincipal(principal);
    const command: RepairCommandInput={...input,companyId:actor.companyId,sessionId:actor.sessionId,sessionToken:actor.sessionToken,auditEventId:crypto.randomUUID(),idempotencyRecordId:crypto.randomUUID(),traceId:crypto.randomUUID(),requestHash:await hash({method:input.method,path:input.operationPath,value:input.value})};
    const result=target==="case"
      ? await repository.caseCommand(command)
      : target==="transition"
        ? await repository.transitionCommand(command)
        : await repository.visitCommand(command);
    if (!["CREATED","UPDATED","REPLAYED"].includes(result.status) || result.payload===null) failure(result.status);
    return result.payload;
  }
  return {
    async close(){ await repository.close(); },
    async getRepair(principal,hotelId,repairId){
      const actor=requireMutationPrincipal(principal);
      const result=await repository.read({companyId:actor.companyId,hotelId,repairId,query:{},sessionId:actor.sessionId,sessionToken:actor.sessionToken});
      if (result.status!=="OK" || result.payload===null) failure(result.status);
      const parsed=repairCaseReadSchema.safeParse((result.payload as {repair?:unknown}).repair ?? result.payload); if(!parsed.success) throw new RepairServiceError("INTERNAL_ERROR",500); return parsed.data;
    },
    async listRepairs(principal,hotelId,query){ const actor=requireMutationPrincipal(principal); const result=await repository.read({companyId:actor.companyId,hotelId,repairId:null,query,sessionId:actor.sessionId,sessionToken:actor.sessionToken}); if(result.status!=="OK"||result.payload===null) failure(result.status); const parsed=repairListResponseSchema.safeParse({ok:true,data:result.payload,error:null}); if(!parsed.success) throw new RepairServiceError("INTERNAL_ERROR",500); return parsed.data.data; },
    async listFollowUps(principal,hotelId,repairId,query){ const actor=requireMutationPrincipal(principal); const result=await repository.read({companyId:actor.companyId,hotelId,repairId:null,query:{...(query as object),parentId:repairId},sessionId:actor.sessionId,sessionToken:actor.sessionToken}); if(result.status!=="OK"||result.payload===null) failure(result.status); const parsed=repairFollowUpListResponseSchema.safeParse({ok:true,data:result.payload,error:null}); if(!parsed.success) throw new RepairServiceError("INTERNAL_ERROR",500); return parsed.data.data; },
    async listPriorities(principal,hotelId){ const actor=requireMutationPrincipal(principal); const result=await repository.read({companyId:actor.companyId,hotelId,repairId:null,query:{kind:"PRIORITIES"},sessionId:actor.sessionId,sessionToken:actor.sessionToken}); if(result.status!=="OK"||result.payload===null) failure(result.status); const parsed=repairPriorityListResponseSchema.safeParse({ok:true,data:result.payload,error:null}); if(!parsed.success) throw new RepairServiceError("INTERNAL_ERROR",500); return parsed.data.data; },
    async createRepair(principal,hotelId,value,idempotencyKey){
      const parsed=createRepairCaseRequestSchema.parse(value); const resourceId=parsed.repairCaseId; const action=parsed.followUpOfRepairCaseId?"CREATE_FOLLOW_UP":parsed.source.type==="INSPECTION"?"CREATE_INSPECTION":"CREATE_DIRECT";
      const payload=await mutation(principal,{action,expectedVersion:0,hotelId,idempotencyKey,method:"POST",operationPath:repairRoutes.create(hotelId),resourceId,value:parsed},"case");
      const repair=repairCaseReadSchema.safeParse((payload as {repair?:unknown}).repair ?? payload); if(!repair.success) throw new RepairServiceError("INTERNAL_ERROR",500); return repair.data;
    },
    async createVisit(principal,hotelId,value,idempotencyKey){ const parsed=createRepairVisitRequestSchema.parse(value); return mutation(principal,{action:"CREATE",expectedVersion:0,hotelId,idempotencyKey,method:"POST",operationPath:repairRoutes.visits(hotelId),resourceId:crypto.randomUUID(),value:parsed},"visit"); },
    async visitMutation(principal,hotelId,visitId,action,version,value,idempotencyKey){ return mutation(principal,{action,expectedVersion:version,hotelId,idempotencyKey,method:action==="UPDATE"?"PATCH":"POST",operationPath:action==="COMPLETE"?repairRoutes.visitComplete(hotelId,visitId):action==="CANCEL"?repairRoutes.visitCancel(hotelId,visitId):action==="RESTORE"?repairRoutes.visitRestore(hotelId,visitId):action==="DELETE"?repairRoutes.visitDelete(hotelId,visitId):repairRoutes.visit(hotelId,visitId),resourceId:visitId,value},"visit"); },
    async completeRepair(principal,hotelId,repairId,version,value,idempotencyKey){ const payload=await mutation(principal,{action:"COMPLETE",expectedVersion:version,hotelId,idempotencyKey,method:"POST",operationPath:repairRoutes.complete(hotelId,repairId),resourceId:repairId,value},"case"); const repair=repairCaseReadSchema.safeParse((payload as {repair?:unknown}).repair ?? payload); if(!repair.success) throw new RepairServiceError("INTERNAL_ERROR",500); return repair.data; },
    async submitReview(principal,hotelId,repairId,value,idempotencyKey){ const parsed=submitRepairReviewRequestSchema.parse(value); const payload=await mutation(principal,{action:"SUBMIT_REVIEW",expectedVersion:parsed.version,hotelId,idempotencyKey,method:"POST",operationPath:repairRoutes.submitReview(hotelId,repairId),resourceId:repairId,value:parsed},"case"); const repair=repairCaseReadSchema.safeParse((payload as {repair?:unknown}).repair ?? payload); if(!repair.success) throw new RepairServiceError("INTERNAL_ERROR",500); return repair.data; },
    async transition(principal,hotelId,repairId,value,idempotencyKey){ const parsed=repairProcessTransitionRequestSchema.parse(value); const payload=await mutation(principal,{action:parsed.event,expectedVersion:parsed.processVersion,hotelId,idempotencyKey,method:"POST",operationPath:repairRoutes.transition(hotelId,repairId),resourceId:repairId,value:parsed},"transition"); const repair=repairCaseReadSchema.safeParse((payload as {repair?:unknown}).repair ?? payload); if(!repair.success) throw new RepairServiceError("INTERNAL_ERROR",500); return repair.data; },
  };
}
