import Image from "next/image";
import logoImg from "@/app/logo_opticolor.webp";
import { LoginForm } from "@/app/(main)/auth/_components/login-form";

export const metadata = {
  title: "Iniciar Sesión",
  description: "Inicia sesión en tu cuenta",
};

export default function LoginPage() {
  return (
    <div className="flex w-full max-w-sm flex-col justify-center gap-6 px-4 m-auto">
      <div className="flex flex-col space-y-2 text-center">
        <div className="mx-auto mb-2">
          <Image src={logoImg} alt="Opticolor Logo" width={180} height={80} priority className="object-contain" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Iniciar Sesión</h1>
        <p className="text-sm text-muted-foreground">
          Ingresa tu correo y contraseña para acceder.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
