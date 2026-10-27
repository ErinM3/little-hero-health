# 🦸 Little Hero Health

**Run the hospital with your friends.** Little Hero Health is a real-life hospital role-play game for ages 0 to 21+, with a website, a hospital workstation, Camp HQ, events and tickets, and a Discord community.

Made by Harry, CEO of Little Hero Health. Live site: https://be-the-doc.netlify.app

## What's in here

| Folder | What it is |
|---|---|
| `site/` | The website. Netlify publishes this folder. |
| `site/index.html` | Home page and the game |
| `site/workstation.html` | Hospital Workstation, My Hospital and hospital keys |
| `site/events.html` | Events and tickets (needs the events worker) |
| `site/camp.html` | Camp HQ for camps and schools |
| `site/community.html` | Discord page (13+) |
| `site/roblox.html` | Roblox servers on Maple Hospital |
| `site/pitch.html` | About Little Hero |
| `site/admin.html` | Admin sign-in. Its contents are encrypted. |
| `site/brand/` | Logo files |
| `site/videos/` | How-to videos |
| `discord/` | Little Hero Bot and Discord setup scripts |
| `events/` | The events and tickets worker for Cloudflare |
| `docs/` | Setup guides, the Discord kit and channel banners |

## Updating the website

When `site/` changes on GitHub, Netlify updates https://be-the-doc.netlify.app by itself.
There is no build step: `netlify.toml` tells Netlify to publish the `site` folder.

## Never put these on GitHub

Bot tokens, Square tokens, `SESSION_SECRET`, `STAFF_KEYS`, admin keys, or any file with
"secret" or "password" in its name. Those live only in Cloudflare and on your own computer.
`.gitignore` blocks the usual secret files, but always check before you upload.

## Safety

Little Hero is made for kids. No chat in the game, hero names instead of real names,
grown-up gates for shopping and tickets, and Discord only for ages 13 and up.

---
© 2026 Little Hero Health. All rights reserved. This code and content may not be copied,
changed or reused without written permission.
