import NavBar from "@/components/NavBar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BankrollProvider } from "@/components/BankrollProvider";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {

  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
        bankroll: true,
        username: true,
        name: true,
    }
  });

  if (!user) {
    redirect("/auth/sign-in");
  }

  return (
    <BankrollProvider initialBankroll={user.bankroll.toFixed(2)}>
      <NavBar username={user.username} />
      <main className="pt-20 pb-10">{children}</main>
    </BankrollProvider>
  )
}