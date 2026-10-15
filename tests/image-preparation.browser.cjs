const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const localAppRoute = require('./support/local-app-route');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => localAppRoute(route, root));
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        const cases = await page.evaluate(async () => {
            stopWftSyncPolling(); scheduleWftCloudSync = () => {};
            const cases = [], check = (name, passed) => cases.push({ name, passed: !!passed });
            async function makeFile(width, height, background, type) {
                const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, width, height); }
                ctx.fillStyle = '#000'; ctx.font = '20px serif';
                for (let row = 0; row < 25; row++) ctx.fillText('The student writes a story about a dog and the park. Page ' + row, 40, 50 + row * 30);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, type));
                return new File([blob], 'synthetic-writing.' + (type === 'image/png' ? 'png' : 'jpg'), { type });
            }
            async function inspect(dataUrl) {
                const image = await loadImageElement(dataUrl), canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
                const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                let light = 0, dark = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 200) light++;
                    if (pixels[i] < 50 && pixels[i + 1] < 50 && pixels[i + 2] < 50) dark++;
                }
                return { width: canvas.width, height: canvas.height, background: Array.from(pixels.slice(0, 4)), light, dark };
            }
            const transparent = await makeFile(1200, 900, '', 'image/png');
            const original = await fileToDataUrl(transparent), optimized = await optimizeImageForOcr(transparent);
            const decoded = await inspect(optimized);
            check('transparent writing uses smaller JPEG', optimized.startsWith('data:image/jpeg;') && optimized.length < original.length);
            check('transparent background becomes white without losing ink', decoded.background.slice(0, 3).every(value => value > 245) && decoded.light > 900000 && decoded.dark > 5000 && decoded.dark < 150000);
            check('unscaled image dimensions preserved', decoded.width === 1200 && decoded.height === 900);

            selectedImages = []; syncSelectedImageState();
            await handleSelectedImages([transparent]);
            const queued = await inspect(selectedImages[0].dataUrl);
            check('public photo acquisition queues readable writing', selectedImages.length === 1 && selectedImages[0].name === transparent.name && queued.light > 900000 && queued.dark > 5000 && queued.dark < 150000);

            const large = await optimizeImageForOcr(await makeFile(3000, 2400, '', 'image/png'));
            const resized = await inspect(large);
            check('oversized transparent writing remains readable after resizing', resized.width === 2200 && resized.height === 1760 && resized.background.slice(0, 3).every(value => value > 245) && resized.dark > 1000);

            const opaque = await optimizeImageForOcr(await makeFile(1200, 900, '#4b8dce', 'image/jpeg'));
            const colored = await inspect(opaque);
            check('opaque photo background remains colored', Math.abs(colored.background[0] - 75) < 10 && Math.abs(colored.background[1] - 141) < 10 && Math.abs(colored.background[2] - 206) < 10);

            const small = await makeFile(1, 1, '', 'image/png'), smallOriginal = await fileToDataUrl(small);
            check('smaller original PNG bytes retained', await optimizeImageForOcr(small) === smallOriginal);

            const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'], 'synthetic-writing.svg', { type: 'image/svg+xml' });
            const raster = await optimizeImageForOcr(svg), red = await inspect(raster);
            check('decoded SVG becomes a supported raster image', isSafeWftImageDataUrl(raster) && raster.startsWith('data:image/jpeg;') && red.background[0] > 240 && red.background[1] < 15);
            selectedImages = []; syncSelectedImageState();
            await handleSelectedImages([svg]);
            check('public SVG acquisition has a visible safe preview', selectedImages.length === 1 && !!document.querySelector('#ocrPreviewList img').getAttribute('src') && isSafeWftImageDataUrl(selectedImages[0].dataUrl));

            let rejected = false;
            try { await optimizeImageForOcr(new File(['broken'], 'broken.png', { type: 'image/png' })); } catch (error) { rejected = /Could not load/.test(error.message); }
            check('invalid image still rejects without replacing existing queue', rejected && selectedImages.length === 1 && selectedImages[0].dataUrl === raster);
            return cases;
        });
        console.log(JSON.stringify({ suite: 'image-preparation', cases, errors }));
        assert.deepEqual(errors, []);
        assert.deepEqual(cases.filter(row => !row.passed), []);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
