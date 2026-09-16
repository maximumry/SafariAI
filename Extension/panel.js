(() => {
  const $ = id => document.getElementById(id), K = Komorebi;
  let context = {}, history = [], busy = false, status = null, pageURL = '', configuredProvider = 'local';
  const demo = !globalThis.browser?.runtime;
  async function request(message) {
    if (demo) {
      if (message.type === 'STATUS') return {ok:true,localAvailable:true,providers:{local:{ready:true}},defaultProvider:'local'};
      if (message.type === 'CONTEXT') return {title:'MQTTとは？ IoTをつなぐ軽量な通信プロトコル',url:'https://example.com/learn/mqtt',text:'MQTTは、IoT機器などで利用される軽量なメッセージ通信プロトコルです。Publish / Subscribe方式を採用します。パブリッシャーはトピックを指定してブローカーにメッセージを送信し、サブスクライバーは必要なトピックを購読します。QoSには0・1・2の3段階があります。',selection:''};
      if (message.type === 'ASK') { await new Promise(r=>setTimeout(r,600)); return {ok:true,answer:'### MQTTの3つのポイント\n\n- **軽量な通信**：小さなデータでやり取りできるため、IoT機器に向いています。\n- **送信と受信を分離**：ブローカーがメッセージを仲介します。\n- **配信品質を選べる**：QoSで、用途に合った配信の保証を選択します。\n\nひとことで言うと、**小さな機器同士の情報を効率よく届ける仕組み**です。\n\n> これはUI確認用の固定サンプルです。実際のAIによる回答ではありません。'}; }
      if (message.type === 'OPTIONS') { location.href='options.html'; return {ok:true}; }
      return {ok:true};
    }
    return browser.runtime.sendMessage(message);
  }
  function notice(text='') { $('notice').textContent=text; $('notice').hidden=!text; }
  function updateScope() {
    const c=K.contextForMode(context,$('scope').value);
    const length=(c.text+c.selection).length;
    $('context-size').textContent=length ? `${length.toLocaleString()} 文字${c.truncated?'・抜粋':''}` : '送信なし';
    $('context-preview').textContent=[c.title,c.url,c.selection&&`【選択範囲】\n${c.selection}`,c.text].filter(Boolean).join('\n\n')||'質問とこの会話の履歴のみ送ります。';
  }
  async function refresh() {
    const c=await request({type:'CONTEXT'});
    if (c.ok===false) throw new Error(c.error);
    const identity=c.pageID||c.url;
    if (pageURL && identity !== pageURL) clearConversation();
    pageURL=identity; context=c;
    $('page-title').textContent=c.title||'タイトルのないページ';
    $('page-title').title=c.title||'';
    try { $('page-domain').textContent=new URL(c.url).hostname; } catch { $('page-domain').textContent=''; }
    updateScope();
  }
  function updateProvider() {
    const provider=$('provider').value, local=provider==='local';
    $('connection-label').textContent=local?'ON DEVICE':'CLOUD';
    $('privacy').textContent=demo?'プレビュー · AI接続なし':local?'このMacで処理されます':`${K.providers[provider]}へ質問・選択した情報・会話を送信`;
    if (status && !status.providers?.[provider]?.ready) notice(local ? status.localReason||'Apple Intelligenceを利用できません。' : 'この接続は未設定です。右上の設定からAPIキーとモデルを登録してください。');
    else notice();
  }
  async function loadStatus(initial=false) {
    const result=await request({type:'STATUS'});
    if (!result.ok) throw new Error(result.error);
    status=result;
    if(initial) { configuredProvider=result.defaultProvider||'local'; $('provider').value=configuredProvider; }
    updateProvider();
  }
  function addMessage(role,text) {
    $('welcome').hidden=true;
    const section=document.createElement('section');section.className=`message ${role}`;
    const label=document.createElement('div');label.className='message-label';label.textContent=role==='user'?'YOU':K.providers[$('provider').value].toUpperCase();
    const body=document.createElement('div');body.innerHTML=K.markdown(text);
    if(role==='assistant') {const copy=document.createElement('button');copy.className='text-button';copy.textContent='コピー';copy.onclick=()=>copyText(text);label.append(copy);}
    section.append(label,body);$('messages').append(section);$('conversation').scrollTop=$('conversation').scrollHeight;
  }
  async function copyText(text) {try {await navigator.clipboard.writeText(text);notice('コピーしました。');}catch{notice('コピーできませんでした。本文を選択してコピーしてください。');}}
  function clearConversation() {history=[];$('messages').replaceChildren();$('welcome').hidden=false;notice();}
  function setBusy(value) {
    busy=value; for (const e of document.querySelectorAll('#send,#provider,#scope,#clear,#refresh,.quick-actions button')) e.disabled=value;
    $('send').textContent=value?'…':'↑';$('composer').setAttribute('aria-busy',String(value));
  }
  async function ask(forced,selectionOnly=false) {
    if(busy) return;
    const question=(forced||$('question').value).trim();if(!question) return;
    setBusy(true);notice();let loading;
    try {
      await refresh(); await loadStatus();
      if (selectionOnly) { if(!context.selection) throw new Error('ページ上で文章を選択してから、このボタンを押してください。');$('scope').value='selection';updateScope(); }
      if($('scope').value==='selection'&&!context.selection) throw new Error('選択範囲がありません。ページ上で文章を選択してください。');
      const provider=$('provider').value;
      if(!demo&&!status.providers?.[provider]?.ready) throw new Error(provider==='local'?status.localReason:'設定からAPIキーとモデルを登録してください。');
      const payload=K.contextForMode(context,$('scope').value);
      addMessage('user',question);$('question').value='';
      loading=document.createElement('div');loading.className='message thinking';loading.textContent='内容を読み解いています…';$('messages').append(loading);
      $('conversation').scrollTop=$('conversation').scrollHeight;
      const result=await request({type:'ASK',provider,question,context:payload,history:history.slice(-8)});
      if(!result?.ok) throw new Error(result?.error||'回答を受信できませんでした。');
      loading.remove();addMessage('assistant',result.answer);
      history.push({role:'user',content:question},{role:'assistant',content:result.answer}); history=history.slice(-20);
      if(result.note) notice(result.note);
    } catch(error) {loading?.remove();$('question').value=question;notice(error.message);}
    finally {setBusy(false);$('question').focus();}
  }
  $('composer').onsubmit=e=>{e.preventDefault();ask();};
  $('question').onkeydown=e=>{if(!e.isComposing&&e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();ask();}};
  document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>ask(b.dataset.prompt,!!b.dataset.selection));
  $('scope').onchange=updateScope;
  $('provider').onchange=()=>{clearConversation();updateProvider();};
  $('refresh').onclick=()=>refresh().catch(e=>notice(e.message));
  $('settings').onclick=()=>request({type:'OPTIONS'}).catch(e=>notice(e.message));
  $('close').onclick=()=>request({type:'CLOSE'});
  $('clear').onclick=clearConversation;
  $('export').onclick=()=>copyText(history.map(m=>`## ${m.role==='user'?'質問':'回答'}\n\n${m.content}`).join('\n\n')||'まだ会話がありません。');
  window.addEventListener('focus',()=>{if(!busy)loadStatus().catch(e=>notice(e.message));});
  Promise.all([refresh(),loadStatus(true)]).then(()=>{if(demo)notice('UIプレビューです。AI回答は固定サンプルです。');}).catch(e=>notice(e.message));
})();
