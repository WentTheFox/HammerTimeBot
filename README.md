# HammerTimeBot [![Build](https://github.com/WentTheFox/HammerTimeBot/actions/workflows/node.yml/badge.svg)](https://github.com/WentTheFox/HammerTimeBot/actions/workflows/node.yml) <a title="Crowdin" target="_blank" href="https://crowdin.com/project/hammertimebot"><img src="https://badges.crowdin.net/hammertimebot/localized.svg" alt=""></a> <a href="https://top.gg/bot/964106782790283295"><img src="https://top.gg/api/widget/servers/964106782790283295.svg" alt=""></a></h1>

Discord bot written in Node.js (using [discord.js](https://www.npmjs.com/package/discord.js)) for [HammerTime]

[HammerTime]: https://github.com/WentTheFox/HammerTime

```
$ sudo npm install -g pm2
$ npm install
$ cp .env.example .env
$ nano .env # Fill in the neccessary environment variables
$ npm build
$ pm2 start pm2.json
```

## Webhook deployment

`src/webhook.ts` is an alternative entrypoint that receives interactions over Discord's HTTP
Interactions Endpoint instead of the gateway (`src/index.ts`), so it needs no gateway/shard
connection at all. `pm2.json` starts it alongside the gateway process (`HammerTimeBot:Webhook`) -
running both processes at once is safe at the infrastructure level, but **setting an Interactions
Endpoint URL on the application in the Discord Developer Portal is what actually switches interaction
delivery over** - once set, Discord stops sending `INTERACTION_CREATE` over the gateway entirely (this
is an all-or-nothing switch per application, not selective by interaction type), so the gateway
process's interaction handling goes idle at that point even though the process itself keeps running.
Don't set that URL against production until you're confident in the webhook path.

One-time production server setup:

1. `deploy/nginx/` → symlink the config into `/etc/nginx/sites-available/` and
   `/etc/nginx/sites-enabled/`, matching how this project's other nginx configs are laid out on that
   host.
2. Expand (or issue) a cert covering the webhook subdomain, e.g. via `certbot --expand`.
3. `sudo nginx -t && sudo systemctl reload nginx`
4. Set `DISCORD_PUBLIC_KEY` (the app's Ed25519 public key, from the Developer Portal) and optionally
   `WEBHOOK_PORT` (defaults to `3939`) in the server's `.env`.
5. `pm2 start pm2.json` (or `pm2 restart pm2.json` if already running) to bring up
   `HammerTimeBot:Webhook` alongside the existing gateway process.
6. Once confident locally/in staging, set the Interactions Endpoint URL to the webhook subdomain's
   URL in the Developer Portal - this is the actual cutover step (see above).

## Translation

New language contributions are welcome! They are handled through [Crowdin]. If you don't see your language listed, that
means it's likely not supported by the Discord client itself, meaning translations would be pointless. If a language is
available in Discord's settings but is not listed on Crowdin, or you want to help with the translations of an existing
language, please [join our Discord server] and ask for your language to be added to the project in
the [#translator-signup] channel. You will be given the Translator role and granted access to a language-specific
channel for further discussion. This is necessary so that when new translations are needed for any potential new bot
features, I have an easy way to reach everyone at once.

[crowdin]: https://crowdin.com/project/hammertimebot

[join our discord server]: https://hammertime.cyou/discord

[#translator-signup]: https://discord.com/channels/952258283882819595/952292965211074650

English and Hungarian translations have been included, so no translators will be needed for these two languages.

### Credits

- 🇧🇬 Bulgarian
  - [Casper](https://crowdin.com/profile/JajarGG)
  - [Rxshi](https://crowdin.com/profile/Rxshi)
- 🇨🇳 Chinese Simplified
  - [Hoshub](https://crowdin.com/profile/Hoshub)
  - [User670](https://crowdin.com/profile/User670)
- 🇹🇼 ChineseTW
  - [Jckcr](https://crowdin.com/profile/jckcr)
  - [神風神鵝 エホバ神魔狼](https://crowdin.com/profile/lalauya1122)
- 🇭🇷 Croatian: [Volvone](https://github.com/volvone)
- 🇨🇿 Czech
  - [Blurplix](https://crowdin.com/profile/Blurplix)
  - [klauny](https://crowdin.com/profile/klauny)
- 🇳🇱 Dutch: [Jesse](https://crowdin.com/profile/Jessuh)
- 🇫🇮 Finnish: [lihaisapossu](https://crowdin.com/profile/lihaisapossu)
- 🇫🇷 French
  - [Cookie Kiro](https://crowdin.com/profile/Cookikui)
  - [Hvalomi](https://crowdin.com/profile/hvalomi)
  - [Quent12b0](https://crowdin.com/profile/Quent12b0)
- 🇩🇪 German
  - [Fabian9799](https://crowdin.com/profile/Fabian9799)
  - [Liam Bartsch](https://crowdin.com/profile/bartschliam)
  - [Maximilian](https://crowdin.com/profile/maxlengert12051)
- 🇬🇷 Greek: [Belle Bernice](https://crowdin.com/profile/BelleBernice)
- 🇮🇳 Hindi: [Balajiasli](https://crowdin.com/profile/Balajiasli)
- 🇮🇩 Indonesian: [Jackie](https://github.com/Jckcr)
- 🇮🇹 Italian: [RVG|𝓵𝓸𝓻𝔂](https://top.gg/bot/1076200668810985634)
- 🇯🇵 Japanese
  - [Phrygia](https://github.com/sjkim04)
  - [ゆううゆ](https://crowdin.com/profile/yuuuyu)
- 🇰🇷 Korean
  - [Bin](https://crowdin.com/profile/cheesepickle12345678)
  - [Phrygia](https://github.com/sjkim04)
  - [zwxoz](https://crowdin.com/profile/zwxoz)
  - [미르냥](https://crowdin.com/profile/Mirnyang)
  - [오렌지](https://crowdin.com/profile/Orange_1006)
  - [정규민](https://crowdin.com/profile/smillle)
- 🇱🇹 Lithuanian: [Trent](https://crowdin.com/profile/nothingness)
- 🇳🇴 Norwegian
  - [barecharge](https://crowdin.com/profile/barecharge)
  - [Hvalomi](https://crowdin.com/profile/hvalomi)
  - [kidneb1g](https://crowdin.com/profile/klinge9797)
  - [Phillip Rodseth](https://crowdin.com/profile/philliphatrod)
- 🇵🇱 Polish
  - [AlpacaMan](https://crowdin.com/profile/Alpaca_Man)
  - [Dawid Jaworski](https://crowdin.com/profile/MinerPL)
  - [Piotr G.](https://crowdin.com/profile/ekidoxx)
- 🇧🇷 Portuguese, Brazilian
  - [Daniel Souza](https://crowdin.com/profile/dansansou)
  - [leo0six](https://crowdin.com/profile/leo0six)
- 🇷🇴 Romanian
  - [Ant. Rares](https://crowdin.com/profile/Iepurooy)
  - [mihai](https://crowdin.com/profile/mihaiofficialRO)
- 🇷🇺 Russian
  - [Artiom Boyko](https://crowdin.com/profile/Ajno)
  - [cfif126](https://crowdin.com/profile/cfif126)
  - [dimkakartinka](https://crowdin.com/profile/dimkakartinka)
  - [Nikita Sharikov](https://crowdin.com/profile/Aligatoor)
  - [Vladimir](https://crowdin.com/profile/bill876)
  - [Артем](https://crowdin.com/profile/artenovis9020)
- 🇪🇸 Spanish
  - [Its Me Lol](https://crowdin.com/profile/ServiceAide)
  - [Street Dog](https://crowdin.com/profile/streetdog.arg)
  - [Yareaj](https://github.com/Yareaj/)
- 🇲🇽 Spanish, Latin America
  - [MrCRACK](https://crowdin.com/profile/MrCRACK)
  - [Street Dog](https://crowdin.com/profile/streetdog.arg)
  - [Yareaj](https://github.com/Yareaj/)
- 🇹🇭 Thai
  - [Suthipong Masopmao](https://crowdin.com/profile/Windsor_911)
  - [timelessnesses](https://github.com/timelessnesses)
  - [ปิยาพัชร อินทร์ช่วย](https://crowdin.com/profile/piyaphachrxinthrchwy)
- 🇹🇷 Turkish
  - [Baran Moroğan](https://crowdin.com/profile/okunamayanad)
  - [tututuana](https://crowdin.com/profile/tututuana)
- 🇺🇦 Ukrainian
  - [DmitroMeow](https://crowdin.com/profile/DmitroMeow)
  - [GameHacker](https://crowdin.com/profile/GameHacker)
  - [Артем](https://crowdin.com/profile/artenovis9020)
  - [Кухарчук Ярослав](https://crowdin.com/profile/Gamer_Yaroslaw)
- 🇻🇳 Vietnamese
  - [Quan](https://crowdin.com/profile/quanonthecob)
  - [ThatKev](https://crowdin.com/profile/thatkev)
