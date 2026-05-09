# K-pop CardBot Starter (Discord)

Starter bot with:
- `/drop` (3-card drop with rarity rolls)
- Claim buttons (`Claim 1/2/3`)
- `/inventory`
- SQLite + Prisma persistence
- Drop cooldown + expiry

## 1) Setup

```bash
cd cardbot
cp .env.example .env
```

Fill `.env`:
- `DISCORD_TOKEN` from Discord Developer Portal -> Bot
- `CLIENT_ID` from your application page
- `GUILD_ID` from your Discord server (enable Developer Mode, copy server ID)

## 2) Install + DB

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## 3) Run

```bash
npm run start
```

On startup, guild slash commands are registered automatically.

## 4) Commands

- `/drop`
- `/inventory`
- `/inventory user:@someone`
- `/ping`

## Notes

- Image URLs in seed data are placeholders (`picsum`). Replace with your own permitted card images.
- For production, switch SQLite to Postgres and deploy to Railway/Render/Fly.
