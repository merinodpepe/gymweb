import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: "linear-gradient(rgba(10,10,10,.82), rgba(10,10,10,.92)), url(/img/hero-1.jpg)" }}
    >
      <div className="w-full max-w-sm rounded-lg border border-[#363636] bg-[#151515]/95 p-6 text-[#c4c4c4] shadow-2xl">
        <h1 className="mb-6">
          <BrandLogo className="h-14" priority />
        </h1>
        <LoginForm />
      </div>
    </main>
  );
}
