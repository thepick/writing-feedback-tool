/* One-time, same-account recovery when replacing an OAuth project. Originals are read only. */
(function () {
  'use strict';
  const base = 'https://www.googleapis.com/drive/v3/files';
  const folderType = 'application/vnd.google-apps.folder';
  async function request(token, url, options = {}) {
    if (!url.startsWith('https://www.googleapis.com/')) throw new Error('Unexpected Google URL.');
    const response = await fetch(url, {...options, headers: {...options.headers, Authorization: 'Bearer ' + token}, signal: AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error('Google Drive could not complete recovery (HTTP ' + response.status + '). Your original files are unchanged.');
    return response;
  }
  async function list(token, q, space) {
    const files = [], seen = new Set();
    let pageToken = '';
    do {
      const query = new URLSearchParams({q: q + ' and trashed=false', pageSize: '1000', fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,appProperties)', spaces: space || 'drive'});
      if (pageToken) query.set('pageToken', pageToken);
      const data = await (await request(token, base + '?' + query)).json();
      if (!Array.isArray(data.files)) throw new Error('Incomplete Google file list.');
      files.push(...data.files);
      pageToken = data.nextPageToken;
      if (pageToken && seen.has(pageToken)) throw new Error('Repeated Google file-list page.');
      seen.add(pageToken);
    } while (pageToken);
    return files;
  }
  const quote = value => "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  async function read(token, id) { return (await request(token, base + '/' + encodeURIComponent(id) + '?alt=media')).arrayBuffer(); }
  async function hash(bytes) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join(''); }
  async function upload(token, metadata, bytes, id) {
    // Resumable upload also handles portfolio photographs larger than 5 MB.
    const url = 'https://www.googleapis.com/upload/drive/v3/files' + (id ? '/' + encodeURIComponent(id) : '') + '?uploadType=resumable&fields=id';
    const start = await request(token, url, {method: id ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json', 'X-Upload-Content-Type': metadata.mimeType || 'application/json'}, body: JSON.stringify(metadata)});
    const location = start.headers.get('Location');
    if (!location || !location.startsWith('https://www.googleapis.com/')) throw new Error('Google did not return an upload location.');
    const result = await (await request(token, location, {method: 'PUT', body: new Blob([bytes], {type: metadata.mimeType || 'application/json'})})).json();
    if (!result.id || await hash(await read(token, result.id)) !== await hash(bytes)) throw new Error('Recovery copy could not be verified.');
    return result.id;
  }
  async function identity(token) {
    const user = await (await request(token, 'https://www.googleapis.com/oauth2/v2/userinfo')).json();
    if (!user.id || !user.email) throw new Error('Google account could not be verified.');
    return user;
  }
  function authorize(config, user) {
    return new Promise((resolve, reject) => {
      const oauth = window.google?.accounts?.oauth2;
      if (!oauth) return reject(new Error('Google sign-in is still loading. Try again.'));
      oauth.initTokenClient({client_id: config.oldClient, scope: config.scope, include_granted_scopes: false,
        callback: response => {
          if (response.error || !response.access_token || !oauth.hasGrantedAllScopes(response, ...config.scope.split(/\s+/))) return reject(new Error('Allow the existing Google permissions to recover your saved work.'));
          resolve(response.access_token);
        }, error_callback: () => reject(new Error('Google sign-in was closed or blocked. Try again.'))
      }).requestAccessToken({prompt: 'select_account', hint: user.email});
    });
  }
  async function recoverAppData(config, oldToken, newToken) {
    const original = await list(oldToken, 'name=' + quote(config.fileName), 'appDataFolder');
    const current = await list(newToken, 'name=' + quote(config.fileName), 'appDataFolder');
    if (!original.length) return;
    if (original.length > 1 || current.length > 1) throw new Error('Several saved files need reconciliation. Your original progress is safe; contact pickripper@gmail.com.');
    const bytes = await read(oldToken, original[0].id);
    JSON.parse(new TextDecoder().decode(bytes));
    let output = bytes;
    if (current.length) {
      const currentBytes = await read(newToken, current[0].id);
      if (await hash(bytes) === await hash(currentBytes)) return;
      if (!config.merge) throw new Error('Different progress already exists in the new setup. No file was overwritten.');
      output = new TextEncoder().encode(JSON.stringify(config.merge(JSON.parse(new TextDecoder().decode(bytes)), JSON.parse(new TextDecoder().decode(currentBytes)))));
      // Recheck the destination before updating; practice must stay paused during recovery.
      if (await hash(await read(newToken, current[0].id)) !== await hash(currentBytes)) throw new Error('New progress changed during recovery. Try again with other app tabs closed.');
    }
    if (await hash(await read(oldToken, original[0].id)) !== await hash(bytes)) throw new Error('Original progress changed. Close other app tabs and try again.');
    await upload(newToken, current.length ? {mimeType: 'application/json'} : {name: config.fileName, mimeType: 'application/json', parents: ['appDataFolder']}, output, current[0]?.id);
    if (await hash(await read(oldToken, original[0].id)) !== await hash(bytes)) throw new Error('Original progress changed during recovery. Try recovery again before practising.');
  }
  function remap(value, ids) {
    if (typeof value === 'string') return ids[value] || value;
    if (Array.isArray(value)) return value.map(item => remap(item, ids));
    if (Object.prototype.toString.call(value) === '[object Object]') return Object.fromEntries(Object.entries(value).map(([key, item]) => [ids[key] || key, remap(item, ids)]));
    return value;
  }
  async function recoverFolder(config, oldToken, newToken) {
    const roots = await list(oldToken, 'name=' + quote(config.folderName) + ' and mimeType=' + quote(folderType));
    if (!roots.length) return;
    if (roots.length !== 1) throw new Error('Several original portfolio folders need reconciliation; no originals were changed.');
    const nodes = [], visited = new Set();
    async function scan(file, parent) {
      if (visited.has(file.id)) throw new Error('Repeated portfolio file.');
      visited.add(file.id); nodes.push({...file, parent});
      if (file.mimeType === folderType) for (const child of await list(oldToken, quote(file.id) + ' in parents')) await scan(child, file.id);
      else if (file.mimeType.startsWith('application/vnd.google-apps.')) throw new Error('Portfolio contains a Google document or shortcut requiring manual recovery.');
    }
    await scan(roots[0], null);
    const copied = await list(newToken, "appProperties has { key='oauthSource' and value=" + quote(config.oldClient) + ' }');
    const ids = {};
    for (const node of nodes) {
      const previous = copied.filter(file => file.appProperties?.oauthOriginal === node.id);
      if (previous.length > 1) throw new Error('Duplicate recovery copies require reconciliation.');
      if (previous[0]) { ids[node.id] = previous[0].id; continue; }
      const metadata = {name: node.name, mimeType: node.mimeType, appProperties: {oauthSource: config.oldClient, oauthOriginal: node.id}};
      if (node.parent) metadata.parents = [ids[node.parent]];
      ids[node.id] = (await (await request(newToken, base + '?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(metadata)})).json()).id;
      if (!ids[node.id]) throw new Error('Google did not return a recovery file ID.');
    }
    // Create every ID first so JSON references to photographs, students and archives remain valid.
    for (const node of nodes.filter(file => file.mimeType !== folderType)) {
      const source = await read(oldToken, node.id);
      let output = source;
      if (node.mimeType.includes('json') || /\.json$/i.test(node.name)) output = new TextEncoder().encode(JSON.stringify(remap(JSON.parse(new TextDecoder().decode(source)), ids)));
      await upload(newToken, {mimeType: node.mimeType}, output, ids[node.id]);
      if (await hash(await read(oldToken, node.id)) !== await hash(source)) throw new Error('Original portfolio changed during recovery. Close other tabs and try again.');
    }
    const after = [];
    async function recheck(parent) { for (const child of await list(oldToken, quote(parent) + ' in parents')) { after.push(child.id); if (child.mimeType === folderType) await recheck(child.id); } }
    await recheck(roots[0].id);
    if (after.sort().join(',') !== nodes.slice(1).map(file => file.id).sort().join(',')) throw new Error('Original portfolio files changed during recovery. Try again.');
    return ids;
  }
  async function ensure(config, newToken) {
    const user = await identity(newToken);
    const marker = (config.fileName || config.folderName) + '.google-migration-v1.json';
    const space = config.folderName ? 'drive' : 'appDataFolder';
    const markers = await list(newToken, 'name=' + quote(marker), space);
    for (const file of markers) {
      const saved = JSON.parse(new TextDecoder().decode(await read(newToken, file.id)));
      if (saved.userId === user.id && saved.oldClient === config.oldClient && saved.newClient === config.newClient) return {...saved, user};
    }
    return new Promise((resolve, reject) => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-label', 'Keep your saved Google progress');
      dialog.style.cssText = 'max-width:520px;padding:28px;border-radius:14px;color:#192b36;background:white;font:17px/1.5 system-ui';
      const title = document.createElement('h2'); title.textContent = 'Keep your saved Google progress';
      const message = document.createElement('p'); message.textContent = 'We have updated our Google connection. If you used Google sync before, connect once more to bring your saved work across. Choose the same account: ' + user.email + '. Close other app tabs during this step.';
      message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite');
      const recover = document.createElement('button'); recover.textContent = 'Keep my saved progress';
      const fresh = document.createElement('button'); fresh.textContent = 'I have never used Google sync here';
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel sign-in';
      for (const button of [recover, fresh, cancel]) button.style.cssText = 'display:block;margin:12px 0;padding:12px;font:inherit;cursor:pointer';
      dialog.append(title, message, recover, fresh, cancel); document.body.append(dialog); dialog.showModal();
      function close() { dialog.close(); dialog.remove(); }
      function abort() { close(); reject(new Error('Progress recovery cancelled. Your original work is unchanged.')); }
      cancel.onclick = abort; dialog.addEventListener('cancel', event => {event.preventDefault(); abort();});
      async function finish(copy) {
        for (const button of [recover, fresh, cancel]) button.disabled = true;
        try {
          let ids;
          if (copy) {
            const oldToken = await authorize(config, user);
            const oldUser = await identity(oldToken);
            if (oldUser.id !== user.id) throw new Error('Choose the same Google account. No progress was copied.');
            message.textContent = 'Recovering and verifying your saved work… Keep this tab open.';
            ids = config.folderName ? await recoverFolder(config, oldToken, newToken) : await recoverAppData(config, oldToken, newToken);
          }
          const saved = {version: 1, userId: user.id, oldClient: config.oldClient, newClient: config.newClient, completedAt: new Date().toISOString(), ids};
          await upload(newToken, {name: marker, mimeType: 'application/json', parents: [config.folderName ? 'root' : 'appDataFolder']}, new TextEncoder().encode(JSON.stringify(saved)));
          close(); resolve({...saved, user});
        } catch (error) {
          message.textContent = error.message;
          for (const button of [recover, fresh, cancel]) button.disabled = false;
          // A failed recovery must never silently start with empty progress.
          fresh.disabled = copy;
        }
      }
      recover.onclick = () => finish(true); fresh.onclick = () => finish(false);
    });
  }
  window.GoogleDriveMigration = {ensure, remap};
})();
