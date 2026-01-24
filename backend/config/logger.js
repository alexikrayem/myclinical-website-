import winston from 'winston';

const { combine, timestamp, json, colorize, printf } = winston.format;

// Custom format for development
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp(),
        json() // Default to JSON for production/file logs
    ),
    transports: [
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'production'
                ? json()
                : combine(colorize(), timestamp(), consoleFormat)
        })
    ]
});

export default logger;
