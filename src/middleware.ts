import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: "/login",
    },
});

export const config = {
    // Protegemos todas las rutas excepto las estáticas, API, favicon y la página de login
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|public).*)"],
};
