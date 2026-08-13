import {
  dailySalesInternalResponseSchema,
  dailySalesListResponseSchema,
} from "@werehere/contracts";
import { createPostgresDailySalesRepository } from "@werehere/db";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createDailySalesService } from "../src/daily-sales/service";

const companyId="10000000-0000-0000-0000-000000000001";
const hotelId="50000000-0000-4000-8000-000000000001";
const sessionId="4f000000-0000-4000-8000-000000000001";
const userId="2f000000-0000-4000-8000-000000000001";
const salesId="da570000-0000-4000-8000-000000000001";
const categoryId="da510000-0000-4000-8000-000000000001";
const paymentMethodId="da520000-0000-4000-8000-000000000001";
const token="I".repeat(43);
async function request(app:ReturnType<typeof createApp>,path:string,method="GET",body?:unknown,key?:string){const headers:Record<string,string>={cookie:`__Host-hotel_session=${token}`};if(body!==undefined)headers["content-type"]="application/json";if(key)headers["idempotency-key"]=key;return app.request(path,{...(body===undefined?{}:{body:JSON.stringify(body)}),headers,method});}
async function expectStatus(response:Response,status:number,label:string){if(response.status===status)return;const value=await response.json().catch(()=>null) as {error?:{code?:string}|null}|null;throw new Error(`${label}: expected ${status}, received ${response.status} ${value?.error?.code??"UNKNOWN"}`);}
const databaseUrl=process.env.TEST_READY_URL;if(!databaseUrl)throw new Error("daily sales actual API URL is missing");
const principal={companyId,displayName:"일매출 API 통합검증자",identityId:"3f000000-0000-4000-8000-000000000001",sessionId,userId,userType:"INTERNAL_STAFF" as const};
const authService={resolvePrincipal:async()=>principal} as unknown as AuthService;
const service=createDailySalesService(createPostgresDailySalesRepository(databaseUrl));
const app=createApp({authService,dailySalesService:service});
const base=`/api/hotels/${hotelId}/daily-sales`;
const line={categoryId,paymentMethodId,grossAmount:120000,discountAmount:5000,refundAmount:0,refundReason:null};
try{
 const createBody={salesId,businessDate:"2026-08-14",memo:"실제 API 임시저장",lines:[line]};
 const createdResponse=await request(app,base,"POST",createBody,"sales-actual-create-1");await expectStatus(createdResponse,201,"sales create");const created=dailySalesInternalResponseSchema.parse(await createdResponse.json()).data.sales;if(created.id!==salesId||created.status!=="DRAFT"||created.totals.netAmount!==115000)throw new Error("created sales snapshot mismatch");
 const replayResponse=await request(app,base,"POST",createBody,"sales-actual-create-1");await expectStatus(replayResponse,201,"sales replay");const replay=dailySalesInternalResponseSchema.parse(await replayResponse.json()).data.sales;if(replay.id!==salesId||replay.version!==created.version)throw new Error("sales replay mismatch");
 const listResponse=await request(app,`${base}?page=1&pageSize=100&status=DRAFT`);await expectStatus(listResponse,200,"sales list");const list=dailySalesListResponseSchema.parse(await listResponse.json()).data;if(!list.sales.some(s=>s.id===salesId))throw new Error("created sales missing from list");
 const detailPath=`${base}/${salesId}`;const detailResponse=await request(app,detailPath);await expectStatus(detailResponse,200,"sales detail");const detail=dailySalesInternalResponseSchema.parse(await detailResponse.json()).data.sales;
 const updatedResponse=await request(app,detailPath,"PATCH",{version:detail.version,memo:"실제 API 수정",lines:[{...line,grossAmount:140000}]},"sales-actual-update-1");await expectStatus(updatedResponse,200,"sales update");const updated=dailySalesInternalResponseSchema.parse(await updatedResponse.json()).data.sales;if(updated.totals.netAmount!==135000||updated.internalMemo!=="실제 API 수정")throw new Error("updated sales read-back mismatch");
 const staleResponse=await request(app,detailPath,"PATCH",{version:detail.version,memo:"낡은 화면",lines:[line]},"sales-actual-stale-1");await expectStatus(staleResponse,409,"stale sales version");
 console.log("HOTEL_DAILY_SALES_ACTUAL_API_OK");
}finally{await service.close?.();}
