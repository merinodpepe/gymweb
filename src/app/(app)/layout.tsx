import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { NavBottom, NavSidebar } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
      >
        Saltar al contenido
      </a>
      <NavSidebar />
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Dumbbell aria-hidden className="size-5 text-accent" />
          <span className="font-display text-xl text-strong">
            Gym<span className="text-accent">Web</span>
          </span>
        </Link>
        <div className="flex items-center">
          <ThemeToggle />
          <form action="/api/auth/logout" method="post">
            <button className="min-h-11 px-2 text-xs uppercase tracking-wide text-muted hover:text-strong">Salir</button>
          </form>
        </div>
      </header>
      <div className="lg:pl-60">
        <main id="main" className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:px-10">
          {children}
        </main>
        <footer className="px-4 pb-24 text-center text-xs text-muted lg:pb-6">
        Diseño basado en la plantilla Gymlife de{" "}
        <a className="underline hover:text-strong" href="https://colorlib.com" rel="noopener noreferrer" target="_blank">
          Colorlib
        </a>
          .
        </footer>
      </div>
      <NavBottom />
    </>
  );
}
