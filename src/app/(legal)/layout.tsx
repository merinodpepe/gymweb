import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/** Public pages (no login): privacy policy and terms, required by Google's OAuth consent screen. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-text">
      <Link href="/" className="mb-8 flex items-center">
        <BrandLogo className="h-12" priority />
      </Link>
      <article className="space-y-4 leading-relaxed [&_h1]:font-display [&_h1]:text-3xl [&_h1]:text-strong [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-strong [&_li]:ml-5 [&_li]:list-disc [&_a]:text-accent [&_a]:underline">
        {children}
      </article>
      <nav aria-label="Legal" className="mt-10 flex gap-4 border-t border-border pt-4 text-sm">
        <Link href="/privacidad" className="text-accent underline">
          Política de privacidad
        </Link>
        <Link href="/terminos" className="text-accent underline">
          Términos del servicio
        </Link>
      </nav>
    </main>
  );
}
