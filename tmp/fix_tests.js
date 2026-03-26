const fs = require('fs');
const path = require('path');

const dir = '/Users/iskandermac/Downloads/project 6/backend/__tests__';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js'));

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Find the mock block
    const mockRegex = /(jest\.unstable_mockModule\('\.\.\/middleware\/rateLimiter\.js', \(\) => \(\{[\s\S]*?)\}\)\);/;
    const match = content.match(mockRegex);

    if (match) {
        if (!match[0].includes('redeemLimiter')) {
            // we inject it right before the closing }
            const blockContent = match[0];
            const injection = ',\n    redeemLimiter: (req, res, next) => next()\n}';

            // replace the final '}  ' or '}' with the injection
            const updatedBlock = blockContent.replace(/\s*\}\)\);/, injection + '));');

            content = content.replace(blockContent, updatedBlock);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Updated ' + file);
        } else {
            console.log('Already has redeemLimiter: ' + file);
        }
    }
}
