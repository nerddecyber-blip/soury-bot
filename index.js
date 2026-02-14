const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const ytdl = require("ytdl-core");
const config = require("./config");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
  });

  // Pairing code
  if (!sock.authState.creds.registered) {
    const code = await sock.requestPairingCode(process.env.PHONE_NUMBER);
    console.log("Pairing Code:", code);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === "open") {
      console.log("SOURY connected");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (!text.startsWith(config.prefix)) return;

    const args = text.slice(1).trim().split(" ");
    const cmd = args.shift().toLowerCase();

    // MENU WITH IMAGE
    if (cmd === "menu") {
      await sock.sendMessage(from, {
        image: fs.readFileSync("./menu.jpg"),
        caption: `🤖 *${config.botName}*

Commands:
.menu
.ping
.play <song>
.yt <link>
.owner
`,
      });
    }

    // PING
    if (cmd === "ping") {
      await sock.sendMessage(from, { text: "pong" });
    }

    // OWNER
    if (cmd === "owner") {
      await sock.sendMessage(from, {
        text: `Owner: wa.me/${config.ownerNumber}`,
      });
    }

    // YOUTUBE MUSIC DOWNLOAD
    if (cmd === "play") {
      if (!args[0]) {
        return sock.sendMessage(from, { text: "Send YouTube link" });
      }

      const url = args[0];

      try {
        const stream = ytdl(url, { filter: "audioonly" });
        const file = "song.mp3";

        stream.pipe(fs.createWriteStream(file)).on("finish", async () => {
          await sock.sendMessage(from, {
            audio: fs.readFileSync(file),
            mimetype: "audio/mp4",
          });
          fs.unlinkSync(file);
        });
      } catch (e) {
        sock.sendMessage(from, { text: "Download error" });
      }
    }

    // YOUTUBE VIDEO DOWNLOAD
    if (cmd === "yt") {
      if (!args[0]) {
        return sock.sendMessage(from, { text: "Send YouTube link" });
      }

      const url = args[0];

      try {
        const stream = ytdl(url, { quality: "18" });
        const file = "video.mp4";

        stream.pipe(fs.createWriteStream(file)).on("finish", async () => {
          await sock.sendMessage(from, {
            video: fs.readFileSync(file),
          });
          fs.unlinkSync(file);
        });
      } catch (e) {
        sock.sendMessage(from, { text: "Download error" });
      }
    }
  });
}

startBot();
