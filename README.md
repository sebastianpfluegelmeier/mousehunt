# Cat & Mouse

A small iPad web game: you steer a mouse through a maze to its hole on the far side, your cat tries to catch it by pawing at the screen. Under a bridge the mouse is safe.

- **Human:** drag in the control strip (or use arrow keys / WASD).
- **Cat:** any touch on the maze. Touching the mouse catches it; touching anywhere else makes sparkles.

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` listens on your local network, so you can open the printed address on the iPad.

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages via `.github/workflows/deploy.yml`.

## iPad tips

- Share → Add to Home Screen runs it full screen without Safari's bars and swipe-back gesture.
- Guided Access (Settings → Accessibility → Guided Access, then triple-click the top button) stops the cat from leaving the app.
