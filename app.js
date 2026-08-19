/* The Doomsday Protocol - behaviour.
 * Reads PARTS / EXTENSIONS / POSTERS / COMPOSED from data.js, which must
 * already have loaded. Nothing here touches the data definitions.
 */
(function(){
"use strict";

/* Honour the OS "reduce motion" setting for programmatic scrolling too.
   The stylesheet flattens animations and transitions; page-flinging smooth
   scroll is only reachable from script, so it is read from the same query. */
var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
function sb(){ return (RM && RM.matches) ? 'auto' : 'smooth'; }

/* ============================================================
   YGGDRASIL BRANCH FIELD
   Timeline strands converging at the core and splaying wide at the
   ends — the shape Loki leaves behind at the end of Season 2.
   Seeded so the tree is identical on every load.
   ============================================================ */
(function growTree(){
  var dim=document.getElementById('treeDim'),
      lit=document.getElementById('treeLit'),
      pane=document.getElementById('paneTree');
  if(!dim||!lit||!pane) return;
  var seed=20261218;
  function rnd(){ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; }

  function grow(opts){
    var out=[], litOut=[];
    function branch(x,y,ang,len,w,depth,trunk){
      var x2=x+Math.cos(ang)*len, y2=y+Math.sin(ang)*len;
      // bow each strand so nothing reads as a straight spoke
      var bow=rnd()*0.85-0.42, along=0.28+rnd()*0.46;
      var mx=x+(x2-x)*along+Math.cos(ang+Math.PI/2)*len*bow;
      var my=y+(y2-y)*along+Math.sin(ang+Math.PI/2)*len*bow;
      var d='M'+x.toFixed(1)+','+y.toFixed(1)+' Q'+mx.toFixed(1)+','+my.toFixed(1)+' '+x2.toFixed(1)+','+y2.toFixed(1);
      out.push('<path d="'+d+'" stroke-width="'+w.toFixed(2)+'"'+
               (opts.stroke?' stroke="'+opts.stroke+'"':'')+
               (opts.fadeByDepth?' opacity="'+(0.30+depth*0.15).toFixed(2)+'"':'')+
               ' fill="none" stroke-linecap="round"/>');
      if(trunk && opts.lit){
        litOut.push('<path d="'+d+'" stroke="#6fae72" stroke-width="'+(w*0.5).toFixed(2)+'" fill="none" '+
                    'stroke-linecap="round" style="--len:'+Math.round(len*1.25)+';--d:'+(rnd()*9).toFixed(2)+'s"/>');
      }
      if(depth<=0) return;
      // deliberately lopsided: each side gets its own angle, length and weight,
      // limbs are sometimes dropped, and the whole node can kink off-axis
      var kink=(rnd()-0.5)*0.55;
      var sprL=opts.spread*(0.45+rnd()*1.25), sprR=opts.spread*(0.45+rnd()*1.25);
      if(rnd()>0.10) branch(x2,y2,ang+sprL+kink,len*(0.44+rnd()*0.46),w*(0.42+rnd()*0.30),depth-1,false);
      if(rnd()>0.14) branch(x2,y2,ang-sprR+kink,len*(0.44+rnd()*0.46),w*(0.42+rnd()*0.30),depth-1,false);
      if(depth>1 && rnd()>0.52) branch(x2,y2,ang+(rnd()-0.5)*1.5,len*(0.3+rnd()*0.4),w*0.4,depth-2,false);
      if(depth>2 && rnd()>0.80) branch(x2,y2,ang+(rnd()<0.5?-1:1)*(1.0+rnd()*0.7),len*0.34,w*0.32,depth-3,false);
    }
    opts.seeds.forEach(function(s){ branch(s[0],s[1],s[2],s[3],opts.width,opts.depth,true); });
    return [out.join(''),litOut.join('')];
  }

  // --- leaded stained glass: irregular panes with bright cores, as in the art
  var glass=document.getElementById('paneGlass'), gp=[];
  if(glass){
    // curved mullions running top to bottom, bowed away from centre
    for(var m=0;m<16;m++){
      var x=135+m*22.0, bow=(x-300)*0.16;
      gp.push('<path d="M'+x.toFixed(1)+',128 C'+(x+bow).toFixed(1)+',220 '+(x+bow).toFixed(1)+',380 '+(x+bow*0.4).toFixed(1)+',472" '+
              'stroke="#06170f" stroke-width="'+(3.4+rnd()*2.6).toFixed(1)+'" fill="none" opacity="'+(0.42+rnd()*0.34).toFixed(2)+'"/>');
    }
    // transoms
    for(var t2=0;t2<7;t2++){
      var y=150+t2*44+rnd()*10;
      gp.push('<path d="M128,'+y.toFixed(1)+' C220,'+(y-7).toFixed(1)+' 380,'+(y+7).toFixed(1)+' 472,'+y.toFixed(1)+'" '+
              'stroke="#06170f" stroke-width="'+(2.4+rnd()*2).toFixed(1)+'" fill="none" opacity="'+(0.34+rnd()*0.3).toFixed(2)+'"/>');
    }
    // hot cores glowing through the glass
    for(var c=0;c<22;c++){
      var ca=rnd()*Math.PI*2, cr=rnd()*150;
      gp.push('<ellipse cx="'+(300+Math.cos(ca)*cr).toFixed(1)+'" cy="'+(320+Math.sin(ca)*cr*0.86).toFixed(1)+'" '+
              'rx="'+(9+rnd()*26).toFixed(1)+'" ry="'+(14+rnd()*34).toFixed(1)+'" '+
              'transform="rotate('+(rnd()*180).toFixed(0)+' '+(300+Math.cos(ca)*cr).toFixed(1)+' '+(320+Math.sin(ca)*cr*0.86).toFixed(1)+')" '+
              'fill="#dcff8a" opacity="'+(0.05+rnd()*0.16).toFixed(2)+'"/>');
    }
    glass.innerHTML=gp.join('');
  }

  // --- etched detailing around the ring band
  var etch=document.getElementById('ringEtch'), ep=[];
  if(etch){
    for(var e2=0;e2<96;e2++){
      var ea=(e2/96)*Math.PI*2, long=(e2%8===0);
      var r1=long?175:182, r2=long?201:194;
      ep.push('<path d="M'+(300+Math.cos(ea)*r1).toFixed(1)+','+(300+Math.sin(ea)*r1).toFixed(1)+
              ' L'+(300+Math.cos(ea)*r2).toFixed(1)+','+(300+Math.sin(ea)*r2).toFixed(1)+
              '" opacity="'+(long?0.55:0.26)+'"/>');
    }
    etch.innerHTML=ep.join('');
  }

  // --- the world tree inside the mark: growing up from the base, into the light
  var paneSeeds=[];
  // main trunks rising from the base of the mark
  for(var p=0;p<15;p++){
    var a=-Math.PI/2 + (p-7)*0.185 + (rnd()-0.5)*0.14;
    paneSeeds.push([300+(p-7)*9, 476, a, 58+rnd()*34]);
  }
  // secondary growth creeping in from the sides of the disc
  for(var q=0;q<8;q++){
    var side=q%2?1:-1, yy=250+ (q>>1)*58 + rnd()*20;
    paneSeeds.push([300+side*152, yy, side>0? Math.PI+ (rnd()-0.5)*0.8 : (rnd()-0.5)*0.8, 40+rnd()*26]);
  }
  pane.innerHTML=grow({seeds:paneSeeds,width:9.5,depth:6,spread:0.36})[0];

  // --- the faint field beyond the mark
  var outerSeeds=[], TRUNKS=22;
  for(var i=0;i<TRUNKS;i++){
    var ang=(i/TRUNKS)*Math.PI*2 + (rnd()-0.5)*0.28;
    // horizontal strands run longer, so the field reads wide rather than round
    outerSeeds.push([300,300,ang,86*(0.72+Math.abs(Math.cos(ang))*0.55)]);
  }
  var outer=grow({seeds:outerSeeds,width:7,depth:5,spread:0.44,
                  stroke:'url(#treeG)',fadeByDepth:true,lit:true});
  dim.innerHTML=outer[0];
  lit.innerHTML=outer[1];

  // --- engraved ticks around the band
  var ticks=document.getElementById('ringTicks'), tp=[];
  if(!ticks){ tp=null; }
  for(var t=0;ticks&&t<72;t++){
    var ta=(t/72)*Math.PI*2;
    // skip the break in the upper right
    var deg=(ta*180/Math.PI+360)%360;
    if(deg>296 && deg<336) continue;
    var long=(t%6===0);
    var r1=long?185:190, r2=200;
    tp.push('<path d="M'+(300+Math.cos(ta)*r1).toFixed(1)+','+(300+Math.sin(ta)*r1).toFixed(1)+
            ' L'+(300+Math.cos(ta)*r2).toFixed(1)+','+(300+Math.sin(ta)*r2).toFixed(1)+
            '" opacity="'+(long?0.6:0.32)+'"/>');
  }
  if(ticks && tp) ticks.innerHTML=tp.join('');

  // --- particle field, as in the reference art
  var stars=document.getElementById('stars'), sp=[];
  for(var s=0;s<130;s++){
    var sa=rnd()*Math.PI*2, sr=180+rnd()*280;
    sp.push('<circle cx="'+(300+Math.cos(sa)*sr).toFixed(1)+'" cy="'+(300+Math.sin(sa)*sr).toFixed(1)+
            '" r="'+(0.6+rnd()*1.8).toFixed(2)+'" fill="#cdeccd" opacity="'+(0.10+rnd()*0.42).toFixed(2)+'"/>');
  }
  if(stars) stars.innerHTML=sp.join('');

  /* motes: two seeded tiles of small dark specks, offset in scale and density */
  (function motes(){
    var layer=document.getElementById('motes'); if(!layer) return;
    var seed=990617;
    function rnd(){ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; }
    function tile(size,count,rmin,rmax,alpha){
      var out='';
      for(var i=0;i<count;i++){
        var x=(rnd()*size).toFixed(1), y=(rnd()*size).toFixed(1);
        var r=(rmin+rnd()*(rmax-rmin)).toFixed(2);
        var a=(alpha*(0.35+rnd()*0.65)).toFixed(3);
        out+='<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#000" opacity="'+a+'"/>';
        // a faint green edge on a few of them, so they read as magic not dust
        if(rnd()>0.86) out+='<circle cx="'+x+'" cy="'+y+'" r="'+(+r+0.9).toFixed(2)+
          '" fill="none" stroke="#7fd94a" stroke-width="0.5" opacity="'+(a*0.5).toFixed(3)+'"/>';
      }
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+
              '" viewBox="0 0 '+size+' '+size+'">'+out+'</svg>';
      return 'url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg).replace(/"/g,'%22')+'")';
    }
    layer.style.backgroundImage=tile(520,46,0.8,2.6,0.85)+', '+tile(340,26,0.5,1.5,0.55);
  })();

  var vec=document.getElementById('emblemWrap');

  /* Draw the mark once and hand the browser a finished image. Live, this is
     thousands of paths inside blur filters and every repaint re-runs them. */
  (function bakeMark(){
    var layer=document.getElementById('markLayer');
    if(!layer||!vec) return;
    fetch('assets/doomsday-a.png').then(function(r){return r.blob();}).then(function(b){
      var fr=new FileReader();
      fr.onload=function(){
        var clone=vec.cloneNode(true);
        clone.removeAttribute('id'); clone.removeAttribute('style'); clone.removeAttribute('class');
        clone.setAttribute('width','1200'); clone.setAttribute('height','1200');
        clone.querySelectorAll('image').forEach(function(im){ im.setAttribute('href',fr.result); });
        var xml=new XMLSerializer().serializeToString(clone);
        var url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml).replace(/"/g,'%22');
        var probe=new Image();
        probe.onload=function(){
          layer.style.backgroundImage='url("'+url+'")';
          vec.classList.add('baked');       // keep it in the DOM as the source
        };
        probe.onerror=function(){};          // leave the live SVG showing
        probe.src=url;
      };
      fr.readAsDataURL(b);
    }).catch(function(){});
  })();

})();

/* ============================================================
   BUILD
   ============================================================ */
var KEY='doomsdayProtocol.v2';
var CORE=[], EXT=[];
PARTS.forEach(function(p){ p.items.forEach(function(it){ it._core=true; CORE.push(it); }); });
EXTENSIONS.forEach(function(p){ p.items.forEach(function(it){ it._core=false; EXT.push(it); }); });
CORE.forEach(function(it,i){ it.n=i+1; });
EXT.forEach(function(it,i){ it.n=i+1; });

/* Essential + Recommended: the titles Doomsday actually leans on. Disney+'s own
   fifteen-title official watchlist is a strict subset of this set. */
var EXPERIENCE=CORE.filter(function(i){return i.tier==='essential'||i.tier==='recommended';});

var watched={};
try{ watched=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ watched={}; }

var state={order:'release',filter:'all',q:''};

function hrs(m){return Math.round(m/60);}
function fmtRun(it){
  if(it.type==='film'||it.type==='special'||it.type==='short') return it.run+' min';
  return it.eps+' eps · ~'+hrs(it.run)+'h';
}
function typeLabel(t){return t==='film'?'Film':t==='series'?'Series':t==='special'?'Special':'Short';}
function tierLabel(t){return t==='essential'?'Essential':t==='recommended'?'Recommended':'Optional';}

var listEl=document.getElementById('list');
var extEl=document.getElementById('extList');

/* entries the reader has expanded — survives re-render */
var openIds={};
/* rendered parts, so counters can be updated without rebuilding the list */
var rendered=[];

function render(){
  rendered=[];
  var shown=renderGroups(PARTS,listEl,false);
  renderGroups(EXTENSIONS,extEl,true);
  document.getElementById('tlNotice').style.display = state.order==='timeline' ? 'flex' : 'none';
  document.getElementById('countNote').textContent='Showing '+shown+' of '+CORE.length+' core';
  indexRendered();
  updateStats();
}

function renderGroups(groups,target,isExt){
  var html='',shown=0,gi=0;
  groups.forEach(function(part){
    var items=part.items.slice();
    if(state.order==='timeline') items.sort(function(a,b){return a.tl-b.tl;});

    var visible=items.filter(passFilter);
    if(!visible.length){ gi++; return; }
    shown+=visible.length;

    var totalRun=items.reduce(function(s,i){return s+i.run;},0);
    var doneCount=items.filter(function(i){return watched[i.id];}).length;
    var pctPart=Math.round(doneCount/items.length*100);
    var key=(isExt?'x':'p')+(gi++);

    html+='<div class="part" data-part="'+key+'" id="part-'+key+'">';
    html+='<div class="part-head'+(isExt?' ext':'')+'"><div class="no">'+part.no+'</div><h3>'+part.title+'</h3><p>'+part.blurb+'</p></div>';
    html+='<div class="part-meta"><span>'+part.sub+'</span><span>'+items.length+' entries</span><span>~'+(totalRun<120?totalRun+' min':hrs(totalRun)+' hours')+'</span>'+
          '<span class="pm-done">'+doneCount+'/'+items.length+' done</span>'+
          '<button class="mark-all" data-markpart="'+key+'">'+(doneCount===items.length?'Clear this part':'Mark all watched')+'</button></div>';
    html+='<div class="part-bar"><i style="width:'+pctPart+'%"></i></div>';
    html+='<div class="part-list lglass">';

    visible.forEach(function(it){
      if(it.stop && state.order==='release'){
        html+='<div class="stop"><span class="ico">■</span><div><b>Stop point</b>'+it.stop+'</div></div>';
      }
      html+=entryHTML(it);
    });
    html+='</div></div>';
  });

  if(!shown) html='<div class="card empty glass">'+emptyMessage(isExt)+'</div>';
  target.innerHTML=html;
  return shown;
}

/* the empty state depends on WHY it is empty */
function emptyMessage(isExt){
  var pool=isExt?EXT:CORE;
  if(state.q) return 'No title matches <b>“'+state.q.replace(/</g,'&lt;')+'”</b>. Try a shorter search, or clear it.';
  if(state.filter==='todo'){
    var left=pool.filter(function(i){return !watched[i.id];}).length;
    if(!left) return isExt
      ? 'Every extension entry is ticked. Nothing left down here either.'
      : '<b>Everything is ticked.</b> The whole road is behind you — there is nothing left unwatched. Switch back to Everything to see the full list.';
  }
  if(state.filter==='essential' && isExt) return 'Nothing in the extensions is rated Essential — that is the point of them being extensions.';
  if(state.filter==='experience' && isExt) return 'The extensions are all Optional by definition, so none of them are part of the full experience.';
  if(state.filter==='films' && isExt) return 'No films in the extensions match. Some extension entries are shorts rather than features.';
  return 'Nothing matches the current filter. Switch back to Everything to see the full list.';
}

function passFilter(it){
  if(state.q && it.t.toLowerCase().replace(/&amp;/g,'&').indexOf(state.q)===-1) return false;
  // "Films only" means things you watch as a film — including cinema specials
  if(state.filter==='films' && !(it.type==='film' || (it.type==='special' && it.where==='Cinemas'))) return false;
  if(state.filter==='essential' && it.tier!=='essential') return false;
  if(state.filter==='experience' && it.tier==='optional') return false;
  if(state.filter==='todo' && watched[it.id]) return false;
  return true;
}

function entryHTML(it){
  var on=!!watched[it.id];
  var open=!!openIds[it.id];
  var h='';
  var plain=it.t.replace(/&amp;/g,'and').replace(/"/g,'');
  h+='<div class="entry'+(on?' done':'')+(open?' open':'')+'" data-id="'+it.id+'">';
  h+= posterHTML(it,plain,on);
  h+= '<div class="e-body" role="button" tabindex="0" aria-expanded="'+open+'">';
  h+=  '<div class="e-line1"><span class="e-no">'+String(it.n).padStart(2,'0')+'</span>';
  h+=   '<span class="e-title">'+it.t+'</span>';
  h+=   '<span class="e-year">'+it.y+'</span></div>';
  h+=  '<div class="e-line2">';
  h+=   '<span class="tag '+it.type+'">'+typeLabel(it.type)+'</span>';
  h+=   '<span class="tag '+(it.tier==='essential'?'ess':it.tier==='recommended'?'rec':'opt')+'">'+tierLabel(it.tier)+'</span>';
  h+=   '<span class="tag run">'+fmtRun(it)+'</span>';
  if(it.soon) h+='<span class="tag soon">Not out yet</span>';
  if(state.order==='timeline') h+='<span class="tag tl">'+tlLabel(it)+'</span>';
  h+=  '</div>';
  h+=  '<div class="detail">';
  h+=   '<div class="why"><b>Why it is on the list</b>'+it.why+'</div>';
  h+=   '<div class="dgrid">';
  h+=    '<div><span>Director</span><em>'+it.dir+'</em></div>';
  h+=    '<div><span>Where to watch</span><em>'+it.where+'</em></div>';
  h+=    '<div><span>Runtime</span><em>'+fmtRun(it)+'</em></div>';
  h+=    '<div><span>Timeline placing</span><em>'+tlLabel(it)+'</em></div>';
  h+=    '<div><span>Post-credits scenes</span><em>'+(it.soon?'Unknown':it.pc)+'</em></div>';
  h+=    '<div><span>Priority</span><em>'+tierLabel(it.tier)+'</em></div>';
  h+=   '</div>';
  if(it.intro) h+='<div class="dsub"><span>First appearances &amp; key beats</span>'+it.intro+'</div>';
  if(it.note) h+='<div class="dnote">Note: '+it.note+'</div>';
  h+=  '</div>';
  h+= '</div>';
  h+= '<div class="e-caret">&#9656;</div>';
  h+='</div>';
  return h;
}

/* A poster if one exists, otherwise a generated card carrying the title.
   The card sits underneath; a failed image simply uncovers it. */
function posterHTML(it,plain,on){
  var words=plain.replace(/^The\s+/,'').split(/[:\u2014-]/)[0].trim().split(/\s+/);
  var initials=words.slice(0,3).map(function(w){return w[0];}).join('');
  var url=POSTERS[it.id], theme=COMPOSED[it.id];
  var h='<button type="button" class="cb e-poster'+(theme?' composed':'')+(on?' on':'')+'"'+
        ' data-cb="'+it.id+'" role="checkbox" aria-checked="'+on+'"'+
        ' aria-label="Mark '+plain+' as watched"'+
        (theme?' style="--pt:'+theme+'"':'')+'>';
  // the card underneath, uncovered if nothing loads
  h+= '<span class="pfall"><b>'+initials.toUpperCase()+'</b><i>'+plain+'</i><u>'+it.y+'</u></span>';
  if(url){
    if(theme){
      h+= '<span class="pwash"></span>';
      h+= '<img class="plogo" src="'+url+'" alt="" loading="lazy" decoding="async" '+
          'referrerpolicy="no-referrer" onerror="this.remove()">';
      h+= '<span class="pyear">'+it.y+'</span>';
    } else {
      h+= '<img src="'+url+'" alt="" loading="lazy" decoding="async" '+
          'referrerpolicy="no-referrer" onerror="this.remove()">';
    }
  }
  h+= '<span class="ptick" aria-hidden="true"></span>';
  h+='</button>';
  return h;
}

function tlLabel(it){
  if(it.tlt) return it.tlt;
  if(it.tl>=9100 && it.tl<9200) return 'Multiverse';
  if(it.tl>=9000 && it.tl<9100) return 'Outside time';
  var y=Math.floor(it.tl);
  var disputed=[2016,2024,2025,2026,2027];
  return (disputed.indexOf(y)>-1?'~':'')+y;
}

/* One delegated listener per container, bound once — nothing to rebind on render */
function delegate(root){
  root.addEventListener('click',function(e){
    var cb=e.target.closest('.cb');
    if(cb){ e.preventDefault(); e.stopPropagation(); toggle(cb.dataset.cb); return; }
    var mark=e.target.closest('[data-markpart]');
    if(mark){ markPart(mark.dataset.markpart); return; }
    // the caret looks like the control for opening the row, so make it one
    var car=e.target.closest('.e-caret');
    if(car){ var en=car.parentNode; setOpen(en,!en.classList.contains('open')); return; }
    var body=e.target.closest('.e-body');
    if(body) setOpen(body.parentNode, !body.parentNode.classList.contains('open'));
  });
  root.addEventListener('keydown',function(e){
    if(e.key!==' ' && e.key!=='Enter') return;
    // .cb is a real <button>: the browser already turns Space/Enter into a
    // click, so handling it here too would toggle twice and cancel out.
    if(e.target.closest('.cb')) return;
    var body=e.target.closest('.e-body');
    if(body){ e.preventDefault(); setOpen(body.parentNode, !body.parentNode.classList.contains('open')); }
  });
}
delegate(listEl); delegate(extEl);

function setOpen(entry,open){
  entry.classList.toggle('open',open);
  entry.querySelector('.e-body').setAttribute('aria-expanded',open);
  if(open) openIds[entry.dataset.id]=1; else delete openIds[entry.dataset.id];
}

function save(){ try{ localStorage.setItem(KEY,JSON.stringify(watched)); }catch(e){} }

/* Surgical: touch only the affected rows and counters. No full re-render,
   so expanded panels stay open and a tick costs ~1ms instead of ~32ms. */
function toggle(id){
  if(watched[id]) delete watched[id]; else watched[id]=1;
  save(); paintEntry(id); refreshCounters(); updateStats();
  if(state.filter==='todo') render();   // the row must leave the list
}

function paintEntry(id){
  var on=!!watched[id];
  document.querySelectorAll('.entry[data-id="'+id+'"]').forEach(function(e){
    e.classList.toggle('done',on);
    var cb=e.querySelector('.cb');
    if(cb){ cb.classList.toggle('on',on); cb.setAttribute('aria-checked',on); }
  });
}

function indexRendered(){
  rendered=[];
  PARTS.concat(EXTENSIONS).forEach(function(part){
    var el=null;
    document.querySelectorAll('.part').forEach(function(p){
      if(p.querySelector('.part-head h3') && p.querySelector('.part-head h3').textContent===part.title) el=p;
    });
    if(el) rendered.push({part:part,el:el});
  });
}

function refreshCounters(){
  rendered.forEach(function(r){
    var items=r.part.items;
    var done=items.filter(function(i){return watched[i.id];}).length;
    var pct=Math.round(done/items.length*100);
    var lbl=r.el.querySelector('.pm-done'), bar=r.el.querySelector('.part-bar i'),
        btn=r.el.querySelector('[data-markpart]');
    if(lbl) lbl.textContent=done+'/'+items.length+' done';
    if(bar) bar.style.width=pct+'%';
    if(btn) btn.textContent=(done===items.length?'Clear this part':'Mark all watched');
  });
}

function markPart(key){
  var el=document.querySelector('.part[data-part="'+key+'"]'); if(!el) return;
  var r=null; rendered.forEach(function(x){ if(x.el===el) r=x; });
  if(!r) return;
  var items=r.part.items;
  var allDone=items.every(function(i){return watched[i.id];});
  items.forEach(function(i){ if(allDone) delete watched[i.id]; else watched[i.id]=1; });
  save();
  items.forEach(function(i){ paintEntry(i.id); });
  refreshCounters(); updateStats();
  if(state.filter==='todo') render();
  toast(allDone?'Part cleared':'Part marked as watched');
}

/* ============================================================
   STATS — core road only
   ============================================================ */
var DOOMSDAY=new Date('2026-12-18T00:00:00');

function updateStats(){
  var done=CORE.filter(function(i){return watched[i.id];});
  var totalMin=CORE.reduce(function(s,i){return s+i.run;},0);
  var doneMin=done.reduce(function(s,i){return s+i.run;},0);
  var leftMin=totalMin-doneMin;
  var pct=Math.round(done.length/CORE.length*100);

  document.getElementById('pct').textContent=pct+'%';
  document.getElementById('barFill').style.width=pct+'%';
  document.getElementById('sDone').textContent=done.length+' / '+CORE.length;
  document.getElementById('sHoursDone').textContent=hrs(doneMin)+'h';
  document.getElementById('sHoursLeft').textContent=hrs(leftMin)+'h';

  var daysLeft=Math.max(0,Math.ceil((DOOMSDAY-new Date())/86400000));
  var weeksLeft=Math.max(1,Math.ceil(daysLeft/7));
  document.getElementById('sWeeks').textContent=Math.ceil(daysLeft/7);
  document.getElementById('sPace').textContent=(leftMin/60/weeksLeft).toFixed(1)+'h';
  document.getElementById('sDaily').textContent=Math.round(leftMin/Math.max(1,daysLeft))+'m';

  var msgs=[
    'Nothing ticked yet. The road starts in a cave in Afghanistan.',
    'Started. The Infinity Saga is the longest unbroken stretch — after that it gets easier.',
    'A quarter of the road behind you. Keep going.',
    'Halfway. From here the multiverse stops being a rumour.',
    'Three quarters done. The hard part is finished.',
    'Almost there. Only the final run left.',
    'Protocol complete. You are ready for Doomsday.'
  ];
  var mi = pct>=100?6 : pct>=90?5 : pct>=75?4 : pct>=50?3 : pct>=25?2 : pct>0?1 : 0;
  document.getElementById('pcMsg').textContent=msgs[mi];
  // --- the priority bar: essential + recommended only
  var expDone=EXPERIENCE.filter(function(i){return watched[i.id];});
  var expTotalMin=EXPERIENCE.reduce(function(a,i){return a+i.run;},0);
  var expDoneMin=expDone.reduce(function(a,i){return a+i.run;},0);
  var expLeftMin=expTotalMin-expDoneMin;
  var expPct=Math.round(expDone.length/EXPERIENCE.length*100);
  document.getElementById('expPct').textContent=expPct+'%';
  document.getElementById('expFill').style.width=expPct+'%';
  document.getElementById('expDone').textContent=expDone.length+' / '+EXPERIENCE.length;
  document.getElementById('expLeft').textContent=hrs(expLeftMin)+'h';
  document.getElementById('expPace').textContent=Math.round(expLeftMin/Math.max(1,daysLeft))+'m';
  var expMsgs=[
    'Nothing ticked yet. '+EXPERIENCE.length+' titles stand between you and the full experience.',
    'Started. This is the set Doomsday actually leans on.',
    'A quarter of what matters is behind you.',
    'Halfway to the full experience.',
    'Three quarters. The rest is mostly the recent run.',
    'Nearly there — only a handful of the ones that matter left.',
    'Full experience unlocked. Anything else is for the love of it.'
  ];
  var ei = expPct>=100?6 : expPct>=90?5 : expPct>=75?4 : expPct>=50?3 : expPct>=25?2 : expPct>0?1 : 0;
  document.getElementById('expMsg').textContent=expMsgs[ei];
  document.getElementById('srExp').textContent=
    expPct+' per cent of the essential and recommended set watched, '+expDone.length+' of '+EXPERIENCE.length+'.';

  document.getElementById('srProgress').textContent=
    pct+' per cent complete. '+done.length+' of '+CORE.length+' entries watched, '+hrs(leftMin)+' hours remaining.';

  updatePlanner(leftMin);
}

function updatePlanner(leftMin){
  var el=document.getElementById('targetDate');
  var out=document.getElementById('plannerOut');
  if(!el.value){ out.textContent='—'; return; }
  var d=new Date(el.value+'T00:00:00');
  var days=Math.ceil((d-new Date())/86400000);
  if(isNaN(days)){ out.textContent='—'; return; }
  if(days<=0){ out.textContent='That date has passed.'; return; }
  if(leftMin<=0){ out.textContent='Nothing left to watch.'; return; }
  var perDay=leftMin/days;
  out.textContent=Math.round(perDay)+' min/day for '+days+' days ('+(perDay/60).toFixed(1)+'h daily)';
}
document.getElementById('targetDate').addEventListener('change',function(){ updateStats(); });

/* ============================================================
   COUNTDOWN
   ============================================================ */
var SECRETWARS=new Date('2027-12-17T00:00:00');
var cdTarget=DOOMSDAY;
var LABELS={
  '2026-09-25T00:00:00':'25 September 2026 · Endgame Encore in cinemas',
  '2026-12-18T00:00:00':'18 December 2026'
};

document.getElementById('cdSwitch').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#cdSwitch button').forEach(function(x){x.classList.remove('on');});
  b.classList.add('on');
  cdTarget=new Date(b.dataset.t);
  document.getElementById('cdTarget').textContent=LABELS[b.dataset.t];
  tick();
});

function paint(prefix,target){
  var diff=target-new Date();
  if(diff<0) diff=0;
  var s=Math.floor(diff/1000);
  document.getElementById(prefix+'D').textContent=Math.floor(s/86400);
  document.getElementById(prefix+'H').textContent=String(Math.floor(s%86400/3600)).padStart(2,'0');
  document.getElementById(prefix+'M').textContent=String(Math.floor(s%3600/60)).padStart(2,'0');
  document.getElementById(prefix+'S').textContent=String(s%60).padStart(2,'0');
}
function tick(){
  paint('cd',cdTarget);
  paint('sw',SECRETWARS);
}
tick(); setInterval(tick,1000);

document.getElementById('swGap').textContent=
  Math.round((SECRETWARS-DOOMSDAY)/86400000)+' days after Doomsday';

/* ============================================================
   CONTROLS
   ============================================================ */
document.querySelectorAll('[data-order]').forEach(function(b){
  b.addEventListener('click',function(){
    document.querySelectorAll('[data-order]').forEach(function(x){x.classList.remove('on');});
    b.classList.add('on'); state.order=b.dataset.order; render();
  });
});
document.querySelectorAll('[data-filter]').forEach(function(b){
  b.addEventListener('click',function(){
    document.querySelectorAll('[data-filter]').forEach(function(x){x.classList.remove('on');});
    b.classList.add('on'); state.filter=b.dataset.filter; render();
  });
});
var searchEl=document.getElementById('search');
var searchSticky=document.getElementById('searchSticky');
var stickyBar=document.getElementById('stickySearch');

function applySearch(v,from){
  state.q=v.trim().toLowerCase();
  if(from!==searchEl) searchEl.value=v;
  if(from!==searchSticky) searchSticky.value=v;
  render();
}
searchEl.addEventListener('input',function(){ applySearch(searchEl.value,searchEl); });
searchSticky.addEventListener('input',function(){ applySearch(searchSticky.value,searchSticky); });

/* the bare search tile follows you down; everything else stays at the top */
var ctlWrap=document.getElementById('controls'), sPending=false;
function stickyCheck(){
  sPending=false;
  var past=ctlWrap.getBoundingClientRect().bottom < 4;
  var listEnd=document.getElementById('listZone').getBoundingClientRect().bottom > 120;
  stickyBar.classList.toggle('show', past && listEnd);
}
addEventListener('scroll',function(){ if(!sPending){ sPending=true; requestAnimationFrame(stickyCheck); } },{passive:true});
addEventListener('resize',stickyCheck);
stickyCheck();

document.getElementById('btnUp').addEventListener('click',function(){
  ctlWrap.scrollIntoView({behavior:sb(),block:'start'});
  setTimeout(function(){ searchEl.focus(); },450);
});

document.addEventListener('keydown',function(e){
  if(e.key!=='/' ) return;
  var a=document.activeElement;
  if(a===searchEl||a===searchSticky) return;
  e.preventDefault();
  (stickyBar.classList.contains('show')?searchSticky:searchEl).focus();
});

function toast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); },2200);
}

document.getElementById('btnReset').addEventListener('click',function(){
  if(!confirm('Clear every tick, including the extensions, and start the protocol from zero?')) return;
  watched={};
  try{ localStorage.removeItem(KEY); }catch(e){}
  render(); toast('Progress cleared');
});

/* fold the filter rows away on small screens */
var ctlEl=document.getElementById('controls'), foldBtn=document.getElementById('btnFold');
foldBtn.addEventListener('click',function(){
  var folded=ctlEl.classList.toggle('folded');
  foldBtn.setAttribute('aria-expanded',String(!folded));
  foldBtn.textContent=folded?'Filters':'Hide filters';
});
if(window.innerWidth>760) ctlEl.classList.remove('folded');

/* jump-to-part navigation */
function buildNav(){
  var nav=document.getElementById('partNav');
  nav.innerHTML=PARTS.map(function(p,i){
    return '<button class="chip nav" data-jump="p'+i+'">'+p.no.replace('Part ','')+'. '+p.title+'</button>';
  }).join('')+'<button class="chip nav" data-jump="ext">Extensions</button>';
}
buildNav();
document.getElementById('partNav').addEventListener('click',function(e){
  var b=e.target.closest('[data-jump]'); if(!b) return;
  var target = b.dataset.jump==='ext'
    ? document.getElementById('extensions')
    : document.getElementById('part-'+b.dataset.jump);
  if(target) target.scrollIntoView({behavior:sb(),block:'start'});
});

/* save / load progress as a file, so it can move between devices */
document.getElementById('btnExpFilter').addEventListener('click',function(){
  document.querySelectorAll('[data-filter]').forEach(function(x){x.classList.remove('on');});
  var b=document.querySelector('[data-filter="experience"]');
  if(b) b.classList.add('on');
  state.filter='experience'; render();
  document.getElementById('listZone').scrollIntoView({behavior:sb(),block:'start'});
});

document.getElementById('btnExport').addEventListener('click',function(){
  var payload={app:'doomsday-protocol',version:2,saved:new Date().toISOString(),watched:watched};
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='doomsday-protocol-progress.json';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },0);
  toast('Progress saved to a file');
});
document.getElementById('btnImport').addEventListener('click',function(){ document.getElementById('fileIn').click(); });
document.getElementById('fileIn').addEventListener('change',function(e){
  var f=e.target.files && e.target.files[0]; if(!f) return;
  var fr=new FileReader();
  fr.onload=function(){
    try{
      var data=JSON.parse(fr.result);
      var w=(data && data.watched) ? data.watched : data;
      if(!w || typeof w!=='object') throw new Error('shape');
      var valid={},known={},n=0;
      CORE.concat(EXT).forEach(function(i){ known[i.id]=1; });
      Object.keys(w).forEach(function(k){ if(known[k]){ valid[k]=1; n++; } });
      watched=valid; save(); render();
      toast(n+' entries restored');
    }catch(err){ toast('That file could not be read'); }
    e.target.value='';
  };
  fr.onerror=function(){ toast('That file could not be read'); e.target.value=''; };
  fr.readAsText(f);
});

document.getElementById('btnShare').addEventListener('click',function(){
  var done=CORE.filter(function(i){return watched[i.id];});
  var extDone=EXT.filter(function(i){return watched[i.id];});
  var pct=Math.round(done.length/CORE.length*100);
  var daysLeft=Math.max(0,Math.ceil((DOOMSDAY-new Date())/86400000));
  var clean=function(i){return '  '+String(i.n).padStart(2,'0')+'. '+i.t.replace(/&amp;/g,'&');};
  var txt='The Doomsday Protocol — '+pct+'% of the core road ('+done.length+'/'+CORE.length+' entries). '
        +daysLeft+' days until Avengers: Doomsday.\n\nCore road watched:\n'
        +(done.length?done.map(clean).join('\n'):'  (nothing yet)')
        +'\n\nExtensions watched ('+extDone.length+'/'+EXT.length+'):\n'
        +(extDone.length?extDone.map(clean).join('\n'):'  (nothing yet)');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(function(){ toast('Progress copied to clipboard'); },
                                           function(){ toast('Could not copy — clipboard blocked'); });
  } else { toast('Clipboard not available in this browser'); }
});

/* ============================================================
   INSTALL AS AN APP
   ============================================================ */
if('serviceWorker' in navigator){
  addEventListener('load',function(){
    navigator.serviceWorker.register('sw.js',{scope:'./'}).then(function(reg){
      // if a new version is waiting, take it on the next load
      reg.addEventListener('updatefound',function(){
        var w=reg.installing;
        if(w) w.addEventListener('statechange',function(){
          if(w.state==='installed' && navigator.serviceWorker.controller) w.postMessage('skip-waiting');
        });
      });
    }).catch(function(){ /* offline support simply stays off */ });
  });
}

var deferredPrompt=null, installBtn=document.getElementById('btnInstall');
addEventListener('beforeinstallprompt',function(e){
  e.preventDefault(); deferredPrompt=e;
  if(installBtn) installBtn.hidden=false;
});
if(installBtn) installBtn.addEventListener('click',function(){
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function(c){
    if(c.outcome==='accepted'){ installBtn.hidden=true; toast('Installing…'); }
    deferredPrompt=null;
  });
});
addEventListener('appinstalled',function(){
  if(installBtn) installBtn.hidden=true;
  toast('Installed. Look for it with your apps.');
});

document.getElementById('stamp').textContent=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
document.getElementById('topTally').textContent=
  CORE.length+' core · '+EXT.length+' extension · ~'+hrs(CORE.reduce(function(s,i){return s+i.run;},0))+'h';

render();
})();
