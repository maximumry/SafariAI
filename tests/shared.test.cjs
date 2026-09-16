const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const K=require('../Extension/shared.js');
test('page URLs strip query secrets and fragments',()=>assert.equal(K.cleanURL('https://user:secret@example.com/a?token=123#private'),'https://example.com/a'));
test('unsupported schemes never become page references',()=>assert.equal(K.cleanURL('javascript:alert(1)'),''));
test('no-page mode removes every page field',()=>assert.deepEqual(K.contextForMode({title:'private',text:'secret',selection:'selected',url:'https://x.test'},'none'),{title:'',url:'',text:'',selection:'',truncated:false}));
test('selection mode excludes body',()=>assert.equal(K.contextForMode({text:'secret',selection:'chosen'},'selection').text,''));
test('Markdown escapes malicious HTML and never emits remote images',()=>{const html=K.markdown('<img src=x onerror=alert(1)>\n![x](https://evil.test/t)\n```html\n<script>x</script>\n```');assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));assert.ok(html.includes('&lt;script&gt;'));});
test('Markdown renders headings, lists, emphasis and code',()=>{const html=K.markdown('## Title\n- **key**\n`code`');for(const expected of ['<h3>Title</h3>','<strong>key</strong>','<code>code</code>'])assert.ok(html.includes(expected));});
test('background rejects settings and generation from content scripts',async()=>{
  let listener;let nativeCalls=0;
  const browser={runtime:{getURL:p=>'safari-web-extension://test/'+p,onMessage:{addListener:f=>listener=f},sendNativeMessage:async()=>{nativeCalls++;return{ok:true}}},action:{onClicked:{addListener(){}}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../Extension/background.js'),'utf8'),{browser,URL,Set});
  for(const type of ['SAVE_CONFIG','ASK','CONFIG']){const result=await listener({type},{url:'https://evil.test',tab:{id:1}});assert.equal(result.ok,false);}
  await listener({type:'SAVE_CONFIG'},{url:'safari-web-extension://test/panel.html',tab:{id:1}});assert.equal(nativeCalls,0);
  await listener({type:'SAVE_CONFIG'},{url:'safari-web-extension://test/options.html'});assert.equal(nativeCalls,1);
});
