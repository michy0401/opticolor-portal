import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    rol?: string;
    nivel?: number;
  }

  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      rol?: string;
      nivel?: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    rol?: string;
    nivel?: number;
  }
}
