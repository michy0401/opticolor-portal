import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export type AuthContext = {
  userId: number;
  isSupervisor: boolean;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    userId: parseInt(session.user.id, 10),
    isSupervisor: session.user.nivel === 4 || session.user.rol === "SUPERVISOR",
  };
}
