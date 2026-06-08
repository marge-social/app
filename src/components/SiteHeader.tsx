import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { countUnreadNotifications } from "@/lib/notifications";
import { HeaderNav } from "@/components/HeaderNav";
import { getServerI18n } from "@/lib/i18n/server";

/** En-tête global. La navigation (responsive : barre sur grand écran, menu
 *  déroulant sur smartphone) est rendue par `HeaderNav` (client). */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await countUnreadNotifications(user.id) : 0;
  const { dict } = await getServerI18n();

  return (
    <header className="relative z-50 border-b border-black/10 bg-background dark:border-white/15">
      <nav
        aria-label={dict.nav.mainLabel}
        className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3"
      >
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Marge
        </Link>
        <HeaderNav
          user={user ? { handle: user.handle, role: user.role } : null}
          unread={unread}
        />
      </nav>
    </header>
  );
}
