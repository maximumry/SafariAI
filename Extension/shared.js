/* Pure helpers shared by the UI and regression tests. No remote dependencies. */
(function (root) {
  const providers = { local: 'Apple Intelligence', openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini', custom: '互換 API' };
  function cleanURL(value) {
    try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.origin + u.pathname : ''; } catch { return ''; }
  }
  function contextForMode(c, mode) {
    if (mode === 'none') return { title: '', url: '', text: '', selection: '', truncated: false };
    return { title: String(c.title || '').slice(0, 300), url: cleanURL(c.url), text: mode === 'selection' ? '' : String(c.text || '').slice(0, 24000), selection: String(c.selection || '').slice(0, 8000), truncated: !!c.truncated };
  }
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Intentionally small Markdown subset: never interpret HTML, images, or links.
  function markdown(text) {
    const inline = s => escape(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return String(text).split(/```[^\n]*\n([\s\S]*?)(?:```|$)/g).map((part, index) => {
      if (index % 2) return '<pre><code>' + escape(part.trimEnd()) + '</code></pre>';
      return part.split('\n').map(line => {
        if (/^#{1,3} /.test(line)) return '<h3>' + inline(line.replace(/^#{1,3} /, '')) + '</h3>';
        if (/^[-*] /.test(line)) return '<div class="list-line"><span>•</span><span>' + inline(line.slice(2)) + '</span></div>';
        if (/^\d+\. /.test(line)) return '<div class="list-line">' + inline(line) + '</div>';
        if (/^> /.test(line)) return '<blockquote>' + inline(line.slice(2)) + '</blockquote>';
        return line ? '<p>' + inline(line) + '</p>' : '<div class="paragraph-gap"></div>';
      }).join('');
    }).join('');
  }
  root.Komorebi = { providers, cleanURL, contextForMode, escape, markdown };
  if (typeof module !== 'undefined') module.exports = root.Komorebi;
})(globalThis);
