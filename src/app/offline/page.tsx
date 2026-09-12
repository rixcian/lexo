import type { Metadata } from "next";
import { Mascot } from "@/components/duo/mascot";
import { ReloadWhenOnline } from "@/components/reload-when-online";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-6 py-20 text-center">
      <Mascot mood="sleep" className="size-36" />
      <h1 className="type-h1 text-card-foreground">No connection</h1>
      <p className="type-body-lg text-muted-foreground">
        Your cards live on the server, so reviewing needs a connection. This
        page will refresh itself once you are back.
      </p>
      <p className="type-caption text-muted-foreground">
        Nothing was lost - every answer you gave was saved as you went.
      </p>
      <ReloadWhenOnline />
    </div>
  );
}
