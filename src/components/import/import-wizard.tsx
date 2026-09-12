"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, Loader2, Upload } from "lucide-react";
import { Pill } from "@/components/duo/chips";
import { Mascot } from "@/components/duo/mascot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastManager } from "@/components/ui/toast";
import {
  confirmImportAction,
  previewImportAction,
  uploadImportAction,
} from "@/lib/import/actions";
import type { ImportPreview } from "@/lib/import/preview-types";
import type { ImportSummary } from "@/lib/import/types";
import { DECK_COLORS, DECK_COLOR_CLASS, DECK_COLOR_LABEL } from "@/lib/colors";
import { cn } from "@/lib/utils";

interface DeckOption {
  id: number;
  name: string;
}

const DELIMITER_OPTIONS = [
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
] as const;

const selectClass =
  "h-12 w-full rounded-xl border-2 border-input bg-card px-3 text-sm text-foreground focus-visible:border-brand focus-visible:outline-none";

export function ImportWizard({ decks }: { decks: DeckOption[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summaries, setSummaries] = useState<ImportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [working, startWork] = useTransition();

  // Options
  const [deckName, setDeckName] = useState("");
  const [targetDeckId, setTargetDeckId] = useState<string>("new");
  const [mergeApkg, setMergeApkg] = useState(false);
  const [frontLang, setFrontLang] = useState("");
  const [backLang, setBackLang] = useState("");
  const [color, setColor] = useState<string>("brand");
  const [reverseCards, setReverseCards] = useState(false);

  function upload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    setError(null);

    startUpload(async () => {
      const result = await uploadImportAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.preview);
      setDeckName(result.preview.decks[0]?.name ?? "Imported deck");
      setMergeApkg(false);
    });
  }

  function remapCsv(next: {
    delimiter?: string;
    hasHeader?: boolean;
    columns?: { front: number; back: number; extra: number; tags: number };
  }) {
    if (!preview?.csv) return;
    const merged = {
      delimiter: (next.delimiter ?? preview.csv.delimiter) as never,
      hasHeader: next.hasHeader ?? preview.csv.hasHeader,
      columns: next.columns ?? preview.csv.columns,
      deckName,
    };

    startWork(async () => {
      const result = await previewImportAction(preview.token, merged);
      if (result.ok) setPreview(result.preview);
      else setError(result.error);
    });
  }

  function confirm() {
    if (!preview) return;
    setError(null);

    startWork(async () => {
      const result = await confirmImportAction(preview.token, {
        targetDeckId:
          targetDeckId === "new" ? undefined : Number(targetDeckId),
        mergeInto:
          targetDeckId !== "new"
            ? undefined
            : preview.kind === "csv" || mergeApkg
              ? deckName
              : undefined,
        color,
        frontLang,
        backLang,
        reverseCards,
        csv: preview.csv
          ? {
              delimiter: preview.csv.delimiter,
              hasHeader: preview.csv.hasHeader,
              columns: preview.csv.columns,
              deckName,
            }
          : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummaries(result.summaries);
      setPreview(null);
      toastManager.add({ title: "Deck imported", type: "success" });
      router.refresh();
    });
  }

  if (summaries) {
    return <ImportDone summaries={summaries} onAgain={() => setSummaries(null)} />;
  }

  if (!preview) {
    return (
      <div className="flex flex-col gap-6">
        <label
          className="flex cursor-pointer flex-col items-center gap-4 rounded-[24px] border-2 border-dashed border-input bg-card px-6 py-16 text-center transition-colors hover:border-brand hover:bg-brand/4"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) upload(file);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.apkg,.colpkg,text/csv,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
          />
          {uploading ? (
            <Loader2 className="size-10 animate-spin text-brand" />
          ) : (
            <FileUp className="size-10 text-brand" />
          )}
          <span className="type-h3 text-card-foreground">
            {uploading ? "Reading the file..." : "Drop a deck file here"}
          </span>
          <span className="type-body text-muted-foreground">
            .apkg from Anki, or a CSV / TSV with a front and a back column.
          </span>
          <Button
            variant="duo"
            size="duo"
            type="button"
            render={<span />}
            className="mt-2"
          >
            <Upload />
            Choose a file
          </Button>
        </label>

        {error ? <ErrorNote message={error} /> : null}
      </div>
    );
  }

  const importingToExisting = targetDeckId !== "new";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="macaw">{preview.kind === "apkg" ? "Anki package" : "CSV"}</Pill>
        <span className="type-body-bold">{preview.filename}</span>
        <Pill tone="outline">{preview.totalNotes} cards found</Pill>
      </div>

      {preview.warnings.map((warning) => (
        <p
          key={warning}
          className="type-body-sm rounded-xl border-l-4 border-streak bg-bg-warm px-4 py-3 text-[#4b4b4b]"
        >
          {warning}
        </p>
      ))}

      {preview.csv ? (
        <section className="flex flex-col gap-5 rounded-[20px] bg-card p-6 shadow-card">
          <h2 className="type-h3 text-card-foreground">Columns</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="type-label" htmlFor="delimiter">
                Separator
              </Label>
              <select
                id="delimiter"
                className={selectClass}
                value={preview.csv.delimiter}
                onChange={(event) => remapCsv({ delimiter: event.target.value })}
              >
                {DELIMITER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 self-end rounded-xl border-2 border-border px-4 py-3">
              <input
                type="checkbox"
                checked={preview.csv.hasHeader}
                onChange={(event) =>
                  remapCsv({ hasHeader: event.target.checked })
                }
                className="size-5 accent-[var(--brand)]"
              />
              <span className="type-label">First row is a header</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(["front", "back", "extra", "tags"] as const).map((field) => (
              <div key={field} className="grid gap-2">
                <Label className="type-label capitalize" htmlFor={`col-${field}`}>
                  {field}
                </Label>
                <select
                  id={`col-${field}`}
                  className={selectClass}
                  value={preview.csv?.columns[field] ?? -1}
                  onChange={(event) =>
                    remapCsv({
                      columns: {
                        ...preview.csv!.columns,
                        [field]: Number(event.target.value),
                      },
                    })
                  }
                >
                  {field === "extra" || field === "tags" ? (
                    <option value={-1}>Not used</option>
                  ) : null}
                  {Array.from({ length: preview.csv!.columnCount }, (_, i) => (
                    <option key={i} value={i}>
                      {preview.csv?.header[i] || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-[20px] bg-card p-6 shadow-card">
        <h2 className="type-h3 text-card-foreground">Preview</h2>
        {preview.decks.slice(0, 6).map((deck) => (
          <div key={deck.name} className="flex flex-col gap-2">
            {preview.kind === "apkg" ? (
              <p className="type-label">
                {deck.name}{" "}
                <span className="text-muted-foreground">
                  ({deck.total} cards)
                </span>
              </p>
            ) : null}
            <ul className="flex flex-col gap-1">
              {deck.sample.map((note, index) => (
                <li
                  key={`${deck.name}-${index}`}
                  className="type-body-sm flex gap-3 rounded-lg bg-secondary px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {note.front}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {note.back}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {preview.decks.length > 6 ? (
          <p className="type-caption text-muted-foreground">
            ...and {preview.decks.length - 6} more decks.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-5 rounded-[20px] bg-card p-6 shadow-card">
        <h2 className="type-h3 text-card-foreground">Where it goes</h2>

        <div className="grid gap-2">
          <Label className="type-label" htmlFor="target">
            Destination
          </Label>
          <select
            id="target"
            className={selectClass}
            value={targetDeckId}
            onChange={(event) => setTargetDeckId(event.target.value)}
          >
            <option value="new">
              {preview.kind === "apkg" && !mergeApkg
                ? "New deck per deck in the file"
                : "A new deck"}
            </option>
            {decks.map((deck) => (
              <option key={deck.id} value={String(deck.id)}>
                Add to: {deck.name}
              </option>
            ))}
          </select>
        </div>

        {!importingToExisting && preview.kind === "apkg" ? (
          <label className="flex items-center gap-3 rounded-xl border-2 border-border px-4 py-3">
            <input
              type="checkbox"
              checked={mergeApkg}
              onChange={(event) => setMergeApkg(event.target.checked)}
              className="size-5 accent-[var(--brand)]"
            />
            <span className="type-label">
              Merge all {preview.decks.length} decks into one
            </span>
          </label>
        ) : null}

        {!importingToExisting &&
        (preview.kind === "csv" || mergeApkg) ? (
          <div className="grid gap-2">
            <Label className="type-label" htmlFor="deck-name">
              Deck name
            </Label>
            <Input
              id="deck-name"
              value={deckName}
              onChange={(event) => setDeckName(event.target.value)}
              className="h-12 rounded-xl border-2"
            />
          </div>
        ) : null}

        {!importingToExisting ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="type-label" htmlFor="import-front-lang">
                  Front language
                </Label>
                <Input
                  id="import-front-lang"
                  value={frontLang}
                  onChange={(event) => setFrontLang(event.target.value)}
                  placeholder="Spanish"
                  className="h-12 rounded-xl border-2"
                />
              </div>
              <div className="grid gap-2">
                <Label className="type-label" htmlFor="import-back-lang">
                  Back language
                </Label>
                <Input
                  id="import-back-lang"
                  value={backLang}
                  onChange={(event) => setBackLang(event.target.value)}
                  placeholder="English"
                  className="h-12 rounded-xl border-2"
                />
              </div>
            </div>

            <fieldset className="grid gap-3">
              <legend className="type-label mb-2">Unit color</legend>
              <div className="flex flex-wrap gap-3">
                {DECK_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={DECK_COLOR_LABEL[option]}
                    aria-pressed={color === option}
                    onClick={() => setColor(option)}
                    className={cn(
                      "size-11 rounded-full border-4 transition-transform focus-visible:ring-3 focus-visible:ring-macaw focus-visible:ring-offset-2 focus-visible:outline-none",
                      DECK_COLOR_CLASS[option].dot,
                      color === option
                        ? "border-foreground/20"
                        : "border-transparent",
                    )}
                  />
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-3 rounded-xl border-2 border-border p-4">
              <input
                type="checkbox"
                checked={reverseCards}
                onChange={(event) => setReverseCards(event.target.checked)}
                className="mt-1 size-5 accent-[var(--brand)]"
              />
              <span>
                <span className="type-label block">
                  Also study back to front
                </span>
                <span className="type-caption block text-muted-foreground">
                  Doubles the number of cards created.
                </span>
              </span>
            </label>
          </>
        ) : null}
      </section>

      {error ? <ErrorNote message={error} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="duo"
          size="duo-lg"
          loading={working}
          onClick={confirm}
          disabled={preview.totalNotes === 0}
        >
          Import {preview.totalNotes} card{preview.totalNotes === 1 ? "" : "s"}
        </Button>
        <Button
          variant="duo-ghost"
          size="duo"
          onClick={() => {
            setPreview(null);
            setError(null);
          }}
        >
          Pick another file
        </Button>
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    // Section 4: toast-style feedback - white bg, 3px left border in the role.
    <div
      role="alert"
      className="rounded-xl border-l-4 border-heart bg-card px-4 py-3 shadow-card"
    >
      <p className="type-body-bold text-card-foreground">Hmm, not quite</p>
      <p className="type-body-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ImportDone({
  summaries,
  onAgain,
}: {
  summaries: ImportSummary[];
  onAgain: () => void;
}) {
  const created = summaries.reduce((n, s) => n + s.created, 0);
  const duplicates = summaries.reduce((n, s) => n + s.duplicates, 0);

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <Mascot mood="happy" className="size-36" />
      <h2 className="type-h1 text-card-foreground">
        {created} card{created === 1 ? "" : "s"} added
      </h2>
      {duplicates > 0 ? (
        <p className="type-body-lg text-muted-foreground">
          {duplicates} duplicate{duplicates === 1 ? " was" : "s were"} skipped.
        </p>
      ) : null}

      <ul className="flex w-full max-w-[560px] flex-col gap-2">
        {summaries.map((summary) => (
          <li
            key={summary.deckId}
            className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-card"
          >
            <Link
              href={`/decks/${summary.deckId}`}
              className="type-body-bold truncate hover:underline"
            >
              {summary.deckName}
            </Link>
            <Pill tone="brand">+{summary.created}</Pill>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          render={<Link href={`/decks/${summaries[0]?.deckId ?? ""}`} />}
          variant="duo"
          size="duo-lg"
        >
          Open the deck
          <ArrowRight />
        </Button>
        <Button variant="duo-secondary" size="duo" onClick={onAgain}>
          Import another
        </Button>
      </div>
    </div>
  );
}
