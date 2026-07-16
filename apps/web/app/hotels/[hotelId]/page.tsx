import { notFound } from "next/navigation";
import { HotelDetailView } from "../../../components/hotels/hotel-detail-view";
import { fetchHotelDetail } from "../../../lib/server-hotels";

export default async function HotelDetailPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const result = await fetchHotelDetail(hotelId);
  if (!result.ok && result.error.status === 404) notFound();

  return <HotelDetailView result={result} retryHref={`/hotels/${hotelId}`} />;
}
