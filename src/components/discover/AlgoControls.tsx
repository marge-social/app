"use client";

import { useRef } from "react";
import { describeFeed, type SliderState } from "@/lib/mock/discover";

type Axis = keyof SliderState;

/** Rend la phrase « vous lisez actuellement… » : le balisage `<em>` (généré
 *  localement par describeFeed) est converti en nœuds React — pas de HTML brut. */
function renderSummary(html: string) {
  return html
    .split(/(<em>.*?<\/em>)/g)
    .filter(Boolean)
    .map((part, i) => {
      const m = part.match(/^<em>(.*?)<\/em>$/);
      return m ? <em key={i}>{m[1]}</em> : <span key={i}>{part}</span>;
    });
}

function AlgoSlider({
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const setFromClientX = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setFromClientX(e.clientX);
    const move = (ev: PointerEvent) => setFromClientX(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0, value - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(1, value + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(1);
    }
  };

  const fillLeft = Math.min(value, 0.5);
  const fillRight = Math.max(value, 0.5);

  return (
    <div className="slider">
      <div className="labels">
        <span className={`pole ${value < 0.4 ? "active" : ""}`}>{leftLabel}</span>
        <span className={`pole ${value > 0.6 ? "active" : ""}`}>{rightLabel}</span>
      </div>
      <div
        ref={ref}
        className="slider-track center-tick"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        role="slider"
        tabIndex={0}
        aria-label={`${leftLabel} ↔ ${rightLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={value < 0.4 ? leftLabel : value > 0.6 ? rightLabel : "équilibré"}
      >
        <div className="rail-line" />
        <div className="fill" style={{ left: `${fillLeft * 100}%`, right: `${(1 - fillRight) * 100}%` }} />
        <div className="thumb" style={{ left: `${value * 100}%` }} />
      </div>
    </div>
  );
}

export interface AlgoControlsProps {
  sliders: SliderState;
  setSlider: (axis: Axis, value: number) => void;
  reset: () => void;
  showReason: boolean;
  showReputation: boolean;
  onToggleReason: (v: boolean) => void;
  onToggleReputation: (v: boolean) => void;
}

/**
 * « Réglages du fil » — trois curseurs lisibles qui réordonnent réellement le
 * fil (aucun score caché), une phrase de synthèse, et deux bascules d'affichage
 * (raison de remontée, réputation des auteurs). Cœur de l'éthos anti-attention.
 */
export function AlgoControls({
  sliders,
  setSlider,
  reset,
  showReason,
  showReputation,
  onToggleReason,
  onToggleReputation,
}: AlgoControlsProps) {
  return (
    <div className="algo-controls">
      <h4 className="algo-controls-h">
        <span>Réglages du fil</span>
        <button type="button" className="reset-inline" onClick={reset}>
          Réinitialiser
        </button>
      </h4>

      <div className="algo-sliders">
        <AlgoSlider leftLabel="Récence" rightLabel="Profondeur" value={sliders.depth} onChange={(v) => setSlider("depth", v)} />
        <AlgoSlider leftLabel="Proximité" rightLabel="Découverte" value={sliders.discovery} onChange={(v) => setSlider("discovery", v)} />
        <AlgoSlider leftLabel="Consensus" rightLabel="Controverse" value={sliders.controversy} onChange={(v) => setSlider("controversy", v)} />
      </div>

      <div className="algo-summary">
        <div className="summary-lbl">Vous lisez actuellement</div>
        <p className="summary-txt">{renderSummary(describeFeed(sliders))}</p>
      </div>

      <div className="algo-toggles">
        <label className="togglet">
          <input type="checkbox" checked={showReason} onChange={(e) => onToggleReason(e.target.checked)} />
          <span className="sw" aria-hidden />
          <span>Raison de remontée</span>
        </label>
        <label className="togglet">
          <input
            type="checkbox"
            checked={showReputation}
            onChange={(e) => onToggleReputation(e.target.checked)}
          />
          <span className="sw" aria-hidden />
          <span>Réputation des auteurs</span>
        </label>
      </div>
    </div>
  );
}
