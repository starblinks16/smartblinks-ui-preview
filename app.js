(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const fmt = (n, d=2) => Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const markets = {
    XAUUSD:{price:2742.36,step:0.34,digits:2,entry:2738.50,sl:2730,tp:2755,side:'BUY',volume:0.1},
    EURUSD:{price:1.05382,step:0.00008,digits:5,entry:1.05520,sl:1.058,tp:1.049,side:'SELL',volume:0.1}
  };
  let symbol='XAUUSD', chart=null, candleSeries=null, timer=null;
  const baseTime=Math.floor(Date.now()/1000)-75*900;
  const prices={XAUUSD:markets.XAUUSD.price,EURUSD:markets.EURUSD.price};

  function makeCandles(key){
    const m=markets[key], out=[];
    let close=m.price-m.step*9;
    for(let i=0;i<76;i++){
      const open=close;
      close=open+(Math.random()-.46)*m.step*3;
      const high=Math.max(open,close)+Math.random()*m.step;
      const low=Math.min(open,close)-Math.random()*m.step;
      out.push({time:baseTime+i*900,open,high,low,close});
    }
    out[out.length-1].close=m.price;
    out[out.length-1].high=Math.max(out[out.length-1].high,m.price);
    out[out.length-1].low=Math.min(out[out.length-1].low,m.price);
    return out;
  }

  function drawChart(){
    const host=$('#chart');
    if(!host || !window.LightweightCharts) return;
    chart=LightweightCharts.createChart(host,{
      autoSize:true,
      layout:{background:{type:'solid',color:'#091321'},textColor:'#8996AA',fontFamily:'DM Sans, sans-serif',fontSize:10},
      grid:{vertLines:{color:'#17283B'},horzLines:{color:'#17283B'}},
      rightPriceScale:{borderColor:'#243A52',scaleMargins:{top:.12,bottom:.14}},
      timeScale:{borderColor:'#243A52',timeVisible:true,secondsVisible:false},
      crosshair:{vertLine:{color:'#55718E',width:1,style:2},horzLine:{color:'#55718E',width:1,style:2}},
      handleScroll:true,handleScale:true
    });
    candleSeries=chart.addCandlestickSeries({
      upColor:'#20D6A0',downColor:'#FF5572',borderUpColor:'#20D6A0',borderDownColor:'#FF5572',
      wickUpColor:'#20D6A0',wickDownColor:'#FF5572',
      priceLineVisible:true,lastValueVisible:true
    });
    candleSeries.setData(makeCandles(symbol));
    const m=markets[symbol];
    candleSeries.createPriceLine({price:m.tp,color:'#20D6A0',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'TP'});
    candleSeries.createPriceLine({price:m.sl,color:'#FF5572',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'SL'});
    chart.timeScale().fitContent();
  }

  function setSymbol(next){
    if(!markets[next]) return;
    symbol=next;
    document.querySelectorAll('[data-symbol],[data-chart-symbol]').forEach(b=>{
      const selected=(b.dataset.symbol||b.dataset.chartSymbol)===symbol;
      b.classList.toggle('active',!!b.dataset.symbol && selected);
      b.classList.toggle('selected',!!b.dataset.chartSymbol && selected);
    });
    $('#chart-title').innerHTML=symbol+' <span>M15</span>';
    if(candleSeries){
      candleSeries.setData(makeCandles(symbol));
      candleSeries.setMarkers([]);
      const m=markets[symbol];
      candleSeries.createPriceLine({price:m.tp,color:'#20D6A0',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'TP'});
      candleSeries.createPriceLine({price:m.sl,color:'#FF5572',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'SL'});
      chart.timeScale().fitContent();
    }
    refresh();
  }

  function refresh(){
    Object.keys(markets).forEach(key=>{
      const m=markets[key], p=prices[key], delta=(p-m.price)/m.price*100;
      const priceNode=key==='XAUUSD'?$('#gold-price'):$('#euro-price');
      const changeNode=key==='XAUUSD'?$('#gold-change'):$('#euro-change');
      if(priceNode) priceNode.textContent=fmt(p,m.digits);
      if(changeNode){changeNode.textContent=(delta>=0?'+':'')+fmt(delta+0.5,2)+'%';changeNode.className=delta>=0?'up':'down';}
      const pnl=(m.side==='BUY'?1:-1)*(p-m.entry)*m.volume*(key==='XAUUSD'?100:100000);
      const pnlNode=key==='XAUUSD'?$('#gold-pnl'):$('#euro-pnl');
      const currentNode=key==='XAUUSD'?$('#gold-current'):$('#euro-current');
      if(pnlNode){pnlNode.textContent=(pnl>=0?'+':'−')+'$'+fmt(Math.abs(pnl));pnlNode.className=pnl>=0?'up':'down';}
      if(currentNode) currentNode.textContent='→ '+fmt(p,m.digits);
    });
    const floating=Object.keys(markets).reduce((sum,key)=>{
      const m=markets[key];return sum+(m.side==='BUY'?1:-1)*(prices[key]-m.entry)*m.volume*(key==='XAUUSD'?100:100000);
    },0);
    const balance=10248.32,equity=balance+floating;
    $('#balance').textContent='$'+fmt(balance);
    $('#equity').textContent='$'+fmt(equity);
    $('#pnl').textContent=(floating>=0?'+':'−')+'$'+fmt(Math.abs(floating));
    $('#equity-delta').textContent=(floating>=0?'+':'−')+'$'+fmt(Math.abs(floating))+' floating';
    $('#open-count').innerHTML='02 <em>positions</em>';
    $('#position-count').textContent='02';
  }

  function tick(){
    Object.keys(markets).forEach(key=>{
      const m=markets[key];
      prices[key]+= (Math.random()-.49)*m.step*2.2;
    });
    const m=markets[symbol], last=prices[symbol], now=Math.floor(Date.now()/1000);
    const candle={time:now-(now%900),open:last,high:last+m.step*.7,low:last-m.step*.5,close:last+(Math.random()-.5)*m.step};
    prices[symbol]=candle.close;
    if(candleSeries){
      try{candleSeries.update(candle);}catch(_){}
      candleSeries.applyOptions({priceLineVisible:true});
    }
    refresh();
  }

  document.addEventListener('click',event=>{
    const marketButton=event.target.closest('[data-symbol],[data-chart-symbol]');
    if(marketButton){setSymbol(marketButton.dataset.symbol||marketButton.dataset.chartSymbol);return;}
    const tab=event.target.closest('[data-tab]');
    if(tab){
      document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===tab));
      return;
    }
    const action=event.target.closest('[data-action]');
    if(action && action.dataset.action==='brain') {
      document.querySelector('[data-tab="Brain"]')?.click();
    }
  });

  if(window.Telegram?.WebApp){
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    document.documentElement.style.setProperty('--tg-safe-top','0px');
  }
  drawChart();
  refresh();
  timer=window.setInterval(tick,1800);
  window.addEventListener('resize',()=>chart?.timeScale().fitContent());
})();