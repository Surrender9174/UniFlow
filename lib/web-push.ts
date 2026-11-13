import {
  sendNotification,
  setVapidDetails,
  type PushSubscription,
} from "web-push";

export function sendWebPush(subscription: PushSubscription, payload: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.",
    );
  }
  setVapidDetails(subject, publicKey, privateKey);
  return sendNotification(subscription, payload);
}
