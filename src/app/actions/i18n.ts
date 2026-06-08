"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
} from "@/lib/i18n/config";

/**
 * Change la langue d'interface : pose le cookie `locale` (source primaire) et,
 * pour un utilisateur connecté, persiste la préférence en base (cross-device).
 * N'affecte jamais l'URL ni le contenu fédéré. Le rafraîchissement du layout se
 * fait via `revalidatePath` (le tout repasse par `getLocale`).
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const user = await getCurrentUser();
  if (user) {
    await db.update(users).set({ locale }).where(eq(users.id, user.id));
  }

  revalidatePath("/", "layout");
}
