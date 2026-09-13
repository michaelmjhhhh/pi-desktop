import type { BlockingExtensionUiRequest, ExtensionUiRequest } from "./types";

interface WindowNotificationLike {
  onclick: Notification["onclick"];
  close: () => void;
}

export interface BrowserNotificationEnvironment {
  createWindowNotification: (title: string, options?: NotificationOptions) => WindowNotificationLike;
}

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  onClick: () => void;
  tag?: string;
}

export type NotificationDelivery = "window" | null;

type DocumentAttentionState = Pick<Document, "visibilityState" | "hasFocus">;

export function shouldShowBrowserNotification(
  attentionState: DocumentAttentionState = document,
): boolean {
  return attentionState.visibilityState !== "visible" || !attentionState.hasFocus();
}

export function isBlockingExtensionUiRequest(
  request: ExtensionUiRequest,
): request is BlockingExtensionUiRequest {
  switch (request.method) {
    case "select":
    case "confirm":
    case "input":
    case "editor":
      return true;
    case "custom":
      return request.closed !== true;
    default:
      return false;
  }
}

export function claimExtensionAttentionNotification(
  request: ExtensionUiRequest,
  notifiedRequestIds: Set<string>,
): request is BlockingExtensionUiRequest {
  if (!isBlockingExtensionUiRequest(request) || notifiedRequestIds.has(request.id)) return false;
  notifiedRequestIds.add(request.id);
  return true;
}

function getBrowserEnvironment(): BrowserNotificationEnvironment {
  return {
    createWindowNotification: (title, options) => new Notification(title, options),
  };
}

export async function showBrowserNotification(
  options: BrowserNotificationOptions,
  environment: BrowserNotificationEnvironment = getBrowserEnvironment(),
): Promise<NotificationDelivery> {
  const notificationOptions: NotificationOptions = {
    body: options.body,
    ...(options.tag ? { tag: options.tag, renotify: true } : {}),
  };

  try {
    const notification = environment.createWindowNotification(options.title, notificationOptions);
    notification.onclick = () => {
      notification.close();
      options.onClick();
    };
    return "window";
  } catch {
    // Notifications may be unavailable or disabled by the operating system.
    return null;
  }
}
