"use client";

import { useTransition } from "react";
import { LogOut, Repeat, UserCog } from "lucide-react";
import { UserAvatar } from "@/components/account/user-avatar";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { signOutAction } from "@/lib/auth/actions";

/**
 * Section 4 puts the account at the right end of the header, next to the
 * streak and the theme toggle. Switching is just signing out - the login
 * screen is a list of names, so there is nothing else to do.
 */
export function AccountMenu({
  userId,
  username,
}: {
  userId: number;
  username: string;
}) {
  const [pending, startTransition] = useTransition();

  const signOut = () => startTransition(async () => void (await signOutAction()));

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Signed in as ${username}`}
        className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-macaw focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-64"
        disabled={pending}
      >
        <UserAvatar userId={userId} username={username} />
      </MenuTrigger>

      <MenuPopup align="end" className="min-w-52">
        <MenuGroup>
          <MenuGroupLabel className="truncate">
            Signed in as <span className="text-foreground">{username}</span>
          </MenuGroupLabel>
          <MenuSeparator />
          <MenuLinkItem href="/settings">
            <UserCog />
            Account settings
          </MenuLinkItem>
          <MenuItem onClick={signOut}>
            <Repeat />
            Switch account
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem onClick={signOut} variant="destructive">
          <LogOut />
          Sign out
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
