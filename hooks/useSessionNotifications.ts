"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { useI18n } from "./useI18n";
import { claimExtensionAttentionNotification, shouldShowBrowserNotification, showBrowserNotification } from "@/lib/browser-notifications";
import type { BlockingExtensionUiRequest, SessionInfo } from "@/lib/types";

export function useSessionNotifications(selectedSession: SessionInfo | null, handleSelectSession: (session: SessionInfo) => void) {
  const { t: translate } = useI18n();
  const selectSessionRef = useRef(handleSelectSession);
  useLayoutEffect(() => { selectSessionRef.current = handleSelectSession; }, [handleSelectSession]);
  const notifiedAttentionRequestIdsRef = useRef(new Set<string>());
  const deliverSessionNotification = useCallback(({
    targetSession,
    title,
    body,
    tag,
  }: {
    targetSession: SessionInfo | null;
    title: string;
    body: string;
    tag?: string;
  }) => {
    if (!("Notification" in window)) return;

    const fire = () => {
      void showBrowserNotification({
        title,
        body,
        tag,
        onClick: () => {
          window.focus();
          if (targetSession) selectSessionRef.current(targetSession);
        },
      });
    };

    if (Notification.permission === "granted") {
      fire();
    } else if (Notification.permission === "default") {
      void Notification.requestPermission().then((p) => {
        if (p === "granted") {
          fire();
        }
      });
    }
  }, []);

  const notifyCompletion = useCallback(() => {
    if (selectedSession?.relation?.kind === "subagent") return;
    if (!shouldShowBrowserNotification()) return;
    const targetSession = selectedSession;
    deliverSessionNotification({
      targetSession,
      title: targetSession?.name ?? translate("i18n.sessionComplete"),
      body: translate("i18n.taskFinished"),
      tag: targetSession ? `pi-session-complete:${targetSession.id}` : "pi-session-complete",
    });
  }, [deliverSessionNotification, selectedSession, translate]);

  const handleAttentionNeeded = useCallback((request: BlockingExtensionUiRequest) => {
    if (selectedSession?.relation?.kind === "subagent") return;
    if (!shouldShowBrowserNotification()) return;
    if (!claimExtensionAttentionNotification(request, notifiedAttentionRequestIdsRef.current)) return;

    deliverSessionNotification({
      targetSession: selectedSession,
      title: translate("i18n.attentionNeeded"),
      body: request.method === "custom"
        ? translate("i18n.extensionInputNeeded")
        : request.title,
      tag: `pi-extension-ui:${request.id}`,
    });
  }, [deliverSessionNotification, selectedSession, translate]);

  return { notifyCompletion, handleAttentionNeeded };
}
