# Mollemira portfolio

Static portfolio website for `mollemira.com`.

- `/` serves the portfolio homepage.
- `/penta/` serves the interactive Penta web demo.
- `/album/` serves the interactive album demo.
- `/websites/nemesis-minifigures/` serves the Nemesis Minifigures demo.
- `/websites/sniper-duels/` serves the Sniper Duels demo.

Deploy the contents of this folder as the web root on any static host. The Penta demo uses browser storage and downloads; it has no server-side project storage. It loads a few optional export helpers from public CDNs, so GIF/APNG/GIF-frame features require an internet connection.

- `/websites/` stores self-contained website demos shown in the homepage carousel. Add each demo as its own folder and register it in `/websites/sites.json`.

- Browser tab titles use the name of the portfolio or demo page.
- Put the portfolio favicon at the web root as `/favicon.ico` (filename: `favicon.ico`). The HTML is already wired to load it.
