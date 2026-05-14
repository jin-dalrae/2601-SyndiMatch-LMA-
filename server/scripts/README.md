# server/scripts

Ad-hoc debug scripts. Not part of the application — run by hand to inspect MongoDB during development.

Each opens a connection via `../db.js` and exits.

| Script | Purpose |
|--------|---------|
| `check_keys.js` | Print top-level keys of one doc from `participants` and `participant_agents` (compare schemas) |
| `check_originator.js` | Same, for `originator` vs `originator_agents` |
| `check_participant_struct.js` | Dump full structure of a `participants` doc |
| `check_syndication.js` | Dump full structure of a `syndication_original` doc |
| `compare_participants.js` | Side-by-side comparison of `participants` vs `participant_agents` schemas |
| `count_participants.js` | Document count in `participant_agents` |
| `list_collections.js` | List all collections in the `syndimatch` DB |

Run from the repo root, e.g.:

```bash
node server/scripts/list_collections.js
```

These exist because the schema doubled up during a half-migration from `*_agents` (legacy) to non-suffixed (current) collection names. The canonical seed in `agents/seed_all.py` populates both name patterns, so the app works either way.

If/when the legacy collection names get removed, these scripts can go too.
