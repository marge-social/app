import { Container } from "@/components/Container";

/** Conteneur centré pour les pages d'authentification (login, signup) sous le
 *  shell global pleine largeur. Les formulaires se recentrent eux-mêmes. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Container>{children}</Container>;
}
