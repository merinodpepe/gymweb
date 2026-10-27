import Image from "next/image";
import { cn } from "@/lib/cn";

/** Horizontal "Pepe Flock: Gym" logo (viewBox 694×200). Height comes from `className`. */
export function BrandLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/pepe-flock-gym-horizontal.svg"
      alt="Pepe Flock: Gym"
      width={694}
      height={200}
      priority={priority}
      className={cn("h-8 w-auto", className)}
    />
  );
}
