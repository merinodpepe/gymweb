"use client";

import { Dumbbell, FileUp, Footprints, LayoutDashboard, Database, Salad } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./theme-toggle";

const ITEMS = [
  { href: "/", label: "Dashboard", short: "Inicio", icon: LayoutDashboard },
  { href: "/entrenos", label: "Entrenos", icon: Dumbbell },
  { href: "/carrera", label: "Carrera", icon: Footprints },
  { href: "/nutricion", label: "Nutrición", icon: Salad },
  { href: "/importar", label: "Importar", icon: FileUp },
  { href: "/datos", label: "Datos", icon: Database },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function NavSidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
      <Link href="/" className="flex items-center gap-2 px-6 py-6">
        <Dumbbell aria-hidden className="size-6 text-accent" />
        <span className="font-display text-2xl text-strong">
          Gym<span className="text-accent">Web</span>
        </span>
      </Link>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 px-3">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 font-display text-sm text-text hover:bg-surface-2 hover:text-strong",
              isActive(path, href) && "bg-surface-2 text-strong shadow-[inset_3px_0_0_var(--accent)]",
            )}
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center justify-between gap-2 border-t border-border p-3">
        <ThemeToggle />
        <form action="/api/auth/logout" method="post">
          <button className="min-h-11 rounded-md px-3 text-xs uppercase tracking-wide text-muted hover:text-strong">
            Salir
          </button>
        </form>
      </div>
    </aside>
  );
}

export function NavBottom() {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {ITEMS.map(({ href, label, short, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(path, href) ? "page" : undefined}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] uppercase tracking-wide text-muted",
            isActive(path, href) && "text-accent",
          )}
        >
          <Icon aria-hidden className="size-5" />
          {short ?? label}
        </Link>
      ))}
    </nav>
  );
}
