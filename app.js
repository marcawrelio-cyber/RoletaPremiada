
const KEY='rp_v1_demo';
const defaults=()=>({config:{nome:'Roleta Premiada',cor:'#f3b53e',volume:40,tempo:8,som:true,vitoria:true,suspense:true,logo:'',chance:35,repeticoes:{tente:3,perdeu:2,proxima:2},limiteTente:3,estiloSom:'mecanico',fundo:''},premios:[{id:'p1',nome:'Corte grátis',img:''},{id:'p2',nome:'10% desconto',img:''},{id:'p3',nome:'Brinde surpresa',img:''},{id:'p4',nome:'Gemini 30 dias',img:''}],cupons:Array.from({length:5},(_,i)=>({id:String(i+1).padStart(3,'0'),usado:false,premio:null})),vouchers:[],sequencia:5});
let db;try{db=JSON.parse(localStorage.getItem(KEY))||defaults()}catch(e){db=defaults()}
db.config.repeticoes ||= {tente:3,perdeu:2,proxima:2};db.config.limiteTente ??= 3;db.cupons.forEach(c=>c.tentativasGratis ??= 0);
let ang=0,ocupado=false,audioCtx=null;const imageCache=new Map();
const $=id=>document.getElementById(id);
function salvar(){localStorage.setItem(KEY,JSON.stringify(db))}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function aba(nome){$('cliente').hidden=nome!=='cliente';$('master').hidden=nome!=='master';render();window.scrollTo(0,0)}
// V13: interrupção centralizada de MP3, efeitos sintetizados e efeitos agendados.
const audiosAtivos=new Set(),timersAudio=new Set();
let rodadaAudio=0;
function acompanharAudio(a){audiosAtivos.add(a);a.addEventListener('ended',()=>audiosAtivos.delete(a),{once:true});a.addEventListener('error',()=>audiosAtivos.delete(a),{once:true});return a}
function agendarAudio(fn,ms){const token=rodadaAudio;const id=setTimeout(()=>{timersAudio.delete(id);if(token===rodadaAudio)fn()},ms);timersAudio.add(id)}
function pararSomAnterior(){
 rodadaAudio++;
 for(const id of timersAudio)clearTimeout(id);timersAudio.clear();
 for(const a of audiosAtivos){try{a.pause();a.currentTime=0}catch(e){}}audiosAtivos.clear();
 if(audioCtx){try{audioCtx.close().catch(()=>{})}catch(e){}audioCtx=null}
}
function initAudio(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch(e){}}
function beep(freq=500,dur=.06,vol=1){if(!audioCtx||!db.config.som)return;let ctx=audioCtx;let len=Math.max(64,Math.floor(ctx.sampleRate*dur));let buffer=ctx.createBuffer(1,len,ctx.sampleRate),data=buffer.getChannelData(0);let estilo=db.config.estiloSom||'mecanico';for(let i=0;i<len;i++){let t=i/len;let envelope=Math.pow(1-t,estilo==='suave'?5:9);let noise=(Math.random()*2-1);let body=Math.sin(2*Math.PI*(freq*.32)*(i/ctx.sampleRate))*Math.exp(-t*17);data[i]=(noise*.7+body*.3)*envelope;}let src=ctx.createBufferSource();src.buffer=buffer;let filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=estilo==='suave'?1250:estilo==='auditório'?3100:2100;let gain=ctx.createGain();gain.gain.value=.25*(db.config.volume/100)*vol;src.connect(filter);filter.connect(gain);gain.connect(ctx.destination);src.start();}
const soundGroups=[{id:'giro',title:'🎡 Giro da roleta',choices:['Mecânica clássica','Auditório','Estalos de madeira','Metal leve','Suave']},{id:'ganhou',title:'🎉 Vitória',choices:['Fogos e fanfarra','Aplausos','Torcida comemorando','Fanfarra','Moedas']},{id:'perdeu',title:'😢 Não ganhou',choices:['Aaaah da plateia','Ohhh','Trombone triste','Falha divertida','Suspiro']},{id:'tensao',title:'🥁 Suspense',choices:['Tambores','Batidas graves','Contagem de tensão','Estalos lentos','Silêncio']}];
const customSounds={};
// Guarda MP3/WAV no IndexedDB do próprio aparelho, sem ocupar localStorage.
const audioDB=new Promise((resolve,reject)=>{const req=indexedDB.open('roleta-audios-v6',1);req.onupgradeneeded=()=>req.result.createObjectStore('audios');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
async function recuperarAudios(){try{const dbx=await audioDB;for(const g of soundGroups){const blob=await new Promise((resolve,reject)=>{let req=dbx.transaction('audios','readonly').objectStore('audios').get(g.id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});if(blob){customSounds[g.id]=URL.createObjectURL(blob)}}renderSounds()}catch(e){console.warn('Áudio local indisponível',e)}}
recuperarAudios();
function soundSettings(){db.config.sounds??={};for(const g of soundGroups)db.config.sounds[g.id]??={enabled:true,choice:0,volume:70};return db.config.sounds}
function renderSounds(){const opts=soundSettings();$('soundLibrary').innerHTML=soundGroups.map(g=>{let v=opts[g.id];return `<div class="soundRow"><b>${g.title}</b><label><input type="checkbox" ${v.enabled?'checked':''} onchange="changeSound('${g.id}','enabled',this.checked)"> Ativado</label><label>Escolher efeito<select onchange="changeSound('${g.id}','choice',Number(this.value))">${[...g.choices,'🎵 Meu MP3/WAV'].map((x,i)=>`<option value="${i}" ${v.choice===i?'selected':''}>${x}</option>`).join('')}</select></label><label>Volume individual: ${v.volume}%<input type="range" min="0" max="100" value="${v.volume}" oninput="changeSound('${g.id}','volume',Number(this.value))"></label><label>Áudio próprio (MP3/WAV) — escolha o arquivo e selecione «Meu MP3/WAV» acima<input type="file" accept="audio/*" onchange="customAudio('${g.id}',this)"></label><button onclick="previewSound('${g.id}')">▶ Ouvir ${g.title.replace(/[^a-zA-ZÀ-ÿ ]/g,'')}</button></div>`}).join('')}
function changeSound(id,key,val){soundSettings()[id][key]=val;salvar();renderSounds()}
async function customAudio(id,el){const f=el.files[0];if(!f)return;if(f.size>8*1024*1024){alert('Escolha um áudio de até 8 MB');return}try{const dbx=await audioDB;await new Promise((resolve,reject)=>{const tx=dbx.transaction('audios','readwrite');tx.objectStore('audios').put(f,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});if(customSounds[id])URL.revokeObjectURL(customSounds[id]);customSounds[id]=URL.createObjectURL(f);soundSettings()[id].choice=soundGroups.find(g=>g.id===id).choices.length;salvar();renderSounds();alert('Áudio ativado e salvo neste aparelho! Ele continuará disponível após fechar e abrir a página. Para compartilhar com outros aparelhos, será necessário salvar na nuvem.')}catch(e){alert('Não foi possível salvar o áudio neste navegador: '+e.message)}}
function tone(freq,duration=.14,type='sine',vol=.13,delay=0){if(!audioCtx)return;let t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(50,freq),t);o.frequency.exponentialRampToValueAtTime(Math.max(50,freq*.72),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0001,vol*db.config.volume/100),t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+duration+.01)}
function noiseBurst(duration=.24,vol=.15,delay=0){if(!audioCtx)return;let len=Math.floor(audioCtx.sampleRate*duration),buf=audioCtx.createBuffer(1,len,audioCtx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);let src=audioCtx.createBufferSource(),gain=audioCtx.createGain();src.buffer=buf;gain.gain.value=vol*db.config.volume/100;src.connect(gain);gain.connect(audioCtx.destination);src.start(audioCtx.currentTime+delay)}
function playEffect(id){initAudio();let cfg=soundSettings()[id];if(!cfg.enabled||!db.config.som)return;if(cfg.choice===soundGroups.find(g=>g.id===id).choices.length){if(!customSounds[id]){alert('Selecione primeiro um MP3/WAV para esta categoria.');return}let a=acompanharAudio(new Audio(customSounds[id]));a.volume=Math.min(1,db.config.volume/100*cfg.volume/100);a.play().catch(()=>{});return}let choice=cfg.choice,vol=cfg.volume/100;if(id==='giro'){for(let i=0;i<9;i++)agendarAudio(()=>beep(520-i*25,.045,vol),i*70+i*i*12);return}if(id==='ganhou'){if(choice===0){for(let i=0;i<5;i++)noiseBurst(.2+i*.06,.24*vol,i*.19);[523,659,784,1046].forEach((f,i)=>tone(f,.26,'triangle',.14*vol,i*.16))}else if(choice===1||choice===2){for(let i=0;i<16;i++)noiseBurst(.035,.11*vol,i*.07)}else if(choice===3){[392,523,659,784,1046].forEach((f,i)=>tone(f,.24,'triangle',.17*vol,i*.15))}else for(let i=0;i<7;i++)tone(600+i*130,.12,'sine',.13*vol,i*.09)}else if(id==='perdeu'){if(choice===0||choice===1||choice===4){[420,380,330,290].forEach((f,i)=>tone(f,.3,choice===4?'sine':'sawtooth',.11*vol,i*.16))}else if(choice===2){[350,300,240,170].forEach((f,i)=>tone(f,.35,'sawtooth',.12*vol,i*.23))}else [640,420,220].forEach((f,i)=>tone(f,.13,'square',.09*vol,i*.17))}else if(id==='tensao'){if(choice===4)return;for(let i=0;i<5;i++){if(choice===0||choice===1)tone(choice===0?130:85,.12,'triangle',.16*vol,i*.27);else beep(300+i*30,.04,vol)}}}
function previewSound(id){playEffect(id)}
function celebrate(){let el=$('celebration');el.hidden=false;el.innerHTML=Array.from({length:75},(_,i)=>`<i class="confetti" style="left:${Math.random()*100}%;background:hsl(${Math.random()*360} 90% 60%);animation-delay:${Math.random()*.8}s"></i>`).join('');setTimeout(()=>{el.hidden=true;el.innerHTML=''},3700)}
function highlightPrize(id){document.querySelectorAll('.prizeCard').forEach(x=>x.classList.toggle('active',x.dataset.prize===id));let active=document.querySelector('.prizeCard.active');active?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}
function winSound(){playEffect('ganhou');return;if(!db.config.vitoria||!db.config.som||!audioCtx)return;[523,659,784,1046].forEach((f,i)=>setTimeout(()=>{let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.07*db.config.volume/100+.0001,audioCtx.currentTime+.025);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.25);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.26)},i*145))}
function testarSom(){initAudio();for(let i=0;i<14;i++)agendarAudio(()=>beep(700-i*18,.045,1),i*75+i*i*12)}
function fecharQR(){$('qrModal').hidden=true}
function mostrarQR(code){let v=db.vouchers.find(x=>x.codigo===code);if(!v)return;$('qrModal').hidden=false;$('qrArea').innerHTML='';$('qrDesc').textContent=v.nome+' • Cupom '+v.cupom+' • '+v.codigo;if(typeof QRCode==='function'){new QRCode($('qrArea'),{text:JSON.stringify({demo:true,codigo:v.codigo,premio:v.nome}),width:210,height:210,correctLevel:QRCode.CorrectLevel.M})}else $('qrArea').textContent='QR indisponível sem internet. Código: '+v.codigo}
function imageFor(url){if(!url)return null;if(!imageCache.has(url)){let img=new Image();img.crossOrigin='anonymous';img.onload=()=>draw();img.onerror=()=>{};img.src=url;imageCache.set(url,img)}let im=imageCache.get(url);return im.complete&&im.naturalWidth?im:null}
const paletaPremios=['#20b981','#b76be6','#ffd052','#f17d53','#58b4e8','#df72ab','#a6c65a','#9d8bf4'];
function corDoItem(p){const padrao={tente:'#2385d8',perdeu:'#e54a60',proxima:'#f29b2e'};if(p.tipo)return (db.config.coresResultados||{})[p.tipo]||padrao[p.tipo];const pos=db.premios.findIndex(x=>x.id===p.id);return p.cor||paletaPremios[(pos<0?0:pos)%paletaPremios.length]}
function hashTexto(t){let h=2166136261;for(const c of String(t)){h=Math.imul(h^c.charCodeAt(0),16777619)}return h>>>0}
function misturarFatias(items){
  // Intercala por distância circular: evita agrupamentos inclusive na emenda início/fim.
  const grupos=new Map();for(const p of items){const k=p.tipo||p.id;if(!grupos.has(k))grupos.set(k,[]);grupos.get(k).push(p)}
  const keys=[...grupos.keys()],n=items.length;let melhor=null,melhorCusto=Infinity;
  let seed=hashTexto(items.map(p=>p.id).join('|')+'|'+n);
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  // Busca diversas distribuições e escolhe a mais espaçada; mantém a ordem estável.
  for(let tentativa=0;tentativa<240;tentativa++){
    const remaining=new Map(keys.map(k=>[k,grupos.get(k).length]));const seq=[];
    while(seq.length<n){const poss=keys.filter(k=>remaining.get(k)>0);let pesos=poss.map(k=>{let ult=seq.lastIndexOf(k),dist=ult<0?10:seq.length-ult;return Math.max(.02,Math.min(12,dist*dist))*remaining.get(k)});let soma=pesos.reduce((a,b)=>a+b,0),r=rnd()*soma,idx=0;while(idx<poss.length-1&&r>=pesos[idx])r-=pesos[idx++];let k=poss[idx];seq.push(k);remaining.set(k,remaining.get(k)-1)}
    let custo=0;for(let i=0;i<n;i++)for(let d=1;d<=Math.min(4,Math.floor(n/2));d++)if(seq[i]===seq[(i+d)%n])custo+=Math.pow(6-d,3);
    if(custo<melhorCusto){melhorCusto=custo;melhor=seq}if(custo===0)break;
  }
  const pilhas=new Map(keys.map(k=>[k,[...grupos.get(k)]]));return melhor.map(k=>pilhas.get(k).shift());
}
function fatias(){const a=[];for(const p of db.premios){for(let i=0;i<Math.max(0,Math.min(100,Math.floor(Number(p.partes??1)||0)));i++)a.push(p)}const r=db.config.repeticoes;for(let i=0;i<Math.max(0,Number(r.tente)||0);i++)a.push({id:'tente',nome:'Tente novamente',img:'',tipo:'tente'});for(let i=0;i<Math.max(0,Number(r.perdeu)||0);i++)a.push({id:'perdeu',nome:'Não foi desta vez',img:'',tipo:'perdeu'});for(let i=0;i<Math.max(0,Number(r.proxima)||0);i++)a.push({id:'proxima',nome:'Fica para a próxima',img:'',tipo:'proxima'});return misturarFatias(a.length?a:[{id:'perdeu',nome:'Não foi desta vez',tipo:'perdeu'}])}
function salvarResultados(){db.config.repeticoes={tente:Number($('qtTente').value),perdeu:Number($('qtPerdeu').value),proxima:Number($('qtProxima').value)};db.config.limiteTente=Number($('limiteTente').value);salvar();render()}
function draw(){const cv=$('wheel'),ctx=cv.getContext('2d'),N=fatias().length,center=280,r=265,step=2*Math.PI/N;ctx.clearRect(0,0,560,560);let cores=[db.config.cor,'#ed667f','#49b8a4','#7f82e8','#f3984a','#67a6e1','#d36ec5','#8ab64d'];const entries=fatias();entries.forEach((p,i)=>{let start=ang+i*step-Math.PI/2;ctx.beginPath();ctx.moveTo(center,center);ctx.arc(center,center,r,start,start+step);ctx.closePath();ctx.fillStyle=corDoItem(p);ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#fff';ctx.stroke();ctx.save();ctx.translate(center,center);ctx.rotate(start+step/2);ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle='#171b30';ctx.font='bold '+(N>9?'13':'18')+'px Arial';let txt=p.nome.length>15?p.nome.slice(0,14)+'…':p.nome;ctx.fillText(txt,r-15,0,r-70);ctx.restore();let im=imageFor(p.img);if(im){ctx.save();ctx.translate(center,center);ctx.rotate(start+step/2);let x=r*.46;ctx.beginPath();ctx.arc(x,0,27,0,Math.PI*2);ctx.clip();try{ctx.drawImage(im,x-27,-27,54,54)}catch(e){}ctx.restore()}});ctx.beginPath();ctx.arc(center,center,55,0,Math.PI*2);ctx.fillStyle='#20233d';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='white';ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText('SORTE',center,center+7);let logo=imageFor(db.config.logo);if(logo){ctx.save();ctx.beginPath();ctx.arc(center,center,48,0,Math.PI*2);ctx.clip();try{ctx.drawImage(logo,center-48,center-48,96,96)}catch(e){}ctx.restore()}}
function render(){document.title=db.config.nome;const restantes=db.cupons.filter(c=>!c.usado).length;$('tickets').innerHTML=restantes?db.cupons.map(c=>`<span class="ticket ${c.usado?'used':''}">${esc(c.id)}${c.usado?`<small class="ticketResult">${esc(c.resultado||'Utilizado')}</small>`:''}</span>`).join(''):'';$('saldo').textContent=restantes?restantes+' rodadas disponíveis':'🎟️ Seus cupons acabaram! Volte em breve para novas oportunidades.';$('spin').disabled=ocupado||!db.cupons.some(c=>!c.usado);$('vouchers').innerHTML=db.vouchers.length?db.vouchers.map(v=>`<div class="item"><div>🏆 <b>${esc(v.nome)}</b><br><small>Cupom ${esc(v.cupom)} • Código ${esc(v.codigo)}</small><br><small>${v.resgatado?'RESGATADO':'PENDENTE DE RESGATE'}</small></div><button onclick="mostrarQR('${v.codigo}')">🎟️ Voucher</button><button onclick="resgatar('${v.codigo}')">${v.resgatado?'✓':'Marcar resgatado'}</button></div>`).join(''):'Nenhum prêmio ainda';for(let k of ['nome','cor','volume','tempo','som','vitoria','suspense','logo','chance','estiloSom','fundo']){let el=$(k);if(el)el.type==='checkbox'?el.checked=!!db.config[k]:el.value=db.config[k]}$('volumeOut').textContent=db.config.volume+'%';$('tempoOut').textContent=db.config.tempo+' segundos';$('premios').innerHTML=db.premios.map(p=>`<div class="item premioResumo">${p.img?`<img src="${esc(p.img)}" onerror="this.style.display='none'">`:'🎁'} <span>${esc(p.nome)} <small>(${p.partes??1} partes)</small></span><button onclick="abrirConfigPremio('${p.id}')">⚙️ Configurar</button></div>`).join('');$('cupomSelect').innerHTML=db.cupons.filter(c=>!c.usado).map(c=>`<option value="${c.id}">${c.id}${c.premio?' (prêmio definido)':''}</option>`).join('');$('premioSelect').innerHTML=db.premios.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('');$('listaCupons').innerHTML=db.cupons.map(c=>`<div class="item"><span>${esc(c.id)} • ${c.usado?'Utilizado — '+(c.resultado||'resultado anterior não registrado'):c.premio?'Definido: '+(db.premios.find(p=>p.id===c.premio)?.nome||'Prêmio indisponível'):'Sem prêmio definido'}</span></div>`).join('');$('qtTente').value=db.config.repeticoes.tente;$('qtPerdeu').value=db.config.repeticoes.perdeu;$('qtProxima').value=db.config.repeticoes.proxima;$('limiteTente').value=db.config.limiteTente;const totalPremios=db.premios.reduce((n,p)=>n+Math.max(0,Math.min(100,Math.floor(Number(p.partes??1)||0))),0);const r=db.config.repeticoes;const totalSem=Math.max(0,Number(r.tente)||0)+Math.max(0,Number(r.perdeu)||0)+Math.max(0,Number(r.proxima)||0);if($('resumoPartes'))$('resumoPartes').textContent=`🎁 ${totalPremios} partes premiadas + ${totalSem} sem prêmio = ${totalPremios+totalSem} divisões na roleta`;draw();for(const [id,tipo] of [['corTente','tente'],['corPerdeu','perdeu'],['corProxima','proxima']]){if($(id))$(id).value=corDoItem({tipo})}renderSounds();renderPrizeCards();atualizarPreviewVisual()}
function renderPrizeCards(){let el=$('prizeCards');if(!el)return;el.innerHTML=[...db.premios,{id:'tente',nome:'Tente novamente',img:''},{id:'perdeu',nome:'Não foi desta vez',img:''},{id:'proxima',nome:'Fica para a próxima',img:''}].map(p=>`<div class="prizeCard" style="border-color:${corDoItem(p)}" data-prize="${esc(p.id)}">${p.img?`<img src="${esc(p.img)}" onerror="this.style.display='none'">`:'<div style="font-size:48px">'+(p.id==='tente'?'🔄':p.id==='perdeu'?'😢':p.id==='proxima'?'🍀':'🎁')+'</div>'}<strong>${esc(p.nome)}</strong></div>`).join('')}
function corPremio(id,cor){const p=db.premios.find(p=>p.id===id);if(p){p.cor=cor;salvar();draw();renderPrizeCards()}}
function corResultado(tipo,cor){db.config.coresResultados||={};db.config.coresResultados[tipo]=cor;salvar();draw();renderPrizeCards()}
function salvarConfig(){for(let k of ['nome','cor','volume','tempo','som','vitoria','suspense','chance','estiloSom']){let el=$(k);if(!el)continue;db.config[k]=el.type==='checkbox'?el.checked:['volume','tempo','chance'].includes(k)?Number(el.value):el.value}document.body.style.setProperty('--fundo',db.config.fundo?`url(\"${db.config.fundo.replace(/[\"\\]/g,'')}\")`:'none');db.config.chance=Math.max(0,Math.min(100,db.config.chance));salvar();$('volumeOut').textContent=db.config.volume+'%';$('tempoOut').textContent=db.config.tempo+' segundos';draw()}
function adicionarPremio(){let nome=$('pn').value.trim(),url=$('pi').value.trim(),file=$('pf').files[0];if(!nome)return alert('Informe o nome do prêmio');if(file&&file.size>200000) return alert('Para este protótipo, use uma imagem menor que 200 KB ou URL.');const add=(img)=>{db.premios.push({id:'p'+Date.now(),nome,img});salvar();$('pn').value='';$('pi').value='';$('pf').value='';render();if(!img)preencherImagemPremio(db.premios[db.premios.length-1].id,true)};if(file){let rd=new FileReader();rd.onload=()=>add(rd.result);rd.readAsDataURL(file)}else add(url)}
function removerPremio(id){if(!confirm('Excluir este prêmio?'))return;db.premios=db.premios.filter(p=>p.id!==id);db.cupons.forEach(c=>{if(c.premio===id)c.premio=null});salvar();render()}
function gerarCupons(){let n=Math.min(100,Math.max(1,Number($('qtd').value)||1));for(let i=0;i<n;i++)db.cupons.push({id:String(++db.sequencia).padStart(3,'0'),usado:false,premio:null});salvar();render();alert(n+' cupons gerados')}
function fixarPremio(){let c=db.cupons.find(c=>c.id===$('cupomSelect').value);if(!c)return alert('Sem cupom disponível');c.premio=$('premioSelect').value;salvar();render();alert('Prêmio definido para o cupom '+c.id)}
function resgatar(code){let v=db.vouchers.find(v=>v.codigo===code);if(v&&!v.resgatado&&confirm('Marcar como resgatado?')){v.resgatado=true;salvar();render()}}
function girar(){
 pararSomAnterior();if(ocupado)return;
 const c=db.cupons.find(c=>!c.usado);if(!c)return;
 const entries=fatias();if(!entries.length)return alert('Configure as divisões da roleta.');
 let indice=-1,escolhido=null;
 // Um prêmio só pode sair no cupom ao qual o Master o atribuiu.
 if(c.premio){indice=entries.findIndex(p=>p.id===c.premio);if(indice<0){return alert('O prêmio deste cupom não possui divisões na roleta. Configure ao menos uma parte para ele.')}escolhido=entries[indice]}
 else{
  let possiveis=entries.map((p,i)=>({p,i})).filter(x=>x.p.tipo);
  if((c.tentativasGratis||0)>=db.config.limiteTente)possiveis=possiveis.filter(x=>x.p.tipo!=='tente');
  if(!possiveis.length)return alert('Configure pelo menos uma divisão sem prêmio para os cupons não premiados.');
  const x=possiveis[Math.floor(Math.random()*possiveis.length)];indice=x.i;escolhido=x.p;
 }
 ocupado=true;initAudio();$('spin').disabled=true;$('msg').textContent='Girando...';
 const N=entries.length,step=2*Math.PI/N;
 let alvo=((2*Math.PI-indice*step-step/2)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
 let atual=((ang%(2*Math.PI))+2*Math.PI)%(2*Math.PI),delta=(alvo-atual+2*Math.PI)%(2*Math.PI);
 let inicial=ang,final=ang+Math.PI*2*7+delta,dur=db.config.tempo*1000,start=performance.now(),last=-1;
 function frame(now){
  let t=Math.min(1,(now-start)/dur),ease=1-Math.pow(1-t,db.config.suspense?4:3);
  ang=inicial+(final-inicial)*ease;
  let tick=Math.floor(ang/step);
  if(tick!==last){last=tick;if(soundSettings().giro.enabled)beep(600-t*240,.035,soundSettings().giro.volume/100)}
  draw();if(t<1){requestAnimationFrame(frame);return}
  ang=final;
  if(escolhido.tipo==='tente'){
   c.tentativasGratis=(c.tentativasGratis||0)+1;
   $('msg').textContent='🔄 Tente novamente! O cupom '+c.id+' continua disponível.';
   highlightPrize('tente');playEffect('tensao');
  }else{
   c.usado=true;c.resultado=escolhido.nome;
   if(!escolhido.tipo){
    let code='RP-'+Date.now().toString(36).toUpperCase();
    db.vouchers.push({codigo:code,cupom:c.id,nome:escolhido.nome,resgatado:false});
    $('msg').textContent='🎉 Cupom '+c.id+': '+escolhido.nome;
    highlightPrize(escolhido.id);celebrate();tocarSomPremio(escolhido);playEffect('ganhou');
   }else{
    $('msg').textContent='Cupom '+c.id+': '+escolhido.nome+'!';
    highlightPrize(escolhido.tipo);playEffect('perdeu');
   }
  }
  ocupado=false;salvar();render();highlightPrize(escolhido.tipo||escolhido.id);
 }
 requestAnimationFrame(frame);
}

function exportar(){let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='roleta-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function resetar(){if(confirm('Apagar dados locais da demonstração?')){db=defaults();salvar();render()}}
document.body.style.setProperty('--fundo',db.config.fundo?`url(\"${db.config.fundo.replace(/[\"\\]/g,'')}\")`:'none');if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
render();


// Busca automática experimental: Wikimedia Commons (arquivos com licença informada).
// Não usa a primeira resposta indiscriminadamente: verifica nome, categorias e metadados.
const imagemConsultas=[
[/gemini/i,'Google Gemini logo'],[/corte|barbear|cabelo/i,'barber haircut men'],
[/refrigerante|coca|guaraná/i,'soft drink bottle'],[/lavagem|lava.?rápido/i,'car wash'],
[/desconto|%/i,'discount sale icon'],[/pizza/i,'pizza food'],[/café/i,'coffee cup'],
[/brinde|surpresa/i,'gift box present']
];
function consultaImagem(nome){return (imagemConsultas.find(([rx])=>rx.test(nome))||[null,nome])[1]}
async function buscarImagemCoerente(nome,ignoradas=[]){
 const query=consultaImagem(nome);
 const api='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(query+' filetype:bitmap')+'&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=450&format=json&origin=*';
 const r=await fetch(api,{cache:'no-store'});if(!r.ok)throw Error('Serviço de imagens indisponível');
 const json=await r.json();const pages=Object.values(json.query?.pages||{});
 const words=query.toLowerCase().split(/\s+/).filter(w=>w.length>3);
 const candidates=pages.map(p=>{
  const info=p.imageinfo?.[0],meta=info?.extmetadata||{};
  const title=(p.title||'').toLowerCase(),desc=(meta.ImageDescription?.value||'').replace(/<[^>]*>/g,' ').toLowerCase();
  const license=meta.LicenseShortName?.value||'';
  const text=title+' '+desc;
  let score=words.reduce((n,w)=>n+(title.includes(w)?4:0)+(desc.includes(w)?1:0),0);
  if(/logo/i.test(query)&&/logo|icon|symbol/.test(text))score+=4;
  if(/discount|sale icon/i.test(query)&&/discount|sale/.test(text))score+=4;
  if(/photograph|photo/.test(text)&&!/logo|icon/.test(query))score+=1;
  if(/svg|webp|png|jpeg/i.test(info?.mime||''))score+=1;
  if(/no known copyright|public domain|cc0/i.test(license))score+=2;
  return {url:info?.thumburl||info?.url,source:info?.descriptionurl,license,score,title:p.title};
 }).filter(x=>x.url&&x.score>=3&&!ignoradas.includes(x.url)).sort((a,b)=>b.score-a.score);
 if(!candidates.length)throw Error('Nenhuma imagem suficientemente relacionada foi encontrada');
 return candidates[0];
}
async function preencherImagemPremio(id,automatico=false){
 const p=db.premios.find(x=>x.id===id);if(!p)return;
 const btn=document.getElementById('imgbtn_'+id);if(btn){btn.disabled=true;btn.textContent='🔎 Procurando...'}
 try{
  const img=await buscarImagemCoerente(p.nome,p.imagensIgnoradas||[]);
  if(!db.premios.some(x=>x.id===id))return;
  if(p.img && !p.img.startsWith('data:')){p.imagensIgnoradas||=[];if(!p.imagensIgnoradas.includes(p.img))p.imagensIgnoradas.push(p.img)}p.img=img.url;p.imgFonte=img.source;p.imgLicenca=img.license;salvar();render();
  if(!automatico)alert('Imagem encontrada e aplicada. Confira se ela corresponde ao prêmio; você pode substituir manualmente.');
 }catch(e){
  if(!automatico)alert('Não encontrei outra imagem adequada: '+e.message+'. Você pode escolher uma foto do celular ou excluir apenas a imagem.');
 }finally{if(btn){btn.disabled=false;btn.textContent='🔎 Buscar imagem'}} 
}
async function buscarImagensSemFoto(){
 const missing=db.premios.filter(p=>!p.img);
 for(const p of missing)await preencherImagemPremio(p.id,true);
}

// A busca inicial é opcional, iniciada pelo Master para evitar consultas a cada abertura.

function removerImagemPremio(id){
 const p=db.premios.find(x=>x.id===id);if(!p)return;
 if(!p.img)return alert('Este prêmio já está sem imagem.');
 if(!confirm('Excluir apenas a imagem? O prêmio e os cupons serão mantidos.'))return;
 p.img='';p.imgFonte='';p.imgLicenca='';p.imagensIgnoradas=[];
 salvar();render();
}
function imagemLocalPremio(id,input){
 const p=db.premios.find(x=>x.id===id),f=input.files?.[0];if(!p||!f)return;
 if(f.size>200000)return alert('Imagem muito grande para armazenamento local. Escolha uma foto menor que 200 KB.');
 const reader=new FileReader();
 reader.onload=()=>{p.img=reader.result;p.imgFonte='';p.imgLicenca='';salvar();render()};
 reader.readAsDataURL(f);
}

let premioAberto=null;
function abrirConfigPremio(id){const p=db.premios.find(x=>x.id===id);if(!p)return;premioAberto=id;const modal=$('premioModal');modal.hidden=false;$('premioNome').value=p.nome;$('premioCor').value=corDoItem(p);$('premioPartes').value=p.partes??1;$('premioImagem').src=p.img||'';$('premioImagem').hidden=!p.img;$('premioSomVolume').value=p.somVolume??80;$('premioSomAtivo').checked=p.somAtivo!==false;$('premioSomStatus').textContent=p.somNome?'🎵 '+p.somNome:'Nenhum áudio exclusivo selecionado';$('premioModalTitulo').textContent='⚙️ '+p.nome;}
function fecharConfigPremio(){$('premioModal').hidden=true;premioAberto=null;render()}
function salvarConfigPremio(){const p=db.premios.find(x=>x.id===premioAberto);if(!p)return;p.nome=$('premioNome').value.trim()||p.nome;p.cor=$('premioCor').value;p.partes=Math.max(0,Math.min(100,Math.floor(Number($('premioPartes').value)||0)));p.somVolume=Number($('premioSomVolume').value);p.somAtivo=$('premioSomAtivo').checked;salvar();abrirConfigPremio(p.id);render()}
async function outraImagemPremio(){const id=premioAberto;await preencherImagemPremio(id);abrirConfigPremio(id)}
function excluirImagemConfigurada(){const id=premioAberto;removerImagemPremio(id);abrirConfigPremio(id)}
function carregarImagemConfigurada(el){const id=premioAberto;imagemLocalPremio(id,el);setTimeout(()=>abrirConfigPremio(id),200)}
function excluirPremioConfigurado(){const id=premioAberto;removerPremio(id);fecharConfigPremio()}
const premioAudios={};
async function carregarSomPremio(el){const p=db.premios.find(x=>x.id===premioAberto),f=el.files?.[0];if(!p||!f)return;if(!(/audio\//.test(f.type)||/\.(mp3|wav|ogg|m4a)$/i.test(f.name)))return alert('Selecione um arquivo de áudio MP3/WAV.');if(f.size>8*1024*1024)return alert('Áudio máximo: 8 MB');try{const dbx=await audioDB;await new Promise((resolve,reject)=>{const tx=dbx.transaction('audios','readwrite');tx.objectStore('audios').put(f,'premio_'+p.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});if(premioAudios[p.id])URL.revokeObjectURL(premioAudios[p.id]);premioAudios[p.id]=URL.createObjectURL(f);p.somNome=f.name;p.somAtivo=true;salvar();abrirConfigPremio(p.id);alert('Som exclusivo salvo neste navegador.')}catch(e){alert('Erro ao salvar áudio: '+e.message)}}
async function audioDoPremio(p){if(premioAudios[p.id])return premioAudios[p.id];try{const dbx=await audioDB;const blob=await new Promise((resolve,reject)=>{const r=dbx.transaction('audios','readonly').objectStore('audios').get('premio_'+p.id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});if(blob)return premioAudios[p.id]=URL.createObjectURL(blob)}catch(e){}return null}
async function tocarSomPremio(p,teste=false){if(!p||!p.somNome||p.somAtivo===false||(!teste&&!db.config.som))return;const token=rodadaAudio;const url=await audioDoPremio(p);if(token!==rodadaAudio)return;if(!url){if(teste)alert('Áudio não disponível neste aparelho.');return}const a=acompanharAudio(new Audio(url));a.volume=Math.max(0,Math.min(1,(p.somVolume??80)/100*(teste?1:db.config.volume/100)));a.play().catch(()=>{if(teste)alert('Não foi possível reproduzir este áudio.')})}
function testarSomPremio(){tocarSomPremio(db.premios.find(x=>x.id===premioAberto),true)}
async function excluirSomPremio(){const p=db.premios.find(x=>x.id===premioAberto);if(!p||!p.somNome)return;if(!confirm('Excluir apenas o áudio deste prêmio?'))return;try{const dbx=await audioDB;await new Promise((resolve,reject)=>{const tx=dbx.transaction('audios','readwrite');tx.objectStore('audios').delete('premio_'+p.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){}if(premioAudios[p.id])URL.revokeObjectURL(premioAudios[p.id]);delete premioAudios[p.id];p.somNome='';salvar();abrirConfigPremio(p.id)}

// V12: fotos locais do logo e do fundo. Guardadas no navegador como JPEG compactado.
function atualizarPreviewVisual(){
 for(const campo of ['logo','fundo']){
  const area=$(campo+'Preview');if(!area)continue;
  const url=db.config[campo];
  area.innerHTML=url?`<img src="${esc(url)}" alt="Prévia ${campo}" style="width:100%;max-height:220px;object-fit:contain;border-radius:12px">`:'<small>Nenhuma imagem selecionada</small>';
 }
}
async function imagemVisualDoCelular(campo,input){
 const file=input.files?.[0];if(!file)return;
 if(!file.type.startsWith('image/'))return alert('Escolha um arquivo de imagem.');
 const reader=new FileReader();
 reader.onerror=()=>alert('Não foi possível abrir a foto.');
 reader.onload=()=>{
  const im=new Image();
  im.onerror=()=>alert('A foto não pôde ser lida.');
  im.onload=()=>{
   const limite=campo==='logo'?450:1000;
   const escala=Math.min(1,limite/Math.max(im.width,im.height));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(im.width*escala));canvas.height=Math.max(1,Math.round(im.height*escala));
   const ctx=canvas.getContext('2d');
   ctx.drawImage(im,0,0,canvas.width,canvas.height);
   const imagem=canvas.toDataURL('image/jpeg',campo==='logo'?.82:.68);
   const anterior=db.config[campo];db.config[campo]=imagem;
   try{salvar()}catch(e){db.config[campo]=anterior;return alert('O navegador ficou sem espaço para salvar. Escolha uma foto menor.')}
   if(campo==='fundo')document.body.style.setProperty('--fundo',`url("${imagem}")`);
   if(campo==='logo')draw();
   atualizarPreviewVisual();input.value='';
  };
  im.src=reader.result;
 };
 reader.readAsDataURL(file);
}
function excluirImagemVisual(campo){
 if(!confirm('Excluir esta imagem? Os demais dados da roleta serão mantidos.'))return;
 const anterior=db.config[campo];db.config[campo]='';
 try{salvar()}catch(e){db.config[campo]=anterior;return alert('Não foi possível salvar a alteração.')}
 if(campo==='fundo')document.body.style.setProperty('--fundo','none');
 if(campo==='logo')draw();
 atualizarPreviewVisual();
}
