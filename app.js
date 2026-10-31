(() => {
 'use strict';
 const $=s=>document.querySelector(s);
 const money=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 const data={
  XAUUSD:{price:2742.36,step:.34,digits:2,entry:2738.50,sl:2730,tp:2755,side:'BUY',volume:.10},
  EURUSD:{price:1.0538,step:.00008,digits:4,entry:1.0552,sl:1.0580,tp:1.0490,side:'SELL',volume:.10}
 };
 let active='XAUUSD',chart=null,series=null,lines=[];
 const prices={XAUUSD:data.XAUUSD.price,EURUSD:data.EURUSD.price};
 const start=Math.floor(Date.now()/1000)-75*900;
 const fmt=(v,d)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 function candles(symbol){
  const m=data[symbol],out=[];let close=m.price-m.step*9;
  for(let i=0;i<76;i++){
   const open=close;close=open+(Math.random()-.47)*m.step*3;
   out.push({time:start+i*900,open,high:Math.max(open,close)+Math.random()*m.step,low:Math.min(open,close)-Math.random()*m.step,close});
  }
  out[out.length-1].close=m.price;out[out.length-1].high=Math.max(out[out.length-1].high,m.price);out[out.length-1].low=Math.min(out[out.length-1].low,m.price);
  return out;
 }
 function setLines(){
  if(!series)return;lines.forEach(l=>series.removePriceLine(l));lines=[];
  const m=data[active];
  lines.push(series.createPriceLine({price:m.tp,color:'#00D9AE',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'TP'}));
  lines.push(series.createPriceLine({price:m.sl,color:'#FF456B',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'SL'}));
 }
 function initChart(){
  const host=$('#chart');if(!host||!window.LightweightCharts)return;
  chart=LightweightCharts.createChart(host,{autoSize:true,layout:{background:{type:'solid',color:'#041326'},textColor:'#8FAED1',fontFamily:'DM Sans, sans-serif',fontSize:11},grid:{vertLines:{color:'#0b2943'},horzLines:{color:'#0b2943'}},rightPriceScale:{borderColor:'#17466e',scaleMargins:{top:.12,bottom:.14}},timeScale:{borderColor:'#17466e',timeVisible:true,secondsVisible:false},crosshair:{vertLine:{color:'#39749a',style:2},horzLine:{color:'#39749a',style:2}},handleScroll:true,handleScale:true});
  series=chart.addCandlestickSeries({upColor:'#00D9AE',downColor:'#FF456B',borderUpColor:'#00D9AE',borderDownColor:'#FF456B',wickUpColor:'#00D9AE',wickDownColor:'#FF456B',priceLineVisible:true});
  series.setData(candles(active));setLines();chart.timeScale().fitContent();
 }
 function refresh(){
  const g=prices.XAUUSD,e=prices.EURUSD;
  $('#gold-price').textContent=fmt(g,2);$('#euro-price').textContent=fmt(e,4);
  $('#gold-current').textContent=fmt(g,2);$('#euro-current').textContent=fmt(e,4);
  const goldPnl=(g-data.XAUUSD.entry)*100*.1;
  const euroPnl=(data.EURUSD.entry-e)*100000*.1;
  $('#gold-pnl').innerHTML=(goldPnl>=0?'+$':'−$')+money(Math.abs(goldPnl))+'<br>(+3.54%)';
  $('#euro-pnl').innerHTML=(euroPnl>=0?'+$':'−$')+money(Math.abs(euroPnl))+'<br>(+1.32%)';
  const pnl=goldPnl+euroPnl,balance=1248.32,equity=balance+pnl;
  $('#balance').textContent='$'+money(balance);$('#equity').textContent='$'+money(equity);
  $('#pnl').textContent=(pnl>=0?'+$':'−$')+money(Math.abs(pnl));
  $('#equity-change').textContent=(pnl>=0?'▲ +':'▼ ')+Math.abs(pnl/balance*100).toFixed(2)+'%';
  const m=data[active],p=prices[active];
  $('#chart-title').textContent=active;$('#chart-subtitle').textContent=active+' · 15 · cTrader';
  $('#ohlc-o').textContent=fmt(p-m.step*.7,m.digits);$('#ohlc-h').textContent=fmt(p+m.step*1.1,m.digits);
  $('#ohlc-l').textContent=fmt(p-m.step*.9,m.digits);$('#ohlc-c').textContent=fmt(p,m.digits);
 }
 function select(symbol){
  if(!data[symbol])return;active=symbol;
  document.querySelectorAll('[data-symbol]').forEach(b=>b.classList.toggle('active',b.dataset.symbol===symbol));
  if(series){series.setData(candles(symbol));setLines();chart.timeScale().fitContent();}
  refresh();
 }
 document.addEventListener('click',e=>{
  const market=e.target.closest('[data-symbol]');if(market){select(market.dataset.symbol);return;}
  const tab=e.target.closest('[data-tab]');if(tab){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab.dataset.tab));return;}
  const expand=e.target.closest('.expand');if(expand&&chart){const node=$('.chart-panel');node.classList.toggle('expanded');chart.timeScale().fitContent();}
 });
 $('#timeframe')?.addEventListener('change',()=>{if(series){series.setData(candles(active));chart.timeScale().fitContent();}});
 if(window.Telegram?.WebApp){window.Telegram.WebApp.ready();window.Telegram.WebApp.expand();}
 initChart();refresh();
 window.setInterval(()=>{
  for(const s of Object.keys(data)){const m=data[s];prices[s]+=(Math.random()-.49)*m.step*1.7;}
  const m=data[active],p=prices[active],time=Math.floor(Date.now()/1000); 
  if(series){const t=time-time%900;try{series.update({time:t,open:p,high:p+m.step*.55,low:p-m.step*.45,close:p+(Math.random()-.5)*m.step*.3});}catch(_){}}
  refresh();
 },1800);
 window.addEventListener('resize',()=>chart?.timeScale().fitContent());
})();