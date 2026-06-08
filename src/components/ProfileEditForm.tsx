"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type ProfileFormState,
  updateProfileAction,
} from "@/app/actions/profile";
import { useActionMessage, useT } from "@/components/I18nProvider";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
    >
      {pending ? t.forms.saving : t.forms.save}
    </button>
  );
}

export function ProfileEditForm({
  displayName,
  bio,
}: {
  displayName: string;
  bio: string;
}) {
  const [state, action] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    {},
  );
  const { t } = useT();
  const msg = useActionMessage();
  const f = t.forms;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className="text-sm font-medium">
          {f.profileDisplayName}
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={80}
          className="rounded border border-black/20 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/25"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="bio" className="text-sm font-medium">
          {f.profileBio}
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={bio}
          rows={3}
          maxLength={500}
          className="resize-y rounded border border-black/20 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-foreground/40 focus:outline-none dark:border-white/25"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="avatar" className="text-sm font-medium">
          {f.profileAvatar}
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="text-sm"
        />
        <p className="text-xs text-foreground/55">{f.profileAvatarHint}</p>
      </div>

      <SubmitButton />

      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {msg(state.error, state.errorParams)}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {msg(state.success)}
        </p>
      )}
    </form>
  );
}
