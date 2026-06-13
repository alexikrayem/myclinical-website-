// Adds a random X-Forwarded-For IP address to simulate traffic from different users.
// This helps prevent all traffic from getting blocked by the rate limiter for a single localhost IP.

function injectRandomIP(requestParams, context, ee, next) {
    // Generate random IP segments
    const ip = [
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255),
        Math.floor(Math.random() * 255)
    ].join('.');

    // Ensure headers object exists
    if (!requestParams.headers) {
        requestParams.headers = {};
    }

    // Inject the randomized IP
    requestParams.headers['x-forwarded-for'] = ip;
    requestParams.headers['x-real-ip'] = ip;

    return next();
}

module.exports = {
    injectRandomIP
};
