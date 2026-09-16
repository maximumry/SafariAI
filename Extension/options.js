(() => {
  const $=id=>document.getElementById(id);let configs={},defaultProvider='local',status={};
  const demo=!globalThis.browser?.runtime;
  async function send(message) {
    if(demo) throw new Error('プレビューでは設定を保存できません。Safari拡張の設定画面から登録してください。');
    const r=await browser.runtime.sendMessage(message);if(!r?.ok)throw new Error(r?.error||'接続できませんでした。');return r;
  }
  function result(text,error=false){$('result').hidden=false;$('result').textContent=text;$('result').classList.toggle('error',error);}
  function show(){
    const p=$('config-provider').value,c=configs[p]||{};
    $('cloud-fields').hidden=p==='local';$('endpoint-label').hidden=p!=='custom';
    $('local-status').textContent=p==='local'?(status.localAvailable?'このMacでApple Intelligenceを利用できます。':status.localReason||'利用状況を確認できていません。'):'';
    $('model').value=c.model||'';$('endpoint').value=c.endpoint||'';$('api-key').value='';
    $('key-state').textContent=c.hasKey?'キーチェーンに登録済み':'未登録';$('delete-key').disabled=!c.hasKey;
    $('default-provider').checked=p===defaultProvider;$('result').hidden=true;
  }
  async function load(){const r=await send({type:'CONFIG'});configs=r.configs;defaultProvider=r.defaultProvider;status=r;show();}
  function busy(v){for(const el of document.querySelectorAll('button,input,select'))el.disabled=v;}
  $('config-provider').onchange=show;
  $('settings-form').onsubmit=async e=>{
    e.preventDefault();busy(true);
    try {const p=$('config-provider').value;await send({type:'SAVE_CONFIG',config:{provider:p,model:$('model').value.trim(),endpoint:$('endpoint').value.trim(),makeDefault:$('default-provider').checked},key:$('api-key').value.trim()});await load();result('設定を保存しました。パネルでこの接続を選んで使えます。');}
    catch(error){result(error.message,true);}finally{busy(false);}
  };
  $('delete-key').onclick=async()=>{busy(true);try{const p=$('config-provider').value;await send({type:'SAVE_CONFIG',config:{provider:p,...configs[p],makeDefault:false},deleteKey:true});await load();result('保存済みのAPIキーを削除しました。');}catch(e){result(e.message,true);}finally{busy(false);}};
  $('test').onclick=async()=>{busy(true);result('保存済みの設定で接続を確認しています…');try{const r=await send({type:'TEST',provider:$('config-provider').value});result('接続できました。 '+(r.answer||''));}catch(e){result(e.message,true);}finally{busy(false);}};
  load().catch(e=>{show();result(e.message,true);});
})();
