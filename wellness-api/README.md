# wellness-api (Convex backend)

The server behind `/wellness` and `/wellness/exp0`: two tables, `days` (one
document per day for `/wellness`, ops `days.list` and `days.save`, rules in
`wellness/spec.js`) and `bio` (Exp 0), and one
door at `https://<deployment>.convex.site/overlap` that answers `bio.get`,
`bio.unlock` and `bio.save`. The door keeps its old `/overlap` path so the
pages need no change.

Deploy: `cd wellness-api && npx convex deploy`.
