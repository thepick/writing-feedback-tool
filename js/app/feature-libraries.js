// Load the existing pinned libraries only when their feature is used.
(function() {
    var libraries = {
        chart: { url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js', global: 'Chart', label: 'Chart.js' },
        zip: { url: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', global: 'JSZip', label: 'JSZip' }
    };
    var pending = {};

    window.loadWftFeatureLibrary = function(name) {
        if (!Object.prototype.hasOwnProperty.call(libraries, name)) {
            return Promise.reject(new Error('Unknown feature library.'));
        }
        var library = libraries[name];
        if (typeof window[library.global] === 'function') return Promise.resolve(window[library.global]);
        if (pending[name]) return pending[name];

        var request = new Promise(function(resolve, reject) {
            var script = document.createElement('script');
            var settled = false;
            function finish(error) {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                script.onload = script.onerror = null;
                if (error) {
                    script.remove();
                    reject(error);
                } else {
                    resolve(window[library.global]);
                }
            }
            var timeout = setTimeout(function() {
                finish(new Error(library.label + ' loading timed out. Try the feature again.'));
            }, 15000);
            script.src = library.url;
            script.async = true;
            script.onload = function() {
                finish(typeof window[library.global] === 'function' ? null : new Error(library.label + ' did not become available. Try the feature again.'));
            };
            script.onerror = function() {
                finish(new Error(library.label + ' could not load. Check your connection and try the feature again.'));
            };
            try { document.head.appendChild(script); }
            catch (error) { finish(error); }
        });
        pending[name] = request;
        function clearPending() { if (pending[name] === request) delete pending[name]; }
        request.then(clearPending, clearPending);
        return request;
    };
}());
