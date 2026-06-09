"use client";

import { type RefObject, useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";

export interface ToolbarState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

/**
 * Suit la sélection dans le corps `contentEditable` pour positionner la bulle
 * flottante (gras/italique/titres/citation/liste/lien/source). Porté du
 * prototype : `selectionchange` + `scroll` (capture) → coordonnées du rect.
 */
export function useSelectionToolbar(
  bodyRef: RefObject<HTMLElement | null>,
): [ToolbarState, { bold: boolean; italic: boolean }] {
  const [tb, setTb] = useState<ToolbarState>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });
  const [active, setActive] = useState({ bold: false, italic: false });

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setTb((t) => (t.visible ? { ...t, visible: false } : t));
        return;
      }
      const range = sel.getRangeAt(0);
      const body = bodyRef.current;
      if (!body || !body.contains(range.commonAncestorContainer)) {
        setTb((t) => (t.visible ? { ...t, visible: false } : t));
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setTb({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top,
        text: sel.toString(),
      });
      setActive({
        bold: !!document.queryCommandState?.("bold"),
        italic: !!document.queryCommandState?.("italic"),
      });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [bodyRef]);

  return [tb, active];
}

/** Applique une commande WYSIWYG à la sélection courante (execCommand). */
export function applyCommand(
  cmd: string,
  bodyRef: RefObject<HTMLElement | null>,
  linkPrompt: string,
) {
  bodyRef.current?.focus();
  switch (cmd) {
    case "bold":
      document.execCommand("bold");
      break;
    case "italic":
      document.execCommand("italic");
      break;
    case "h2":
      document.execCommand("formatBlock", false, "H2");
      break;
    case "h3":
      document.execCommand("formatBlock", false, "H3");
      break;
    case "quote":
      document.execCommand("formatBlock", false, "BLOCKQUOTE");
      break;
    case "ul":
      document.execCommand("insertUnorderedList");
      break;
    case "link": {
      const url = window.prompt(linkPrompt);
      if (url) document.execCommand("createLink", false, url);
      break;
    }
    default:
      break;
  }
}

/** Insère un appel de note <sup class="footnote">N</sup> au curseur. */
export function insertFootnoteMarker(
  bodyRef: RefObject<HTMLElement | null>,
  n: number,
) {
  const body = bodyRef.current;
  if (!body) return;
  body.focus();
  const sel = window.getSelection();
  const makeSup = () => {
    const sup = document.createElement("sup");
    sup.className = "footnote";
    sup.textContent = String(n);
    return sup;
  };
  if (!sel || sel.rangeCount === 0 || !body.contains(sel.anchorNode)) {
    const ps = body.querySelectorAll("p");
    const target = ps[ps.length - 1] || body;
    target.appendChild(makeSup());
    return;
  }
  const range = sel.getRangeAt(0);
  if (!range.collapsed) range.collapse(false);
  const sup = makeSup();
  range.insertNode(sup);
  range.setStartAfter(sup);
  range.setEndAfter(sup);
  sel.removeAllRanges();
  sel.addRange(range);
}

function ToolbarButton({
  cmd,
  label,
  isActive,
  wide,
  onCommand,
  children,
}: {
  cmd: string;
  label: string;
  isActive?: boolean;
  wide?: boolean;
  onCommand: (cmd: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${isActive ? "active " : ""}${wide ? "wide" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onCommand(cmd);
      }}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function FloatingToolbar({
  visible,
  position,
  active,
  onCommand,
  onAddSource,
}: {
  visible: boolean;
  position: { x: number; y: number };
  active: { bold: boolean; italic: boolean };
  onCommand: (cmd: string) => void;
  onAddSource: () => void;
}) {
  const { t } = useT();
  const tb = t.editor.toolbar;
  if (!visible) return null;

  return (
    <div className="float-tb" style={{ left: position.x, top: position.y }}>
      <ToolbarButton cmd="bold" label={tb.bold} isActive={active.bold} onCommand={onCommand}>
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton cmd="italic" label={tb.italic} isActive={active.italic} onCommand={onCommand}>
        <i>I</i>
      </ToolbarButton>
      <div className="div" />
      <ToolbarButton cmd="h2" label={tb.h2} wide onCommand={onCommand}>
        H2
      </ToolbarButton>
      <ToolbarButton cmd="h3" label={tb.h3} wide onCommand={onCommand}>
        H3
      </ToolbarButton>
      <ToolbarButton cmd="quote" label={tb.quote} onCommand={onCommand}>
        ❝
      </ToolbarButton>
      <ToolbarButton cmd="ul" label={tb.list} onCommand={onCommand}>
        •
      </ToolbarButton>
      <ToolbarButton cmd="link" label={tb.link} onCommand={onCommand}>
        ↗
      </ToolbarButton>
      <div className="div" />
      <button
        type="button"
        className="src wide"
        onMouseDown={(e) => {
          e.preventDefault();
          onAddSource();
        }}
        title={tb.addSource}
      >
        + Source
      </button>
    </div>
  );
}
