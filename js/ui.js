window.MuvellaUI=(()=>{
 function h(tag,attrs,...children){const el=document.createElement(tag);Object.entries(attrs||{}).forEach(([k,v])=>{if(k.startsWith('on'))el.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='class')el.className=v;else if(k==='value')el.value=v??'';else if(k==='checked'||k==='disabled'||k==='readOnly')el[k]=!!v;else if(v!==undefined&&v!==null)el.setAttribute(k,String(v));});children.flat(Infinity).forEach(c=>{if(c!==null&&c!==undefined&&c!==false)el.append(c instanceof Node?c:document.createTextNode(String(c)));});return el;}
 function toast(s){const e=h('div',{class:'toast',role:'alert'},s);document.body.append(e);setTimeout(()=>e.remove(),4500);}
 async function copy(s){try{await navigator.clipboard.writeText(s);}catch(e){const t=h('textarea',{value:s});document.body.append(t);t.select();document.execCommand('copy');t.remove();}toast('已複製');}
 function field(label,name,value='',type='text'){const input=h(type==='textarea'?'textarea':'input',{name,id:name,type:type==='textarea'?undefined:type,step:type==='number'?'any':undefined,value});return h('label',{class:'field',for:name},label,input);}
 function select(label,name,options,value){return h('label',{class:'field'},label,h('select',{name,id:name},options.map(o=>h('option',{value:typeof o==='string'?o:o[0],selected:(typeof o==='string'?o:o[0])===value?'selected':null},typeof o==='string'?o:o[1]))));}
 function button(label,fn,primary=false){return h('button',{type:'button',class:primary?'primary':'',onclick:async e=>{e.currentTarget.disabled=true;try{await fn();}catch(err){toast((err.errors||[err.message]).join('、'));}finally{e.target.disabled=false;}}},label);}
 function formData(f){return Object.fromEntries(new FormData(f));}
 function table(headers,rows){return h('div',{class:'table-wrap'},h('table',{},h('thead',{},h('tr',{},headers.map(x=>h('th',{},x)))),h('tbody',{},rows)));}
 function drawer(title,...children){const overlay=h('div',{class:'overlay',onclick:e=>{if(e.target===overlay)overlay.remove();}});const panel=h('section',{class:'drawer',role:'dialog','aria-modal':'true','aria-label':title},h('div',{class:'row between'},h('h2',{},title),button('關閉',()=>overlay.remove())),children);overlay.append(panel);document.body.append(overlay);const close=e=>{if(e.key==='Escape'){overlay.remove();document.removeEventListener('keydown',close);}};document.addEventListener('keydown',close);panel.querySelector('button').focus();return overlay;}
 function router(render,fallback='/'){const run=()=>render(location.hash.slice(1)||fallback);addEventListener('hashchange',run);run();}
 function nodes(children){return children.flat(Infinity).filter(c=>c!==null&&c!==undefined&&c!==false);}
 function append(el,...children){el.append(...nodes(children));}
 function replace(el,...children){el.replaceChildren(...nodes(children));}
 return {h,append,replace,toast,copy,field,select,button,formData,table,drawer,router,money:n=>'NT$ '+Number(n||0).toLocaleString('zh-TW'),loading:()=>h('div',{class:'loading',role:'status'},'資料載入中…')};
})();
