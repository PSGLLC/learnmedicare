export function assertLeadResponse(httpOk: boolean, data: {
  ok?: boolean; excluded?: boolean; error?: string;
}): void {
  if (data.excluded) {
    throw new Error('Your request was not submitted. Please contact us for assistance.');
  }
  if (!httpOk || !data.ok) {
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
}
