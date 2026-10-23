# Firebase

One Firebase project backs every Fewer Labs game. Players sign in anonymously.

- `firestore.rules` covers each player's private cloud save at `players/{uid}/saves/{game}` and the public `leaderboards/{game}/scores/{uid}` rows, where a best can only go up. Add new game ids to `knownGame()`.
- `firebase.json` configures the auth (9099) and Firestore (8080) emulators. `.firebaserc` defaults to the `demo-fewerlabs` project, which is emulator-only.

```bash
firebase emulators:start --only auth,firestore      # local testing, no real project needed
firebase deploy --only firestore:rules --project <your-project-id>
```

The client lives in each game's `src/core/cloud.ts` (see `deep-dive/README.md`).
