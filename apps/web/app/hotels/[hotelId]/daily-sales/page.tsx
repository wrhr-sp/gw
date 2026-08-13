import { notFound } from "next/navigation";
import { DailySalesWorkspace } from "../../../../components/daily-sales/daily-sales-workspace";
import { fetchDailySales } from "../../../../lib/server-daily-sales";
export const dynamic="force-dynamic";
export default async function DailySalesPage({params}:{params:Promise<{hotelId:string}>}){const {hotelId}=await params;const result=await fetchDailySales(hotelId);if(!result.ok&&["FORBIDDEN", "RESOURCE_NOT_FOUND"].includes(result.code))notFound();if(!result.ok)return <section className="rounded-panel border border-border bg-surface p-6" role="alert"><h1 className="text-lg font-semibold">일매출 장부를 불러오지 못했습니다</h1><p className="mt-2 text-sm text-muted">{result.error}</p></section>;return <DailySalesWorkspace hotelId={hotelId} capability={result.capability} references={result.references} initialSales={result.sales} initialSelected={result.selected}/>;}
