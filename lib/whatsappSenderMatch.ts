import { mobileVariantsFromE164 } from '@/utils/phone';

/** True when Meta Cloud `from` and the number typed in the app are the same mobile. */
export function inboundSenderMatchesClaimed(senderE164: string, claimedE164: string): boolean {
  const sender = mobileVariantsFromE164(senderE164);
  const claimed = mobileVariantsFromE164(claimedE164);
  return claimed.some((value) => sender.includes(value));
}
