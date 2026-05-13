"use client";

import { useEffect } from "react";

function pickIconType(url: string): string | undefined {
  const lower = url.split("?")[0].toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return undefined;
}

// Manage a single <link rel="icon" data-brand-favicon> element. Do NOT remove
// or modify any other icon links — Next.js renders a server-side one for
// app/favicon.ico that React tracks; touching it causes "removeChild on null"
// when React tries to clean it up later. Browsers pick the last matching
// <link rel="icon"> in <head>, so appending ours wins.
function setFaviconHref(url: string) {
  const head = document.head;
  let link = head.querySelector<HTMLLinkElement>('link[data-brand-favicon="true"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-brand-favicon", "true");
    head.appendChild(link);
  }
  const type = pickIconType(url);
  if (type) link.type = type;
  else link.removeAttribute("type");
  link.href = url;
}

export function BrandFavicon() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brand");
        if (!res.ok) return;
        const data = await res.json();
        const url = typeof data?.logoUrl === "string" ? data.logoUrl.trim() : "";
        if (!cancelled && url) setFaviconHref(url);
      } catch {
        /* ignore — leave default favicon */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
