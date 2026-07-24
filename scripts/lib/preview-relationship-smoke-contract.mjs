export function seoulCalendarDate(now = new Date()) {
  const parts = new Map(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const year = parts.get("year");
  const month = parts.get("month");
  const day = parts.get("day");
  if (!year || !month || !day) {
    throw new Error("Seoul calendar date could not be resolved");
  }
  return `${year}-${month}-${day}`;
}

export async function runHostedMutation({
  acceptedStatuses,
  click,
  label,
  waitForResponse,
}) {
  const responsePromise = Promise.resolve().then(waitForResponse);
  const clickPromise = Promise.resolve().then(click);
  const [responseResult, clickResult] = await Promise.allSettled([
    responsePromise,
    clickPromise,
  ]);
  if (clickResult.status === "rejected") {
    throw clickResult.reason;
  }
  if (responseResult.status === "rejected") {
    throw responseResult.reason;
  }
  const response = responseResult.value;
  if (!acceptedStatuses.includes(response.status())) {
    throw new Error(`${label} failed (${response.status()})`);
  }
  return response;
}

export async function runHostedMutationWithReload({
  acceptedStatuses,
  click,
  label,
  waitForReload,
  waitForResponse,
}) {
  const response = await runHostedMutation({
    acceptedStatuses,
    click,
    label,
    waitForResponse,
  });
  await waitForReload();
  return response;
}
