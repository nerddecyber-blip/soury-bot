const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");

const ownerNumber = process.env.OWNER_NUMBER; // 2557xxxxxxx

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false,
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
      console.log("✅ BOT CONNECTED");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith("@g.us");
    const sender = isGroup ? msg.key.participant : from;
    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    const command = body.split(" ")[0].toLowerCase();
    const args = body.split(" ").slice(1);

    const isOwner = sender.includes(ownerNumber);

    // MENU
    if (command === ".menu") {
      await sock.sendMessage(from, {
        text: `🤖 *FULL SOURY BOT*

Commands:
.menu
.ping
.owner
.tagall
.kick
.add
.delete
.sticker
.public
.private`,
      });
    }

    // PING
    if (command === ".ping") {
      await sock.sendMessage(from, { text: "🏓 Pong!" });
    }

    // OWNER
    if (command === ".owner") {
      await sock.sendMessage(from, {
        text: `👑 Owner: wa.me/${ownerNumber}`,
      });
    }

    // TAG ALL
    if (command === ".tagall" && isGroup) {
      const metadata = await sock.groupMetadata(from);
      const participants = metadata.participants;

      let teks = "📢 TAG ALL\n\n";
      let mentions = [];

      participants.forEach((p) => {
        teks += `@${p.id.split("@")[0]}\n`;
        mentions.push(p.id);
      });

      await sock.sendMessage(from, { text: teks, mentions });
    }

    // KICK
    if (command === ".kick" && isGroup) {
      const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
      if (mention) {
        await sock.groupParticipantsUpdate(from, mention, "remove");
      }
    }

    // ADD
    if (command === ".add" && isGroup) {
      if (!args[0]) return;
      const number = args[0] + "@s.whatsapp.net";
      await sock.groupParticipantsUpdate(from, [number], "add");
    }

    // DELETE MESSAGE
    if (command === ".delete") {
      if (!msg.message.extendedTextMessage) return;
      const key = msg.message.extendedTextMessage.contextInfo.stanzaId;
      await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: key } });
    }

    // PUBLIC / PRIVATE MODE
    let publicMode = true;

    if (command === ".private" && isOwner) {
      publicMode = false;
      await sock.sendMessage(from, { text: "Bot is now PRIVATE" });
    }

    if (command === ".public" && isOwner) {
      publicMode = true;
      await sock.sendMessage(from, { text: "Bot is now PUBLIC" });
    }

    if (!publicMode && !isOwner) return;
  });
}

startBot();
