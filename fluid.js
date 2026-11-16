/* Live liquid where The Doomsday Protocol and the Road to Secret Wars meet.
 *
 * One screen tall, drawn behind a page's content, see-through:
 *   - the EDGE quarter (top of Secret Wars, bottom of Doomsday) is a dark,
 *     slowly flowing liquid of the OTHER site's colour and black, glossy and
 *     glowing; this site's own colour streams into it as particles that swirl
 *     through the flow;
 *   - the rest of the screen is a faint liquid of this site's OWN colour that
 *     fades away.
 * The liquid is painted, not simulated (domain-warped noise, smooth at any
 * size); the particles are a small swarm moving through a matching flow
 * field. The pointer bends the liquid around it and scatters the particles.
 *
 * Usage (same file on both sites):
 *   EdgeLiquid(host, {edge:'top'|'bottom', edgeColor:[r,g,b], ownColor:[r,g,b]})
 * Runs only while on screen; reduced motion freezes the flow (the pointer
 * still moves it); without WebGL the host's CSS fallback shows.
 */
(function(){
"use strict";

function EdgeLiquid(host,opts){
  if(!host) return null;
  opts=opts||{};
  var TOP=opts.edge!=='bottom';
  var EDGE=opts.edgeColor||[0.55,0.87,0.30], OWN=opts.ownColor||[0.70,0.55,1.00];
  var canvas=document.createElement('canvas');
  canvas.setAttribute('aria-hidden','true');
  var gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,
                                    preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!gl){ host.classList.add('no-fluid'); return null; }
  host.insertBefore(canvas,host.firstChild);
  host.classList.add('has-fluid');
  var RM=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- the liquid ---------------- */
  var VS='attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}';
  var FS=[
    'precision highp float;varying vec2 vUv;',
    'uniform vec2 res;uniform float time,edgeTop;uniform vec3 edgeCol,ownCol;uniform vec4 ptr[8];',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}',
    // the flowing marble: warp the plane by noise, twice
    'float liquid(vec2 p,float t){',
    ' vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));',
    ' vec2 r=vec2(fbm(p+3.6*q+vec2(1.7,9.2)+.7*t),fbm(p+3.6*q+vec2(8.3,2.8)-.6*t));',
    ' return fbm(p+3.4*r);}',
    'void main(){',
    ' float aspect=res.x/res.y;',
    ' vec2 p=vec2(vUv.x*aspect,vUv.y)*1.7;',
    // the pointer drags the liquid round with it
    ' for(int i=0;i<8;i++){vec4 P=ptr[i];if(P.z<=0.)continue;',
    '  vec2 c=vec2(P.x*aspect,P.y)*1.7;vec2 d=p-c;float s=P.z*exp(-dot(d,d)*7.);',
    '  float a=s*P.w*2.2;p=c+mat2(cos(a),-sin(a),sin(a),cos(a))*d;}',
    ' float t=time*.045;',
    ' float f=liquid(p,t);',
    ' float e=.012;float fx=liquid(p+vec2(e,0.),t),fy=liquid(p+vec2(0.,e),t);',
    ' vec3 n=normalize(vec3((f-fx)/e*.06,(f-fy)/e*.06,1.));',
    ' float spec=pow(max(dot(n,normalize(vec3(-.4,.6,1.))),0.),40.);',
    ' float z=edgeTop>.5?1.-vUv.y:vUv.y;',             // 0 at the shared edge, 1 a screen away
    // edge quarter: the other site's colour and black, glossy
    ' float body=smoothstep(.36,.66,f);',
    ' float vein=smoothstep(.015,0.,abs(f-.56))*.9;',   // bright threads along the folds
    ' vec3 dark=mix(vec3(0.),edgeCol*.78,body)+edgeCol*vein*.6+spec*mix(vec3(1.),edgeCol,.3)*.45*body;',
    ' float darkA=mix(.94,.0,smoothstep(.0,.27,z));',
    ' dark*=.55+.45*smoothstep(.0,.07,z);',
    // the rest: a faint liquid of this site's own colour, fading out
    ' float own=smoothstep(.46,.78,f);',
    ' vec3 lite=ownCol*own*.5+ownCol*vein*.3+spec*ownCol*.3*own;',
    ' float fz=smoothstep(1.,.32,z)*smoothstep(.10,.30,z);',
    ' lite*=fz;',
    ' float liteA=clamp(max(lite.r,max(lite.g,lite.b))*1.25,0.,1.);',
    ' vec3 col=dark*darkA+lite;',
    ' float A=clamp(darkA+liteA,0.,1.);',
    ' gl_FragColor=vec4(col,A);}'
  ].join('\n');

  /* ---------------- the particles ---------------- */
  var PVS='attribute vec3 aP;attribute float aL;uniform float dpr;varying float vL;'+
    'void main(){vL=aL;gl_Position=vec4(aP.x*2.-1.,aP.y*2.-1.,0.,1.);gl_PointSize=aP.z*dpr;}';
  // particles glow only where the liquid is, so they read as suspended in it
  var PFS='precision mediump float;varying float vL;uniform vec3 col;uniform sampler2D uLiquid;uniform vec2 res;'+
    'void main(){vec2 d=gl_PointCoord-.5;float r=length(d);float core=smoothstep(.5,.0,r);float glow=core*core;'+
    'vec4 L=texture2D(uLiquid,gl_FragCoord.xy/res);float inL=clamp(max(L.r,max(L.g,L.b))*2.6,0.,1.);'+
    'float a=min(1.,glow*vL*(.10+.90*inL)*2.2);vec3 c=mix(col,vec3(1.),smoothstep(.25,.0,r)*.6);gl_FragColor=vec4(c*a,a);}';
  var CFS='precision mediump float;varying vec2 vUv;uniform sampler2D uTex;void main(){gl_FragColor=texture2D(uTex,vUv);}';

  function sh(type,src){ var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs,fs,attrs){ var p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));
    attrs.forEach(function(a,i){ gl.bindAttribLocation(p,i,a); }); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(var i=0;i<n;i++){ var nm=gl.getActiveUniform(p,i).name.replace(/\[0\]$/,''); u[nm]=gl.getUniformLocation(p,nm); }
    return {p:p,u:u}; }
  var L,PT,CP;
  try{ L=prog(VS,FS,['aPos']); PT=prog(PVS,PFS,['aP','aL']); CP=prog(VS,CFS,['aPos']); }
  catch(err){ canvas.remove(); host.classList.remove('has-fluid'); host.classList.add('no-fluid');
    if(window.console) console.warn('Edge liquid switched off:',err.message); return null; }

  var quad=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);

  var N=0, px,py,pz,page,pmax,pvx,pvy, pbuf=gl.createBuffer(), pdata, ldata, lbuf=gl.createBuffer();
  function makeParticles(){
    N=Math.max(400,Math.min(1800,Math.round(host.clientWidth*1.2)));
    px=new Float32Array(N);py=new Float32Array(N);pz=new Float32Array(N);
    page=new Float32Array(N);pmax=new Float32Array(N);pvx=new Float32Array(N);pvy=new Float32Array(N);
    pdata=new Float32Array(N*3); ldata=new Float32Array(N);
    for(var i=0;i<N;i++){ spawn(i); page[i]=Math.random()*pmax[i]; }
  }
  // z = distance from the shared edge (0..1). Particles are born in this
  // site's own liquid just past the quarter line and stream into the dark one.
  function zToY(z){ return TOP?1-z:z; }
  function spawn(i){
    var z=0.03+Math.random()*0.30;
    px[i]=Math.random(); py[i]=zToY(z);
    pz[i]=3.2+Math.pow(Math.random(),2.2)*7.5;           // CSS px: mostly fine, a few bright motes
    page[i]=0; pmax[i]=4+Math.random()*7;
    pvx[i]=0; pvy[i]=0;
  }

  /* ---------------- the pointer ---------------- */
  var trail=[]; // {x,y,s,spin}
  var last=null;
  addEventListener('pointermove',function(e){
    var r=host.getBoundingClientRect();
    var x=(e.clientX-r.left)/r.width, y=1-(e.clientY-r.top)/r.height;
    if(x<0||x>1||y<0||y>1){ last=null; return; }
    if(last){
      var dx=x-last.x, dy=y-last.y, sp=Math.min(1,Math.hypot(dx*(r.width/r.height),dy)*18);
      if(sp>0.02){
        var spin=(dx*(y-0.5)-dy*(x-0.5))>0?1:-1;
        trail.unshift({x:x,y:y,s:sp,spin:spin}); if(trail.length>8) trail.pop();
        wake();
      }
    }
    last={x:x,y:y};
  },{passive:true});
  addEventListener('scroll',function(){ last=null; },{passive:true});

  /* ---------------- run ---------------- */
  // the liquid is painted into a texture first, so the particles can see it
  var ltex=gl.createTexture(), lfbo=gl.createFramebuffer();
  function target(w,h){
    gl.bindTexture(gl.TEXTURE_2D,ltex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,lfbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,ltex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  function size(){
    // the liquid is soft, so it is painted at reduced resolution and stretched:
    // about 0.6 of a CSS pixel, and never more than ~700k pixels in all
    var sc=0.6, cw=host.clientWidth, ch=host.clientHeight;
    if(cw*ch*sc*sc>700000) sc=Math.sqrt(700000/(cw*ch));
    var w=Math.max(2,Math.round(cw*sc)), h=Math.max(2,Math.round(ch*sc));
    if(w===canvas.width && h===canvas.height) return false;
    canvas.width=w; canvas.height=h; target(w,h); makeParticles(); return true;
  }

  var t=Math.random()*100, visible=false, raf=0, prev=0;
  function flow(x,y,tt){
    // a gentle swirling field, close enough to the painted liquid to read as one
    var a=Math.sin(y*7.1+tt*0.9)+Math.cos(x*5.3-tt*0.6)*0.8+Math.sin((x+y)*9.0+tt*1.3)*0.4;
    var b=Math.cos(x*6.7-tt*0.7)+Math.sin(y*4.9+tt*0.5)*0.8+Math.cos((x-y)*8.0-tt*1.1)*0.4;
    return [a*0.026,b*0.020];
  }
  function stepParticles(dt){
    var aspect=canvas.width/canvas.height, toward=TOP?1:-1;
    for(var i=0;i<N;i++){
      page[i]+=dt;
      var f=flow(px[i]*aspect,py[i],t*0.6);
      var z=TOP?1-py[i]:py[i];
      // drift toward the edge while in this site's liquid, wander once inside the dark one
      var pull=z>0.27?0.020:0.004;
      var vx=f[0], vy=f[1]+toward*pull;
      for(var k=0;k<trail.length;k++){
        var T=trail[k]; if(T.s<=0.01) continue;
        var dx=(px[i]-T.x)*aspect, dy=py[i]-T.y, d2=dx*dx+dy*dy;
        if(d2<0.05){
          var w=T.s*Math.exp(-d2*60)*0.9;
          vx+=(-dy*T.spin*1.6+dx*0.8)*w/aspect; vy+=(dx*T.spin*1.6+dy*0.8)*w;
        }
      }
      pvx[i]+=(vx-pvx[i])*Math.min(1,dt*3); pvy[i]+=(vy-pvy[i])*Math.min(1,dt*3);
      px[i]+=pvx[i]*dt; py[i]+=pvy[i]*dt;
      if(px[i]<0) px[i]+=1; else if(px[i]>1) px[i]-=1;
      var life=page[i]/pmax[i];
      var fade=Math.min(1,page[i]*1.5)*Math.min(1,(1-life)*3);
      // brighter as they cross into the dark liquid, gone near the very edge
      var zz=TOP?1-py[i]:py[i];
      var lum=fade*(zz<0.27?1.0:0.35)*Math.min(1,zz*12);
      if(life>=1 || zz<0.0 || zz>0.45) spawn(i);
      pdata[i*3]=px[i]; pdata[i*3+1]=py[i]; pdata[i*3+2]=pz[i]; ldata[i]=Math.max(0,lum);
    }
    for(var k2=0;k2<trail.length;k2++) trail[k2].s*=Math.pow(0.12,dt);
  }

  var pa=new Float32Array(32);
  function draw(){
    gl.viewport(0,0,canvas.width,canvas.height);
    // liquid, into its texture
    gl.bindFramebuffer(gl.FRAMEBUFFER,lfbo);
    gl.disable(gl.BLEND);
    gl.useProgram(L.p);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.disableVertexAttribArray(1);
    gl.uniform2f(L.u.res,canvas.width,canvas.height);
    gl.uniform1f(L.u.time,t);
    gl.uniform1f(L.u.edgeTop,TOP?1:0);
    gl.uniform3f(L.u.edgeCol,EDGE[0],EDGE[1],EDGE[2]);
    gl.uniform3f(L.u.ownCol,OWN[0],OWN[1],OWN[2]);
    for(var k=0;k<8;k++){ var T=trail[k];
      pa[k*4]=T?T.x:0; pa[k*4+1]=T?T.y:0; pa[k*4+2]=T?T.s:0; pa[k*4+3]=T?T.spin:0; }
    gl.uniform4fv(L.u.ptr,pa);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    // the liquid onto the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(CP.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ltex);
    gl.uniform1i(CP.u.uTex,0);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    // particles, added on top as light, only where the liquid is
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(PT.p);
    gl.uniform3f(PT.u.col,OWN[0],OWN[1],OWN[2]);
    gl.uniform1i(PT.u.uLiquid,0);
    gl.uniform2f(PT.u.res,canvas.width,canvas.height);
    gl.uniform1f(PT.u.dpr,canvas.width/Math.max(1,host.clientWidth));
    gl.bindBuffer(gl.ARRAY_BUFFER,pbuf); gl.bufferData(gl.ARRAY_BUFFER,pdata,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,lbuf); gl.bufferData(gl.ARRAY_BUFFER,ldata,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,1,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.POINTS,0,N);
  }

  function frame(now){
    raf=0;
    if(!visible || document.hidden) return;
    var dt=Math.min((now-prev)/1000,0.05); prev=now;
    size();
    var still=RM && RM.matches;
    if(!still || trail.some(function(T){return T.s>0.02;})){ t+=dt; stepParticles(dt); }
    draw();
    raf=requestAnimationFrame(frame);
  }
  function wake(){ if(!raf && visible && !document.hidden){ prev=performance.now(); raf=requestAnimationFrame(frame); } }

  size();
  for(var w=0;w<90;w++) stepParticles(1/60);           // particles already spread out on first sight
  draw();
  if(window.IntersectionObserver){
    new IntersectionObserver(function(es){ visible=es[0].isIntersecting; wake(); },{rootMargin:'100px 0px'}).observe(host);
  } else { visible=true; wake(); }
  document.addEventListener('visibilitychange',wake);

  return {
    canvas:canvas,
    /* for testing the look: run for a number of seconds at exactly 60fps, draw once */
    advance:function(seconds){ for(var i=0,n=Math.round(seconds*60);i<n;i++){ t+=1/60; stepParticles(1/60); } draw(); },
    /* for testing the pointer: a move to (x,y) in 0..1 of the layer, y from the top */
    pointer:function(x,y){
      var r=host.getBoundingClientRect();
      window.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+x*r.width,clientY:r.top+y*r.height}));
    }
  };
}

window.EdgeLiquid=EdgeLiquid;
})();
