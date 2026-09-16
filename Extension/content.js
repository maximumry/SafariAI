(() => {
  if (globalThis.__komorebiInstalled) return;
  globalThis.__komorebiInstalled = true;
  let host, frame, selected = (window.getSelection()?.toString().trim() || '').slice(0, 8000), selectionURL = location.href;
  document.addEventListener('selectionchange', () => {
    const value = window.getSelection()?.toString().trim();
    if (value) { selected = value.slice(0, 8000); selectionURL = location.href; }
  });
  const documentID = crypto.randomUUID();
  let lastURL = location.href, revision = 0;
  function extract() {
    if (lastURL !== location.href) { revision++; lastURL = location.href; }
    const source = document.querySelector('article') || document.querySelector('main, [role="main"]') || document.body;
    const excluded = 'script,style,noscript,nav,header,footer,aside,form,input,textarea,select,button,[contenteditable],iframe,[hidden],[aria-hidden="true"]';
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(excluded) || host?.contains(parent)) return NodeFilter.FILTER_REJECT;
        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const lines = []; let length = 0, node;
    while ((node = walker.nextNode()) && length < 24000) {
      const parent = node.parentElement;
      if (!parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden') continue;
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      lines.push(text); length += text.length + 1;
    }
    const url = new URL(location.href);
    return { pageID: `${documentID}:${revision}`, title: document.title, url: url.origin + url.pathname, text: lines.join('\n').slice(0,24000), selection: selectionURL === location.href ? selected : '', truncated: length >= 24000 };
  }
  function toggle(force) {
    if (!host) {
      host = document.createElement('div');
      host.style.cssText = 'all:initial!important;position:fixed!important;right:14px!important;top:14px!important;bottom:14px!important;width:min(430px,calc(100vw - 28px))!important;z-index:2147483647!important;display:block!important;';
      const shadow = host.attachShadow({ mode: 'closed' });
      frame = document.createElement('iframe'); frame.src = browser.runtime.getURL('panel.html');
      frame.title = 'Komorebi AI アシスタント';
      frame.style.cssText = 'width:100%;height:100%;border:0;border-radius:22px;box-shadow:0 16px 64px #0003;background:#f7f8f4;color-scheme:light dark;';
      shadow.append(frame); document.documentElement.append(host);
    } else { host.style.setProperty('display', (force === false || host.style.display !== 'none') ? 'none' : 'block', 'important'); }
  }
  browser.runtime.onMessage.addListener(message => {
    if (message.type === 'TOGGLE') toggle();
    if (message.type === 'CLOSE') toggle(false);
    if (message.type === 'CONTEXT') return Promise.resolve(extract());
  });
})();
