const pino = require('pino');

const logger = pino({
    level: 'info',
    transport: {
        target: 'pino/file',
    },
});

module.exports = logger;