import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { RegisterForm } from "@/components/account/register-form";
import { Mascot } from "@/components/duo/mascot";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/auth/session";
import { listUsers } from "@/lib/auth/users";

export const metadata: Metadata = { title: "New account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const first = listUsers().length === 0;
  // Adding the second person is done from Settings, by someone already signed
  // in - so "back" has to lead where they actually came from.
  const signedIn = Boolean(await currentUser());

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-8 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <Mascot bob className="size-28" mood={first ? "happy" : "thinking"} />
        <h1 className="type-h1 text-card-foreground">
          {first ? "Welcome - pick a name" : "Add an account"}
        </h1>
        <p className="type-body-lg text-muted-foreground">
          {signedIn
            ? "They pick their name to sign in - you stay signed in as you."
            : "A name is all it takes. There is no password to forget."}
        </p>
      </div>

      <RegisterForm adding={signedIn} first={first} />

      {first ? null : (
        <Button
          render={<Link href={signedIn ? "/settings" : "/login"} />}
          size="duo"
          variant="duo-ghost"
        >
          <ArrowLeft />
          {signedIn ? "Back to settings" : "Back to sign in"}
        </Button>
      )}
    </div>
  );
}
