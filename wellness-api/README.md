# wellness-api (Convex backend)

The server behind `/wellness` and `/wellness/exp0`: one table, `bio`, and one
door at `https://<deployment>.convex.site/overlap` that answers `bio.get`,
`bio.unlock` and `bio.save`. The door keeps its old `/overlap` path so the
pages need no change.

Deploy: `cd wellness-api && npx convex deploy`.
