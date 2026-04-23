module.exports = async function (dataBuffer, options) {
    return {
        numpages: 1,
        numrender: 1,
        info: {
            PDFFormatVersion: '1.4',
            Creator: 'Mock',
            Producer: 'Mock',
            CreationDate: 'D:20240101000000Z',
        },
        metadata: null,
        text: 'Mocked PDF text output for testing',
        version: '1.10.100'
    };
};
