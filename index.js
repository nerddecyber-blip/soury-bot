const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const readline = require("readline");

const botName = "SOURY";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered) {
        rl.question("Enter your WhatsApp number (with country code): ", async (number) => {
            const code = await sock.requestPairingCode(number);
            console.log("Your pairing code:", code);
        });
    }

    sock.ev.on("connection.update", (update) => {
        const { connection } = update;

        if (connection === "open") {
            console.log("SOURY bot connected successfully ✅");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text;

        const from = msg.key.remoteJid;

        // commands
        if (text === ".ping") {
            await sock.sendMessage(from, { text: "pong 🏓" });
        }

        if (text === ".hi") {
            await sock.sendMessage(from, {
                text: `Habari, mimi ni ${botName} 🤖`
            });
        }

        if (text === ".menu") {
            await sock.sendMessage(from, {
                text:
`🤖 *${botName} MENU*

.ping - test bot
.hi - salamu
.menu - menu ya commands`
            });
        }
    });
}

startBot();
