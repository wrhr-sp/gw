export function calendarNavigationHref(
  canViewAllHotels: boolean,
  hotels: readonly { id: string }[],
) {
  if (canViewAllHotels) return "/hotels/calendar";
  return hotels[0] ? `/hotels/${hotels[0].id}/calendar` : undefined;
}
