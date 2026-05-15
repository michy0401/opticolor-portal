import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;

        const isSupervisor = token?.nivel === 4 || token?.rol === "SUPERVISOR";

        // Proteger rutas de Configuración para el rol SUPERVISOR
        if (isSupervisor && (path.startsWith("/dashboard/usuarios") || path.startsWith("/dashboard/sucursales"))) {
            return NextResponse.redirect(new URL("/dashboard/resumen-comercial", req.url));
        }

        return NextResponse.next();
    },
    {
        pages: {
            signIn: "/login",
        },
    }
);

export const config = {
    // Excluye: rutas de API, assets de Next.js (_next/static, _next/image),
    // favicon y la página de login (evita bucles de redirección).
    // Los archivos de /public se sirven en rutas raíz (/logo.png) y Next.js
    // los optimiza antes de llegar al middleware; no necesitan exclusión explícita.
    matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|login).*)"],
};
