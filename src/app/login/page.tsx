import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { AccountPicker } from "@/components/account/account-picker";
import { Mascot } from "@/components/duo/mascot";
import { Button } from "@/components/ui/button";
import { listUsers } from "@/lib/auth/users";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const users = listUsers();

  // Nobody has registered yet, so there is no list to pick from.
  if (users.length === 0) redirect("/register");

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-8 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <Mascot bob className="size-28" mood="happy" />
        <h1 className="type-h1 text-card-foreground">Who is studying?</h1>
        <p className="type-body-lg text-muted-foreground">
          Your decks are shared. Your streak is not.
        </p>
      </div>

      <AccountPicker
        users={users.map((user) => ({ id: user.id, username: user.username }))}
      />

      <Button
        render={<Link href="/register" />}
        size="duo"
        variant="duo-ghost"
      >
        <UserPlus />
        Add someone
      </Button>
    </div>
  );
}
