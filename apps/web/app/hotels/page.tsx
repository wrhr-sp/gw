import { hotelListQuerySchema } from "@werehere/contracts";
import { HotelListView } from "../../components/hotels/hotel-list-view";
import { fetchHotelList } from "../../lib/server-hotels";

export const dynamic = "force-dynamic";

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const rawQuery = await searchParams;
  const parsedQuery = hotelListQuerySchema.safeParse({
    page: rawQuery.page,
    pageSize: 20,
    q: rawQuery.q || undefined,
    status: rawQuery.status || undefined,
  });
  const query = parsedQuery.success ? parsedQuery.data : hotelListQuerySchema.parse({});
  const result = await fetchHotelList(query);

  return <HotelListView query={query} result={result} />;
}
