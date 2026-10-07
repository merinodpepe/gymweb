import { Dumbbell } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: "linear-gradient(rgba(10,10,10,.82), rgba(10,10,10,.92)), url(/img/hero-1.jpg)" }}
    >
      <div className="w-full max-w-sm rounded-lg border border-[#363636] bg-[#151515]/95 p-6 text-[#c4c4c4] shadow-2xl">
        <div className="mb-6 flex items-center gap-2">
          <Dumbbell aria-hidden className="size-7 text-[#f36100]" />
          <h1 className="font-display text-3xl text-white">
            Gym<span className="text-[#f36100]">Web</span>
          </h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
