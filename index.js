const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const path = require("path");
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
    const code = await sock.requestPairingCode("255XXXXXXXXX");
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
      console.log("✅ Bot connected");
    }
  });

  // LOAD COMMANDS
  const commands = new Map();
  const commandFiles = fs.readdirSync("./commands");

  for (let file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    commands.set(cmd.name, cmd);
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (config.autoRead) await sock.readMessages([msg.key]);
    if (config.autoTyping) await sock.sendPresenceUpdate("composing", from);

    if (!text.startsWith(config.prefix)) return;

    const args = text.slice(1).trim().split(" ");
    const cmdName = args.shift().toLowerCase();

    const command = commands.get(cmdName);
    if (!command) return;

    try {
      command.execute(sock, msg, args, config);
    } catch (e) {
      console.log(e);
    }
  });
}

startBot();
