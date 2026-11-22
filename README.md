# Psych

A bluffing trivia game for phones. Everyone gets a weird question, writes a fake answer that sounds real, then votes on which answer is true. Built for 3+ players, no accounts, no app install.

## How to play

1. One person opens the site and taps **Start a new room**. Everyone else opens the same site (or the shared invite link) and enters the 4-letter code.
2. Each round: write a fake answer, then vote for the one you think is real.
3. **+2** for picking the truth, **+1** for every player your fake fools. Identical fakes are merged, and both authors get credit.

The host's phone runs the game (peer-to-peer over WebRTC via [PeerJS](https://peerjs.com/)), so the host should keep the tab open. Guests who refresh or drop out rejoin automatically.

## Local dev

```bash
npm install
npm run dev
node test/engine.test.ts   # game rules
```

Open `http://127.0.0.1:5173/Mvpbuild/?mem` in several tabs of the same browser to test without WebRTC (`?mem` syncs tabs through BroadcastChannel).

## Adding questions

Edit `src/game/questions.ts`. Each entry is `{ prompt, answer }`; the real answer should be short.

## GitHub Pages

Deploys from `main` via Actions: https://theloshburger-sudo.github.io/Mvpbuild/
