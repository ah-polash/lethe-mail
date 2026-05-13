"use client";

import { useEffect } from "react";

// Input types where setting the placeholder text as the value doesn't make
// sense (non-text controls, or password fields where we shouldn't reveal).
const SKIP_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  // React listens for `input`; dispatch with bubbles so controlled components
  // pick up the change via their onChange handler.
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function PlaceholderShortcut() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd+Shift+P (Mac) / Ctrl+Shift+P (others).
      if (e.key.toLowerCase() !== "p") return;
      if (!e.shiftKey) return;
      if (!(e.metaKey || e.ctrlKey)) return;

      const el = document.activeElement;
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
      if (el.disabled || el.readOnly) return;
      if (el instanceof HTMLInputElement && SKIP_INPUT_TYPES.has(el.type)) return;

      const placeholder = el.placeholder;
      if (!placeholder) return;

      e.preventDefault();
      setNativeValue(el, placeholder);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
