let clientClockOffset = 0;

export function setClientClockOffset(offset: number) {
  clientClockOffset = offset;
}

export function getInternetDate(): Date {
  return new Date(Date.now() + clientClockOffset);
}
