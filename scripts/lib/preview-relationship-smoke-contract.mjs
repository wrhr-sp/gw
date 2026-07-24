// Date values are supplied explicitly by the caller; this helper only owns
// response/click settlement and optional reload sequencing.
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
