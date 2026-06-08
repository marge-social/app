import { setLocaleAction } from "@/app/actions/i18n";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";

/**
 * Sélecteur de langue sans JavaScript : un bouton par langue dans un petit
 * formulaire qui appelle la server action. La langue active est mise en avant
 * (et désactivée). Après l'action, `revalidatePath` rafraîchit toute l'UI.
 */
export function LocaleSwitcher({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  return (
    <form
      action={setLocaleAction}
      className="flex items-center gap-1"
      aria-label={label}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="submit"
            name="locale"
            value={locale}
            disabled={active}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "rounded px-1.5 py-0.5 font-medium text-foreground"
                : "rounded px-1.5 py-0.5 text-foreground/55 hover:text-foreground hover:underline"
            }
            // Code court (FR/EN) comme libellé visible, langue complète en titre.
            title={LOCALE_LABELS[locale]}
          >
            {locale.toUpperCase()}
          </button>
        );
      })}
    </form>
  );
}
