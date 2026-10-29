(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = { connected:false, sound:false, balance:10000, positions:[], selectedSide:'BUY', symbol:'XAUUSD', timeframe:'15m', page:'overview', dismissed:false };
  const market = {
    XAUUSD:{name:'Gold / US Dollar',price:2746.82,change:.42,step:.65},
    EURUSD:{name:'Euro / US Dollar',price:1.08542,change:.18,step:.00012},
    GBPUSD:{name:'British Pound / US Dollar',price:1.29412,change:-.11,step:.00015}
  };
  let price = market.XAUUSD.price, chartValues = [], chartTimer, pnlTimer;
  const fmt = (n, digits=2) => n.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const cash = n => (n<0?'−':'')+'$'+fmt(Math.abs(n));
  const pct = n => (n>=0?'+':'')+fmt(n,2)+'%';
  const escapeHtml = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function soundTick(kind='tap') {
    if(!state.sound) return;
    try {
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx) return;
      const ctx=new AudioCtx(), osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type='sine'; osc.frequency.value=kind==='success'?660:kind==='error'?190:440;
      gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(kind==='success'?.035:.018,ctx.currentTime+.012);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.095);
      osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.1);osc.onended=()=>ctx.close();
    } catch(e) {}
  }
  function toast(title, detail='') {
    const node=document.createElement('div');node.className='toast';node.innerHTML='<b>'+escapeHtml(title)+'</b>'+(detail?'<small>'+escapeHtml(detail)+'</small>':'');
    $('#toast-region').append(node);setTimeout(()=>{node.style.opacity='0';node.style.transform='translateY(4px)';node.style.transition='opacity .2s,transform .2s';setTimeout(()=>node.remove(),220)},3300);
  }
  function log(title, detail, marker='neutral') {
    const list=$('#activity-list'), item=document.createElement('div');item.className='activity-item';
    item.innerHTML='<span class="activity-marker '+marker+'">'+(marker==='gold'?'◇':marker==='green'?'✓':'•')+'</span><div><b>'+escapeHtml(title)+'</b><p>'+escapeHtml(detail)+'</p><small>JUST NOW</small></div>';
    list.prepend(item);while(list.children.length>5)list.lastElementChild.remove();
  }
  function setConnected(on) {
    state.connected=on;
    const status=$('#connection-state');status.classList.toggle('connected',on);status.innerHTML='<i></i><span>'+(on?'Demo connected':'Disconnected')+'</span>';
    $('#connect-btn').innerHTML=on?'<span class="button-symbol">↘</span> Disconnect demo':'<span class="button-symbol">↗</span> Connect demo';
    $('#connect-btn').classList.toggle('button-secondary',on);$('#connect-btn').classList.toggle('button-primary',!on);
    $('#monitor-title').textContent=on?'Demo account connected':'Ready to connect';
    $('#monitor-desc').textContent=on?'Simulated market updates are running.':'The demo environment is standing by.';
    $('#feed-status').textContent=on?'Streaming (simulated)':'Standby';$('#execution-status').textContent=on?'Local simulation only':'Simulation only';
    $('#feed-dot').classList.toggle('gray',!on);$('#execution-dot').classList.toggle('gray',!on);
    $('#risk-feed-detail').textContent=on?'Simulated prices updating normally':'Waiting for demo connection';$('#risk-feed-result').textContent=on?'PASS':'READY';
    if(on){toast('Demo environment connected','Sample account data is now updating locally.');log('Demo environment connected','Simulated market feed started. No broker API is connected.','green');soundTick('success');}
    else {toast('Demo environment disconnected','Simulated account remains available for inspection.');log('Demo environment disconnected','Market updates paused.','neutral');soundTick();}
    renderMetrics();if(!on)clearInterval(pnlTimer);else startPnl();
  }
  function startPnl(){clearInterval(pnlTimer);pnlTimer=setInterval(()=>{if(!state.connected)return;state.positions.forEach(p=>{p.mark=market[p.symbol].price+(Math.random()-.5)*market[p.symbol].step*8});renderPositions();renderMetrics()},2400)}
  function renderMetrics(){
    const pnl=state.positions.reduce((sum,p)=>sum+(p.side==='BUY'?1:-1)*(p.mark-p.entry)*p.volume*(p.symbol==='XAUUSD'?100:p.symbol==='EURUSD'||p.symbol==='GBPUSD'?100000:1),0);
    $('#balance').textContent=cash(state.balance);$('#equity').textContent=cash(state.balance+pnl);
    const pnlNode=$('#pnl');pnlNode.textContent=(pnl>=0?'+':'−')+'$'+fmt(Math.abs(pnl));pnlNode.classList.toggle('positive',pnl>=0);pnlNode.classList.toggle('negative',pnl<0);
    $('#pnl-percent').textContent=pct(pnl/state.balance*100);$('#pnl-percent').classList.toggle('positive',pnl>=0);$('#pnl-percent').classList.toggle('negative',pnl<0);
    $('#position-count').textContent=state.positions.length;$('#position-pill').textContent=state.positions.length;
  }
  function renderPositions(){
    const body=$('#positions-body');
    if(!state.positions.length){body.innerHTML='<tr class="empty-row"><td colspan="7"><div class="empty-state"><span class="empty-icon">⌁</span><b>No open positions</b><p>Connect the demo or add a test position to explore the interface.</p><button class="text-action" id="empty-add-btn">Add simulated position →</button></div></td></tr>';$('#empty-add-btn').addEventListener('click',openOrder);return}
    body.innerHTML=state.positions.map(p=>{const diff=(p.side==='BUY'?1:-1)*(p.mark-p.entry)*p.volume*(p.symbol==='XAUUSD'?100:100000);return '<tr><td><span class="symbol-cell">'+p.symbol+'</span></td><td><span class="side-badge '+p.side.toLowerCase()+'">'+p.side+'</span></td><td>'+fmt(p.volume,2)+'</td><td>'+fmt(p.entry,p.symbol==='XAUUSD'?2:5)+'</td><td>'+fmt(p.mark,p.symbol==='XAUUSD'?2:5)+'</td><td class="'+(diff>=0?'positive':'negative')+'">'+(diff>=0?'+':'−')+'$'+fmt(Math.abs(diff))+'</td><td><button class="text-action close-position" data-id="'+p.id+'">Close ×</button></td></tr>'}).join('');
    $$('.close-position').forEach(btn=>btn.addEventListener('click',()=>closePosition(Number(btn.dataset.id))));
  }
  function openOrder(){ $('#position-dialog').showModal();soundTick(); }
  function createPosition(){
    const symbol=$('#order-symbol').value, side=state.selectedSide, volume=Number($('#order-volume').value), entry=market[symbol].price;
    const p={id:Date.now(),symbol,side,volume,entry,mark:entry};state.positions.unshift(p);
    renderPositions();renderMetrics();$('#position-dialog').close();toast('Simulated position opened',side+' '+fmt(volume,2)+' lots of '+symbol);log('Simulated position opened',side+' '+fmt(volume,2)+' lots · '+symbol,'gold');soundTick('success');
    if(!state.connected)setConnected(true);
  }
  function closePosition(id){
    const idx=state.positions.findIndex(p=>p.id===id);if(idx<0)return;const p=state.positions[idx];
    const profit=(p.side==='BUY'?1:-1)*(p.mark-p.entry)*p.volume*(p.symbol==='XAUUSD'?100:100000);
    state.balance+=profit;state.positions.splice(idx,1);renderPositions();renderMetrics();toast('Simulated position closed','Illustrative realized P&L '+(profit>=0?'+':'−')+'$'+fmt(Math.abs(profit)));log('Simulated position closed',p.symbol+' · '+(profit>=0?'+':'−')+'$'+fmt(Math.abs(profit)),profit>=0?'green':'neutral');soundTick('success');
  }
  function initSeries(){let p=market[state.symbol].price;chartValues=[];for(let i=0;i<75;i++){p+=(Math.random()-.49)*market[state.symbol].step*2.2;chartValues.push(p)}chartValues[chartValues.length-1]=market[state.symbol].price;price=chartValues.at(-1)}
  function drawChart(){
    const canvas=$('#price-chart'), rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const w=rect.width,h=rect.height,pad={t:13,r:48,b:20,l:4};const vals=chartValues.length?chartValues:[market[state.symbol].price];const min=Math.min(...vals),max=Math.max(...vals),range=(max-min)||market[state.symbol].step*8;const lo=min-range*.15,hi=max+range*.15;
    const x=i=>pad.l+i*(w-pad.l-pad.r)/Math.max(1,vals.length-1);const y=v=>pad.t+(hi-v)/(hi-lo)*(h-pad.t-pad.b);
    ctx.clearRect(0,0,w,h);ctx.font='9px "DM Mono",monospace';ctx.textAlign='left';
    for(let i=0;i<5;i++){const yy=pad.t+i*(h-pad.t-pad.b)/4;ctx.strokeStyle='#202a35';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();const val=hi-i*(hi-lo)/4;ctx.fillStyle='#647283';ctx.fillText(fmt(val,state.symbol==='XAUUSD'?2:5),w-pad.r+7,yy+3)}
    const grad=ctx.createLinearGradient(0,pad.t,0,h-pad.b);grad.addColorStop(0,'rgba(217,173,90,.18)');grad.addColorStop(1,'rgba(217,173,90,0)');
    ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.lineTo(x(vals.length-1),h-pad.b);ctx.lineTo(x(0),h-pad.b);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.strokeStyle='#d9ad5a';ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.stroke();
    const last=vals.length-1,cy=y(vals[last]);ctx.setLineDash([3,4]);ctx.strokeStyle='#d9ad5a75';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,cy);ctx.lineTo(w-pad.r,cy);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(x(last),cy,3.1,0,Math.PI*2);ctx.fillStyle='#f0ca7c';ctx.fill();ctx.beginPath();ctx.arc(x(last),cy,6.5,0,Math.PI*2);ctx.strokeStyle='#d9ad5a55';ctx.stroke();
    ctx.fillStyle='#302819';ctx.fillRect(w-pad.r+2,cy-9,pad.r-4,18);ctx.fillStyle='#f0ca7c';ctx.textAlign='center';ctx.fillText(fmt(vals[last],state.symbol==='XAUUSD'?2:5),w-pad.r+(pad.r/2),cy+3);
    ctx.fillStyle='#657385';ctx.textAlign='left';ctx.fillText(state.timeframe==='15m'?'− 3h':'− '+state.timeframe,4,h-3);ctx.textAlign='right';ctx.fillText('NOW',w-pad.r-3,h-3);
  }
  function updateMarket(){
    const m=market[state.symbol];const old=price;price+=(Math.random()-.49)*m.step*(state.timeframe==='15m'?1.1:state.timeframe==='1h'?2:3.5);chartValues.push(price);if(chartValues.length>75)chartValues.shift();
    $('#market-price').textContent=fmt(price,state.symbol==='XAUUSD'?2:5);const change=(price-m.price)/m.price*100;const changeNode=$('#market-change');changeNode.textContent=pct(change);changeNode.classList.toggle('positive',change>=0);changeNode.classList.toggle('negative',change<0);$('#chart-time').textContent='Updated '+new Date().toLocaleTimeString('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' UTC';
    drawChart();
  }
  const pageCopy={overview:['Overview','A clear view of your trading environment.'],markets:['Markets','Follow the simulated instruments available in this preview.'],brain:['Brain','A transparent view of signal reasoning and decision context.'],audit:['Audit trail','A chronological record of simulated system events.'],risk:['Risk controls','Review the safeguards surrounding simulated orders.'],settings:['Preferences','Control how this preview behaves on your device.']};
  function navigate(page){
    state.page=page;$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#page-crumb').textContent=pageCopy[page]?.[0]||'Overview';$('#page-title').textContent=pageCopy[page]?.[0]||'Overview';$('#page-subtitle').textContent=pageCopy[page]?.[1]||'';
    if(page!=='overview'){
      const messages={
        markets:'Market watch · '+Object.keys(market).join(' · ')+'. Use the instrument selector to change the chart.',
        brain:'Signal status: OBSERVING. No trade recommendation is generated in this UI preview. The real trading engine is not connected.',
        audit:'Showing recent preview events only. No real broker, account, or trading records are accessed.',
        risk:'Risk gate is enabled in this simulation. Test positions use preset volume; this is not a live risk engine.',
        settings:'Interface sounds are '+(state.sound?'enabled':'disabled')+'. Use the sound control in the top bar to change this setting.'
      };
      toast(pageCopy[page][0],messages[page]||'Preview section');
      if(page==='markets')$('#symbol-select').focus({preventScroll:true});
      if(page==='audit')$('#activity-list').scrollIntoView({behavior:'smooth',block:'center'});
      if(page==='risk')$('.risk-summary').scrollIntoView({behavior:'smooth',block:'center'});
      if(page==='settings')$('#sound-toggle').scrollIntoView({behavior:'smooth',block:'center'});
      if(page==='brain')$('.monitoring-panel').scrollIntoView({behavior:'smooth',block:'center'});
    } else window.scrollTo({top:0,behavior:'smooth'});
    soundTick();
  }
  $$('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
  $$('[data-navigate]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.navigate)));
  $('#connect-btn').addEventListener('click',()=>setConnected(!state.connected));
  $('#sound-toggle').addEventListener('click',()=>{state.sound=!state.sound;$('#sound-state').textContent=state.sound?'ON':'OFF';$('#sound-toggle').style.borderColor=state.sound?'#78613a':'';toast('Interface sounds '+(state.sound?'enabled':'disabled'),state.sound?'Subtle local feedback sounds are on.':'Sounds are muted.');soundTick('success')});
  $('#symbol-select').addEventListener('change',e=>{state.symbol=e.target.value;$('#chart-symbol').textContent=state.symbol;$('#instrument-name').textContent=market[state.symbol].name;initSeries();updateMarket();soundTick()});
  $$('.timeframe').forEach(b=>b.addEventListener('click',()=>{$$('.timeframe').forEach(x=>x.classList.toggle('active',x===b));state.timeframe=b.dataset.time;initSeries();drawChart();soundTick()}));
  ['#open-position-btn','#add-position-btn','#empty-add-btn'].forEach(s=>{const el=$(s);if(el)el.addEventListener('click',openOrder)});
  $$('.direction-btn').forEach(b=>b.addEventListener('click',()=>{state.selectedSide=b.dataset.side;$$('.direction-btn').forEach(x=>x.classList.toggle('active',x===b));soundTick()}));
  $('#confirm-position').addEventListener('click',e=>{e.preventDefault();createPosition()});
  $('#banner-dismiss').addEventListener('click',()=>{$('#sim-banner').remove();state.dismissed=true});
  $('#clock').textContent='--:--:-- UTC';
  function clock(){const d=new Date();$('#clock').textContent=d.toLocaleTimeString('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' UTC'}
  initSeries();renderMetrics();renderPositions();drawChart();clock();setInterval(clock,1000);chartTimer=setInterval(updateMarket,1800);
  window.addEventListener('resize',drawChart);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)drawChart()});
})();