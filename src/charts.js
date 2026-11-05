/* ================= graphiques SVG (dessinés à la largeur réelle) ================= */
const CH=new Map();let chN=0;
function chart(spec){const id='ch'+(++chN);CH.set(id,spec);return `<div class="chart" id="${id}" style="height:${spec.h||220}px"></div>`}
function niceStep(range,count=4){if(range<=0)return 1;const raw=range/count,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p;return (f<1.5?1:f<3?2:f<7?5:10)*p}
function drawCharts(){
  for(const [id,spec] of CH){const el=document.getElementById(id);if(!el){CH.delete(id);continue}
    try{if(spec.type==='bars')drawBars(el,spec);else drawArea(el,spec)}catch(e){console.error(e)}}
}
function cssv(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||'#888'}
function drawArea(el,s){
  const W=Math.max(240,el.clientWidth),H=s.h||220;
  const series=s.series.filter(x=>x.pts&&x.pts.length);
  if(!series.length){el.innerHTML=`<div class="empty" style="height:100%;display:grid;place-items:center;padding:12px">${esc(s.empty||t('noData'))}</div>`;return}
  const n=Math.max(...series.map(x=>x.pts.length));
  const all=series.flatMap(x=>x.pts.map(p=>p.v)).concat(s.band?s.band.lo.concat(s.band.hi):[]);
  let lo=Math.min(...all),hi=Math.max(...all);
  if(s.zero){lo=Math.min(0,lo);hi=Math.max(0,hi)}
  if(hi===lo){hi+=1;lo-=1}
  const padY=(hi-lo)*.08;if(!s.zero||lo<0)lo-=padY;hi+=padY;
  const step=niceStep(hi-lo,s.ticks||4);lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
  const yAxis=s.axis!==false;
  const L=yAxis?(W<420?44:58):6,R=8,T=10,B=s.xl?26:8;
  const pw=W-L-R,ph=H-T-B;
  const X=i=>L+(n<=1?pw/2:i/(n-1)*pw),Y=v=>T+(hi-v)/(hi-lo)*ph;
  let g='';
  if(yAxis)for(let v=lo;v<=hi+step/2;v+=step){const y=Y(v);g+=`<line class="cgd" x1="${L}" x2="${W-R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="ct" x="${L-8}" y="${(y+3.5).toFixed(1)}" text-anchor="end">${esc((s.fy||compactT)(v))}</text>`}
  if(s.xl){const k=Math.min(n,W<480?4:6);const used=new Set();for(let j=0;j<k;j++){const i=Math.round(j*(n-1)/Math.max(1,k-1));if(used.has(i))continue;used.add(i);g+=`<text class="ct" x="${X(i).toFixed(1)}" y="${H-6}" text-anchor="${j===0?'start':j===k-1?'end':'middle'}">${esc(s.xl(i))}</text>`}}
  if(s.zero&&lo<0)g+=`<line class="cg" x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  let defs='',paths='';
  if(s.band){const up=s.band.hi.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`),dn=s.band.lo.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).reverse();paths+=`<polygon points="${up.concat(dn).join(' ')}" fill="${s.band.c||'var(--accent)'}" opacity=".14"/>`}
  series.forEach((sr,si)=>{
    const c=sr.c||'var(--accent)';
    const pts=sr.pts.map((p,i)=>[X(i),Y(p.v)]);
    const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join('');
    if(sr.fill!==false&&!sr.dash){const gid=el.id+'g'+si;defs+=`<linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${sr.op||.22}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
      paths+=`<path d="${d}L${pts[pts.length-1][0].toFixed(1)},${(T+ph).toFixed(1)}L${pts[0][0].toFixed(1)},${(T+ph).toFixed(1)}Z" fill="url(#${gid})"/>`}
    paths+=`<path class="cl" d="${d}" stroke="${c}" ${sr.dash?'stroke-dasharray="5 5" stroke-width="1.6"':''} ${sr.w?`stroke-width="${sr.w}"`:''}/>`;
    if(si===0&&s.endDot!==false){const p=pts[pts.length-1];paths+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="${c}" stroke="var(--surface)" stroke-width="2"/>`}
  });
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(s.label||'')}"><defs>${defs}</defs>${g}${paths}<g class="hov" opacity="0"><line class="cx" y1="${T}" y2="${T+ph}"/><circle r="5" fill="${series[0].c||'var(--accent)'}" stroke="var(--surface)" stroke-width="2"/></g><rect x="${L}" y="0" width="${pw}" height="${H}" fill="transparent" style="touch-action:pan-y"/></svg><div class="tip" hidden></div>`;
  if(!s.tip)return;
  const svg=el.querySelector('svg'),hov=svg.querySelector('.hov'),line=hov.querySelector('line'),dot=hov.querySelector('circle'),tip=el.querySelector('.tip');
  const move=e=>{const r=svg.getBoundingClientRect();const x=(e.clientX-r.left)*(W/r.width);const i=clamp(Math.round((x-L)/pw*(n-1)),0,n-1);
    const p=series[0].pts[i];if(!p)return;const cx=X(i),cy=Y(p.v);
    hov.setAttribute('opacity','1');line.setAttribute('x1',cx);line.setAttribute('x2',cx);dot.setAttribute('cx',cx);dot.setAttribute('cy',cy);
    tip.innerHTML=s.tip(i);tip.hidden=false;const px=cx*(r.width/W);tip.style.left=clamp(px,70,r.width-70)+'px';tip.style.top=(cy*(r.height/H))+'px';
    if(s.read){const rd=document.getElementById(s.read);if(rd)rd.innerHTML=s.tip(i)}};
  const out=()=>{hov.setAttribute('opacity','0');tip.hidden=true;if(s.read){const rd=document.getElementById(s.read);if(rd)rd.innerHTML=s.readDefault||''}};
  svg.addEventListener('pointermove',move);svg.addEventListener('pointerdown',move);svg.addEventListener('pointerleave',out);
}
function drawBars(el,s){
  const W=Math.max(240,el.clientWidth),H=s.h||200;
  const groups=s.groups;const n=groups.length;if(!n){el.innerHTML='';return}
  const k=s.keys.length;
  const vals=s.stack?groups.map(g=>sum(g.vals.map(v=>Math.max(0,v)))):groups.flatMap(g=>g.vals);let hi=Math.max(1,...vals),lo=s.stack?0:Math.min(0,...vals);
  const step=niceStep(hi-lo,4);hi=Math.ceil(hi/step)*step;lo=Math.floor(lo/step)*step;
  const L=W<420?40:52,R=6,T=8,B=24,pw=W-L-R,ph=H-T-B;
  const Y=v=>T+(hi-v)/(hi-lo)*ph,gw=pw/n,inner=s.stack?Math.min(gw*.62,26):Math.min(gw*.72,k*22),bw=s.stack?inner:Math.max(3,(inner-(k-1)*3)/k);
  let g='';for(let v=lo;v<=hi+step/2;v+=step){const y=Y(v);g+=`<line class="cgd" x1="${L}" x2="${W-R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="ct" x="${L-7}" y="${(y+3.5).toFixed(1)}" text-anchor="end">${esc((s.fy||compactT)(v))}</text>`}
  let b='';const skip=n>8&&W<520?2:1;
  groups.forEach((gr,i)=>{const x0=L+i*gw+(gw-inner)/2;
    if(gr.on)b+=`<rect x="${(L+i*gw+2).toFixed(1)}" y="${T-2}" width="${(gw-4).toFixed(1)}" height="${ph+4}" rx="6" fill="var(--surface2)"/>`;
    if(s.stack){let acc=0;gr.vals.forEach((v,j)=>{v=Math.max(0,v);if(!v)return;const y1=Y(acc+v),y0=Y(acc);acc+=v;b+=`<rect x="${x0.toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,y0-y1).toFixed(1)}" fill="${s.keys[j].c}" opacity="${gr.on||s.noDim?1:.8}"/>`})}
    else gr.vals.forEach((v,j)=>{const y1=Y(Math.max(0,v)),y0=Y(Math.min(0,v));b+=`<rect x="${(x0+j*(bw+3)).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(v?1.5:0,y0-y1).toFixed(1)}" rx="${Math.min(4,bw/2)}" fill="${s.keys[j].c}" opacity="${gr.on||s.noDim?1:.75}"/>`});
    if(i%skip===0||gr.on)b+=`<text class="ct${gr.on?' on':''}" x="${(L+i*gw+gw/2).toFixed(1)}" y="${H-7}" text-anchor="middle">${esc(gr.label)}</text>`;
    if(s.act)b+=`<rect x="${(L+i*gw).toFixed(1)}" y="0" width="${gw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer" data-a="${s.act}" data-v="${esc(gr.key??i)}"><title>${esc(gr.title||gr.label)}</title></rect>`;
  });
  if(lo<0)g+=`<line class="cg" x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(s.label||'')}">${g}${b}</svg>`;
}
function donut(segs,center,sub,act){
  const tot=sum(segs.map(s=>Math.max(0,s.v)));const R=42,C=2*Math.PI*R;let off=0;
  let arcs='';
  if(tot<=0)arcs=`<circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--surface3)" stroke-width="12"/>`;
  else segs.filter(s=>s.v>0).forEach(s=>{const len=s.v/tot*C;const gap=segs.length>1?Math.min(1.2,len*.2):0;
    arcs+=`<circle class="seg-arc" cx="50" cy="50" r="${R}" fill="none" stroke="${s.c}" stroke-width="12" stroke-dasharray="${Math.max(0,len-gap).toFixed(2)} ${(C-len+gap).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 50 50)"${act&&s.k?` data-a="${act}" data-v="${esc(s.k)}"`:''}><title>${esc(s.l)} · ${esc(pctT(s.v/tot))}</title></circle>`;off+=len});
  return `<div class="donut"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(sub||'')}">${arcs}</svg><div class="c"><div><b>${center}</b><span>${esc(sub||'')}</span></div></div></div>`;
}
function ring(p,c,label){const R=26,C=2*Math.PI*R,len=clamp(p,0,1)*C;return `<div class="ring"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--surface3)" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="${c||'var(--accent)'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}"/></svg><b>${label??Math.round(p*100)+'%'}</b></div>`}
function spark(vals,c){if(vals.length<2)return '';const lo=Math.min(...vals),hi=Math.max(...vals),r=hi-lo||1;const pts=vals.map((v,i)=>`${(i/(vals.length-1)*100).toFixed(1)},${(28-(v-lo)/r*26).toFixed(1)}`).join(' ');return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" style="width:90px;height:28px;display:block"><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`}
