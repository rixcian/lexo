# lexo

A self-hosted, installable flashcard app. Spaced repetition with FSRS, deck
import from Anki `.apkg` or plain CSV, and study stats - all backed by a single
SQLite file you own.

Language-agnostic: a deck is just a front, a back and two free-form language
labels, so Spanish vocab, kanji and capital cities all live side by side.

## Stack

| Piece | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, server actions) |
| UI | [coss.com/ui](https://coss.com/ui) (Base UI + Tailwind CSS v4), re-themed |
| Design system | `DESIGN.md` - the Duolingo spec, treated as the source of truth |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Scheduler | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) |
| Packaging | Multi-stage Dockerfile, standalone Next output |

## Running it

### Docker (how you will actually run it)

```bash
docker compose up -d --build
```

Then open <http://localhost:3000>. The collection lives in the `lexo-data`
volume at `/data/anki.db`; migrations run automatically on first boot.

Set `TZ` in `.env` (see `.env.example`) to your own timezone - the study day
rolls over at 04:00 local time, and streaks depend on it.

### Portainer (a server you already run)

Two free routes. Both keep the collection in a named `lexo-data` volume.

**A. Pull a prebuilt image (recommended).** [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml)
builds on every push to `main` and pushes `ghcr.io/rixcian/lexo:latest` to the
GitHub Container Registry - free for public repos, and the server never builds
anything. After the first run, open the package on GitHub and set its
visibility to **Public**, otherwise Portainer needs registry credentials.

In Portainer: **Stacks -> Add stack -> Web editor**, paste
[`docker-compose.portainer.yml`](docker-compose.portainer.yml), deploy. To
update later, hit **Pull and redeploy** (or wire the stack's webhook into the
workflow).

**B. Let the server build from git.** In Portainer: **Stacks -> Add stack ->
Repository**, point it at `https://github.com/rixcian/lexo`, compose path
`docker-compose.yml`. Portainer clones the repo and builds on the box - no
registry at all, but it needs roughly 2 GB of free RAM and a few minutes per
deploy.

> **HTTPS is what makes it installable.** Service workers and "Add to home
> screen" only work in a secure context, so over plain `http://<server-ip>:3000`
> the app runs but will not install as a PWA. On a tailnet the cheapest fix is
> Tailscale's own certificate:
>
> ```bash
> tailscale serve --bg 3000
> ```
>
> That publishes `https://<host>.<tailnet>.ts.net` with a real Let's Encrypt
> cert, and the app installs from there on a phone. Off the tailnet, terminate
> TLS with Caddy, Traefik or a Cloudflare Tunnel instead.
>
> There is also no login, so keep it on the tailnet or the LAN - anyone who can
> reach the port can read and edit your cards.

### Adding it to a stack you already have

It is just another service. Match your stack's conventions - a bind mount
rather than a named volume, and a host port that is free:

```yaml
  # lexo - Spaced Repetition
  lexo:
    image: ghcr.io/rixcian/lexo:latest
    container_name: lexo
    ports:
      - 3030:3000
    environment:
      - TZ=${TZ:-Europe/Prague}
      - ANKI_DB_PATH=/data/anki.db
    volumes:
      - ${BASE_PATH}/lexo/data:/data
    restart: unless-stopped
```

The image carries its own `HEALTHCHECK`, so there is nothing else to declare.

**The one gotcha: bind mounts and ownership.** Unlike linuxserver-style images
this one ignores `PUID`/`PGID` and runs fixed as uid 1000. Docker creates a
missing host directory as root, and the app then cannot create its database -
so create it yourself first:

```bash
mkdir -p "${BASE_PATH}/lexo/data" && sudo chown -R 1000:1000 "${BASE_PATH}/lexo/data"
```

If the directory is wrong, the container logs say exactly which uid owns what
and what to run. Named volumes do not have this problem - they inherit the
image's ownership.

### Local development

```bash
npm install
npm run dev
```

The database is created at `./data/anki.db` on first request.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate SQL migrations after editing `src/db/schema.ts` |
| `npm run db:studio` | Drizzle Studio against the local DB |
| `npm run icons` | Re-rasterize the PWA icons from `public/icons/icon.svg` |

## Importing decks

**CSV / TSV** - a `front` and a `back` column are all that is required;
`extra` and `tags` are optional. The header row is optional too, and the
separator, header flag and column mapping can all be corrected in the UI after
uploading. There is a sample at [`examples/spanish-starter.csv`](examples/spanish-starter.csv).

```csv
front,back,extra,tags
el perro,the dog,El perro corre por el parque.,animals noun
```

**Anki `.apkg`** - both the plain-SQLite collections (`collection.anki2`,
`collection.anki21`) and the zstd-compressed `collection.anki21b` written by
modern Anki are read. Deck hierarchy is preserved as `Parent::Child`, field
HTML is flattened to text, and each deck in the package can become its own deck
here or be merged into one.

Not imported: **media files** (images and `[sound:…]` references are stripped,
and the UI tells you how many), note templates, and the original scheduling
history - every imported card starts as New under this app's own scheduler.

Imports are idempotent: a note is fingerprinted on its normalized front+back,
so re-importing an updated file adds only what is new.

## Scheduling

Cards are scheduled with FSRS, the algorithm modern Anki defaults to. Each
review records the full log row (rating, stability, difficulty, elapsed and
scheduled days), which is what every statistic is computed from - nothing is
cached or denormalized.

- Four grades: Again / Hard / Good / Easy, keyboard `1`-`4`, `Space` to flip
  and then `Space` again for Good.
- Cards that come due within 20 minutes are replayed later in the same session,
  the way Anki's learning steps work.
- Per-deck daily caps for new cards and reviews; learning cards are never
  capped, so a step always gets finished.

## PWA

The app is installable (manifest, maskable icons, standalone display). The
service worker precaches the shell and static assets and falls back to an
offline page for navigations.

It deliberately does **not** cache card data: server-side SQLite is the single
source of truth, so there is no second copy to drift or to resolve conflicts
against. Reviewing needs the server reachable.

## Data and backups

Everything is one SQLite file. To back it up, stop the app and copy
`anki.db` along with its `-wal` and `-shm` siblings:

```bash
docker compose stop
docker run --rm -v lexo-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/lexo-backup.tar.gz -C /data .
docker compose start
```

The Settings page shows the live database path.

## Layout

```
src/
  app/                     routes (home, decks, study, stats, import, settings)
  components/
    ui/                    coss.com/ui components (copy-paste, yours to edit)
    duo/                   mascot, pills, deck card
    study/                 session runner and confetti
    stats/                 charts
  db/                      drizzle schema + lazily-opened connection
  lib/
    scheduler.ts           ts-fsrs wrapper - the only place FSRS is touched
    queries.ts             read paths (deck counts, queue building, browsing)
    actions.ts             server actions (decks, notes, grading)
    stats.ts               every statistic, computed from the review log
    import/                CSV and .apkg parsers, staging, ingestion
drizzle/                   generated SQL migrations (shipped in the image)
```

## Design

`DESIGN.md` (the Duolingo spec) is the visual source of truth. The coss.com/ui
token layer in `src/app/globals.css` is re-themed to it: Feather Green
`#58cc02` as the only primary CTA color, the five-accent gamification
vocabulary (streak orange, heart red, XP gold, Super purple, Macaw blue), and
the signature flat-color drop shadow under every button - press translates 2px
and trims the shadow, never fades opacity.

Dark mode follows the brand's published dark guidance (section 12) rather than
the light-only web rule, since a study app gets used at night.
