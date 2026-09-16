const nativeApp = 'com.komorebi.SafariAI';
const inFlight = new Set();
const native = message => browser.runtime.sendNativeMessage(nativeApp, message);
function extensionPage(sender, page) {
  try { return new URL(sender.url).href.split(/[?#]/)[0] === browser.runtime.getURL(page); } catch { return false; }
}
browser.action.onClicked.addListener(async tab => {
  try {
    await browser.scripting.executeScript({ target: {tabId: tab.id}, files: ['content.js'] });
    await browser.tabs.sendMessage(tab.id, {type:'TOGGLE'}, {frameId:0});
  } catch {
    await browser.tabs.create({url:browser.runtime.getURL('help.html')});
  }
});
browser.runtime.onMessage.addListener((message, sender) => {
  return (async () => {
    const panel = extensionPage(sender, 'panel.html');
    const options = extensionPage(sender, 'options.html');
    if (!panel && !options) return {ok:false,error:'この画面からは操作できません。'};
    try {
      switch (message.type) {
        case 'STATUS': return await native({type:'STATUS'});
        case 'CONFIG': if (options) return await native({type:'CONFIG'}); break;
        case 'SAVE_CONFIG': if (options) return await native({type:'SAVE_CONFIG',config:message.config,key:message.key,deleteKey:message.deleteKey}); break;
        case 'TEST': if (options) return await native({type:'TEST',provider:message.provider}); break;
        case 'OPTIONS': await browser.runtime.openOptionsPage(); return {ok:true};
        case 'CLOSE': if (panel && sender.tab) { await browser.tabs.sendMessage(sender.tab.id,{type:'CLOSE'},{frameId:0}); return {ok:true}; } break;
        case 'CONTEXT': if (panel && sender.tab) return await browser.tabs.sendMessage(sender.tab.id,{type:'CONTEXT'},{frameId:0}); break;
        case 'ASK': {
          if (!panel || !sender.tab || inFlight.has(sender.tab.id)) throw new Error('回答を生成中です。');
          const tabID = sender.tab.id; inFlight.add(tabID);
          try { return await native({type:'ASK',provider:message.provider,question:message.question,context:message.context,history:message.history}); }
          finally { inFlight.delete(tabID); }
        }
      }
      return {ok:false,error:'対応していない操作です。'};
    } catch (error) { return {ok:false,error:error.message || '接続できませんでした。KomorebiアプリとSafariの機能拡張設定を確認してください。'}; }
  })();
});
