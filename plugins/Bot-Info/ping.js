const os = require('os');
const process = require('process');

function formatUptime(seconds) {
    function pad(s) {
        return (s < 10 ? '0' : '') + s;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    seconds = Math.floor(seconds % 60);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

module.exports = {
    command: 'ping',
    description: 'Mengecek kecepatan respon dan status bot.',
    run: async (sock, message, args) =>  {
        const startTime = Date.now();

        const usedMem = process.memoryUsage().heapUsed / 1024 / 1024;
        const totalMem = os.totalmem() / 1024 / 1024;
        const uptime = process.uptime();

        const latency = Date.now() - startTime;

        const responseText = 
`\`\`\`
PONG! 🏓
- Speed    : ${latency} ms
- Uptime   : ${formatUptime(uptime)}
- RAM      : ${usedMem.toFixed(2)} MB / ${totalMem.toFixed(2)} MB
\`\`\``;

        await message.reply(responseText);
    }
};