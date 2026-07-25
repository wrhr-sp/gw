// Date values are supplied explicitly by the caller; this helper only owns
// response/click settlement and optional reload sequencing.
export async function runHostedMutation({
  acceptedStatuses,
  click,
  label,
  onFailure = () => undefined,
  waitForResponse,
}) {
  const responsePromise = Promise.resolve().then(waitForResponse);
  const clickPromise = Promise.resolve().then(click);
  const [responseResult, clickResult] = await Promise.allSettled([
    responsePromise,
    clickPromise,
  ]);
  if (clickResult.status === "rejected") {
    await Promise.resolve()
      .then(() => onFailure({ kind: "click" }))
      .catch(() => undefined);
    throw clickResult.reason;
  }
  if (responseResult.status === "rejected") {
    await Promise.resolve()
      .then(() => onFailure({ kind: "response" }))
      .catch(() => undefined);
    throw responseResult.reason;
  }
  const response = responseResult.value;
  if (!acceptedStatuses.includes(response.status())) {
    await Promise.resolve()
      .then(() => onFailure({ kind: "status", status: response.status() }))
      .catch(() => undefined);
    throw new Error(`${label} failed (${response.status()})`);
  }
  return response;
}

export async function runHostedMutationWithReload({
  acceptedStatuses,
  beforeReload = () => undefined,
  click,
  label,
  onFailure = () => undefined,
  waitForReload,
  waitForResponse,
}) {
  const response = await runHostedMutation({
    acceptedStatuses,
    click,
    label,
    onFailure,
    waitForResponse,
  });
  await beforeReload();
  await waitForReload();
  return response;
}
