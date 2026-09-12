import Link from "next/link";
import { Mascot } from "@/components/duo/mascot";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-6 py-20 text-center">
      <Mascot mood="thinking" className="size-36" bob />
      <h1 className="type-h1 text-card-foreground">Hmm, nothing here</h1>
      <p className="type-body-lg text-muted-foreground">
        That page does not exist - or the deck it pointed at was deleted.
      </p>
      <Button render={<Link href="/" />} variant="duo" size="duo-lg">
        Back to your decks
      </Button>
    </div>
  );
}
