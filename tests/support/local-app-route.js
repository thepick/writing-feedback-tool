const fs = require('node:fs');
const path = require('node:path');

// Serve only snapshot assets; specialized service and library routes stay in each test.
module.exports = function localAppRoute(route, root, fallbackContentType = 'text/html') {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return route.fulfill({ status: 404, body: '' });
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : fallbackContentType, body: fs.readFileSync(file) });
};
