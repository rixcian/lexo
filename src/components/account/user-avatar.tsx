import { DECK_COLOR_CLASS } from "@/lib/colors";
import { userAccent, userInitials } from "@/lib/auth/avatar";
import { cn } from "@/lib/utils";

/**
 * An initial on the account's accent. There are no uploaded pictures - two
 * people never need to tell each other apart by face.
 */
export function UserAvatar({
  userId,
  username,
  className,
}: {
  userId: number;
  username: string;
  className?: string;
}) {
  const accent = userAccent(userId);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full font-bold text-[13px] tracking-[0.02em]",
        DECK_COLOR_CLASS[accent].bg,
        accent === "xp" ? "text-[#3c3c3c]" : "text-white",
        className,
      )}
    >
      {userInitials(username)}
    </span>
  );
}
