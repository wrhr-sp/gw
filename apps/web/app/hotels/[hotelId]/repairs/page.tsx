import { RepairWorkspace } from "../../../../components/repairs/repair-workspace";
import { fetchRepairs } from "../../../../lib/server-repairs";

export default async function RepairsPage({params}:{params:Promise<{hotelId:string}>}){
 const {hotelId}=await params; const result=await fetchRepairs(hotelId);
 if(!result.ok) return <section role="alert" className="rounded-panel border border-border bg-surface p-6"><h1 className="text-lg font-semibold">하자·보수 화면을 불러오지 못했습니다</h1><p className="mt-2 text-sm text-muted">{result.error}</p></section>;
 return <RepairWorkspace assignments={result.assignments} facilityData={result.facilityData} hotelId={hotelId} initialRepairs={result.repairs} initialSelected={result.selectedRepair} priorities={result.priorities}/>;
}
