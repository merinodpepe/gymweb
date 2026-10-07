import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-7xl text-accent">404</p>
      <p className="text-strong">No existe esta página.</p>
      <Link href="/" className="underline">
        Volver al dashboard
      </Link>
    </main>
  );
}
