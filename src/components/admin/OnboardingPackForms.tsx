"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type PackFormState,
  addPackItemAction,
  createPackAction,
  updatePackAction,
} from "@/app/actions/onboarding-packs";
import type { OnboardingItemType, PackView } from "@/lib/onboarding-packs";
import { useActionMessage, useT } from "@/components/I18nProvider";

const inputClass =
  "w-full rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/25 focus:outline-none focus:ring-2 focus:ring-foreground/40";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t.forms.saving : label}
    </button>
  );
}

function ErrorLine({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {message}
    </p>
  );
}

const TYPES: OnboardingItemType[] = ["marge", "fediverse", "rss", "youtube"];

export function CreatePackForm() {
  const { t } = useT();
  const a = t.admin;
  const msg = useActionMessage();
  const [state, action] = useActionState<PackFormState, FormData>(
    createPackAction,
    {},
  );
  return (
    <form action={action} className="flex max-w-lg flex-col gap-3">
      <ErrorLine message={msg(state.error)} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        {a.packName}
        <input name="name" required className={inputClass} placeholder={a.packNamePlaceholder} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {a.packTag}
        <input name="tag" className={inputClass} placeholder={a.packTagPlaceholder} />
      </label>
      <div>
        <Submit label={a.createPack} />
      </div>
    </form>
  );
}

export function PackSettingsForm({ pack }: { pack: PackView }) {
  const { t } = useT();
  const a = t.admin;
  const msg = useActionMessage();
  const [state, action] = useActionState<PackFormState, FormData>(
    updatePackAction,
    {},
  );
  return (
    <form action={action} className="flex max-w-lg flex-col gap-3">
      <input type="hidden" name="id" value={pack.id} />
      <ErrorLine message={msg(state.error)} />
      {state.success && (
        <p className="text-sm text-green-700 dark:text-green-400">{t.pageEditor.saved}</p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        {a.packName}
        <input
          name="name"
          required
          defaultValue={pack.name}
          className={inputClass}
          placeholder={a.packNamePlaceholder}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {a.packTag}
        <input
          name="tag"
          defaultValue={pack.tag}
          className={inputClass}
          placeholder={a.packTagPlaceholder}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={pack.enabled} />
        {a.packEnabled}
      </label>
      <div>
        <Submit label={a.savePack} />
      </div>
    </form>
  );
}

export function AddItemForm({ packId }: { packId: string }) {
  const { t } = useT();
  const a = t.admin;
  const msg = useActionMessage();
  const [state, action] = useActionState<PackFormState, FormData>(
    addPackItemAction,
    {},
  );
  const typeLabel: Record<OnboardingItemType, string> = {
    marge: a.packTypeMarge,
    fediverse: a.packTypeFediverse,
    rss: a.packTypeRss,
    youtube: a.packTypeYoutube,
  };
  return (
    <form action={action} className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10">
      <input type="hidden" name="packId" value={packId} />
      <ErrorLine message={msg(state.error)} />
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {a.packItemType}
          <select name="type" className={inputClass} defaultValue="marge">
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {typeLabel[ty]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {a.packItemLabel}
          <input
            name="label"
            required
            className={inputClass}
            placeholder={a.packItemLabelPlaceholder}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {a.packItemRef}
        <input
          name="ref"
          required
          className={inputClass}
          placeholder={a.packItemRefPlaceholder}
        />
        <span className="text-xs font-normal text-black/55 dark:text-white/55">
          {a.packItemRefHint}
        </span>
      </label>
      <div>
        <Submit label={a.addPackItem} />
      </div>
    </form>
  );
}
