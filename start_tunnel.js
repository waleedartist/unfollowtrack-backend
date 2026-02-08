const localtunnel = require('localtunnel');

(async () => {
    const tunnel = await localtunnel({ port: 5000 });

    // the assigned public url for your local server, for example: https://abcdefg.loca.lt
    console.log('TUNNEL_URL: ' + tunnel.url);

    tunnel.on('close', () => {
        console.log('Tunnel closed');
        process.exit(1);
    });

    tunnel.on('error', (err) => {
        console.log('Tunnel error: ' + err);
        process.exit(1);
    });
})();
