/**
 * Anki's schema 11 - the last one whose `collection.anki2` is plain SQLite
 * with no protobuf blobs in it. Modern Anki still imports a package written
 * at this schema and upgrades it on the way in, which is exactly what
 * "Support older Anki versions" produces on the export side.
 *
 * Reproduced verbatim from Anki's `schema11.sql`; the column set and the NOT
 * NULL constraints are what the importer validates against.
 */
export const SCHEMA_11 = `
CREATE TABLE col (
  id              integer primary key,
  crt             integer not null,
  mod             integer not null,
  scm             integer not null,
  ver             integer not null,
  dty             integer not null,
  usn             integer not null,
  ls              integer not null,
  conf            text not null,
  models          text not null,
  decks           text not null,
  dconf           text not null,
  tags            text not null
);
CREATE TABLE notes (
  id              integer primary key,
  guid            text not null,
  mid             integer not null,
  mod             integer not null,
  usn             integer not null,
  tags            text not null,
  flds            text not null,
  sfld            integer not null,
  csum            integer not null,
  flags           integer not null,
  data            text not null
);
CREATE TABLE cards (
  id              integer primary key,
  nid             integer not null,
  did             integer not null,
  ord             integer not null,
  mod             integer not null,
  usn             integer not null,
  type            integer not null,
  queue           integer not null,
  due             integer not null,
  ivl             integer not null,
  factor          integer not null,
  reps            integer not null,
  lapses          integer not null,
  left            integer not null,
  odue            integer not null,
  odid            integer not null,
  flags           integer not null,
  data            text not null
);
CREATE TABLE revlog (
  id              integer primary key,
  cid             integer not null,
  usn             integer not null,
  ease            integer not null,
  ivl             integer not null,
  lastIvl         integer not null,
  factor          integer not null,
  time            integer not null,
  type            integer not null
);
CREATE TABLE graves (
  usn             integer not null,
  oid             integer not null,
  type            integer not null
);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

/** `col.conf` - collection-wide preferences. */
export function collectionConf(modelId: number, deckId: number) {
  return {
    nextPos: 1,
    estTimes: true,
    activeDecks: [deckId],
    sortType: "noteFld",
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: deckId,
    newBury: true,
    newSpread: 0,
    dueCounts: true,
    curModel: String(modelId),
    collapseTime: 1200,
  };
}

/** `col.dconf` - the one deck preset every exported deck points at. */
export function deckConfig(newPerDay: number, reviewsPerDay: number) {
  return {
    "1": {
      id: 1,
      name: "Default",
      mod: 0,
      usn: 0,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: {
        bury: true,
        delays: [1, 10],
        initialFactor: 2500,
        ints: [1, 4, 7],
        order: 1,
        perDay: newPerDay,
        separate: true,
      },
      rev: {
        bury: true,
        ease4: 1.3,
        fuzz: 0.05,
        ivlFct: 1,
        maxIvl: 36500,
        minSpace: 1,
        perDay: reviewsPerDay,
      },
      lapse: {
        delays: [10],
        leechAction: 0,
        leechFails: 8,
        minInt: 1,
        mult: 0,
      },
      dyn: false,
    },
  };
}

const CARD_CSS = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}
.extra {
  font-size: 16px;
  color: #4b4b4b;
  margin-top: 12px;
}`;

function field(name: string, ord: number) {
  return {
    name,
    ord,
    sticky: false,
    rtl: false,
    font: "Arial",
    size: 20,
    media: [],
    description: "",
  };
}

function template(name: string, ord: number, question: string, answer: string) {
  return {
    name,
    ord,
    qfmt: question,
    afmt: answer,
    did: null,
    bqfmt: "",
    bafmt: "",
    bfont: "",
    bsize: 0,
  };
}

/**
 * A three-field note type (Front / Back / Extra) with one or two cards, so a
 * deck that generates reverse cards here generates them there too.
 *
 * `req` tells Anki which fields a template needs before it will make the card;
 * omitting it makes schema 11 packages fail to import.
 */
export function noteModel(
  modelId: number,
  deckId: number,
  name: string,
  reverse: boolean,
) {
  const extra = `{{#Extra}}<div class="extra">{{Extra}}</div>{{/Extra}}`;

  const templates = [
    template(
      "Card 1",
      0,
      "{{Front}}",
      `{{FrontSide}}\n\n<hr id="answer">\n\n{{Back}}\n${extra}`,
    ),
  ];
  const req: [number, string, number[]][] = [[0, "any", [0]]];

  if (reverse) {
    templates.push(
      template(
        "Card 2",
        1,
        "{{Back}}",
        `{{FrontSide}}\n\n<hr id="answer">\n\n{{Front}}\n${extra}`,
      ),
    );
    req.push([1, "any", [1]]);
  }

  return {
    id: modelId,
    name,
    type: 0,
    mod: Math.floor(Date.now() / 1000),
    usn: -1,
    sortf: 0,
    did: deckId,
    tmpls: templates,
    flds: [field("Front", 0), field("Back", 1), field("Extra", 2)],
    css: CARD_CSS,
    latexPre:
      "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
    latexsvg: false,
    req,
    tags: [],
    vers: [],
  };
}

/** `col.decks` - the exported deck plus the Default deck Anki always expects. */
export function deckList(deckId: number, deckName: string) {
  const base = {
    mod: Math.floor(Date.now() / 1000),
    usn: -1,
    lrnToday: [0, 0],
    revToday: [0, 0],
    newToday: [0, 0],
    timeToday: [0, 0],
    conf: 1,
    desc: "",
    dyn: 0,
    collapsed: false,
    browserCollapsed: false,
    extendNew: 10,
    extendRev: 50,
  };

  return {
    "1": { ...base, id: 1, name: "Default" },
    [String(deckId)]: { ...base, id: deckId, name: deckName },
  };
}
