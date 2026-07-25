import { notFound } from "next/navigation";
import { HotelDetailView } from "../../../components/hotels/hotel-detail-view";
import { fetchHotelDetail } from "../../../lib/server-hotels";
import { fetchRoomInitialData } from "../../../lib/server-rooms";

export const dynamic = "force-dynamic";

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const [result, rooms] = await Promise.all([
    fetchHotelDetail(hotelId),
    fetchRoomInitialData(hotelId),
  ]);
  if (!result.ok && result.error.status === 404) notFound();

  return (
    <HotelDetailView
      result={result}
      retryHref={`/hotels/${hotelId}`}
      roomInitialData={rooms.ok ? rooms.data : undefined}
      roomInitialFailure={rooms.ok ? undefined : rooms.error}
    />
  );
}
