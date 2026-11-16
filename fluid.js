/* Live liquid where The Doomsday Protocol and the Road to Secret Wars meet.
 *
 * One screen tall, drawn behind a page's content, see-through:
 *   - the EDGE quarter (top of Secret Wars, bottom of Doomsday) is a dark,
 *     slowly flowing liquid of the OTHER site's colour and black; right at the
 *     edge the two colours marble into each other under a glowing lip;
 *   - particles of this site's colour are suspended in it;
 *   - the rest of the screen carries faint veins of this site's own colour.
 *
 * Physics, kept honest:
 *   - the liquid is painted from flowing noise (smooth at any size);
 *   - every frame a small FLOW MAP is rendered from that same liquid - the
 *     direction its folds run - and read back, so particles travel along the
 *     currents you can actually see instead of an invented wind;
 *   - particles have mass and drag (bigger = heavier and nearer, so they move
 *     a little faster across the screen, like depth), a touch of Brownian
 *     jitter, soft buoyancy that keeps them in the edge quarter, and they
 *     bounce gently off the edge;
 *   - the pointer drags the liquid like a finger through paint: a smear in
 *     the direction of travel, kept in a displacement field that relaxes back
 *     slowly; particles in its path pick up its momentum and coast on;
 *   - a scroll gives particles a push they carry with inertia, and the
 *     liquid briefly quickens, then settles.
 *
 * Usage (same file on both sites):
 *   EdgeLiquid(host, {edge:'top'|'bottom', edgeColor:[r,g,b], ownColor:[r,g,b]})
 * Runs only while on screen; reduced motion stops the ambient flow (the
 * pointer still moves it); without WebGL the host's CSS fallback shows.
 */
(function(){
"use strict";

function EdgeLiquid(host,opts){
  if(!host) return null;
  opts=opts||{};
  var TOP=opts.edge!=='bottom';
  var EDGE=opts.edgeColor||[0.50,0.95,0.36], OWN=opts.ownColor||[0.70,0.55,1.00];
  var canvas=document.createElement('canvas');
  canvas.setAttribute('aria-hidden','true');
  var gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,
                                    preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!gl){ host.classList.add('no-fluid'); return null; }
  host.insertBefore(canvas,host.firstChild);
  host.classList.add('has-fluid');
  var RM=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ================= shaders ================= */
  var VS='attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}';
  // shared: noise, the liquid, and where a point of the screen sits in it
  var COMMON=[
    'precision highp float;varying vec2 vUv;',
    'uniform vec2 res;uniform float time;uniform sampler2D uDisp;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}',
    // the flowing marble: warp the plane by noise, twice
    'float liquid(vec2 p,float t){',
    ' vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));',
    ' vec2 r=vec2(fbm(p+3.6*q+vec2(1.7,9.2)+.7*t),fbm(p+3.6*q+vec2(8.3,2.8)-.6*t));',
    ' return fbm(p+3.4*r);}',
    // the liquid coordinate of a screen point: the pointer's smears pull it back along their path
    'vec2 place(vec2 uv){float aspect=res.x/res.y;vec2 d=(texture2D(uDisp,uv).xy-.5)*2.;',
    ' return vec2(uv.x*aspect,uv.y)*1.7-d*.55;}'
  ].join('\n');

  var LIQ=COMMON+'\n'+[
    'uniform float edgeTop;uniform vec3 edgeCol,ownCol;',
    // colour ramp: black -> deep saturated -> the colour -> a soft glint; never muddy
    'vec3 ramp(vec3 c,float x){vec3 deep=c*c*.42;vec3 v=mix(vec3(0.),deep,smoothstep(0.,.4,x));',
    ' v=mix(v,c,smoothstep(.35,.85,x));return mix(v,mix(c,vec3(1.),.28),smoothstep(.9,1.,x));}',
    'void main(){',
    ' float aspect=res.x/res.y;',
    ' vec2 p=place(vUv);',
    ' float t=time*.045;',
    ' float f=liquid(p,t);',
    ' float e=.012;float fx=liquid(p+vec2(e,0.),t),fy=liquid(p+vec2(0.,e),t);',
    ' vec3 n=normalize(vec3((f-fx)/e*.06,(f-fy)/e*.06,1.));',
    ' float spec=pow(max(dot(n,normalize(vec3(-.4,.6,1.))),0.),40.);',
    ' float z=edgeTop>.5?1.-vUv.y:vUv.y;',             // 0 at the shared edge, 1 a screen away
    ' float dens=smoothstep(.0,.27,z);',
    ' float body=smoothstep(.30+.08*dens,.66+.04*dens,f);',
    ' float vein=smoothstep(.018,0.,abs(f-.56));',
    ' float g=fbm(p*1.6+vec2(t*1.7,-t));',
    ' float other=smoothstep(.46,.62,g)*(1.-smoothstep(.0,.11,z));',
    ' vec3 ec=mix(edgeCol,ownCol,other);',
    ' vec3 dark=ramp(ec,body)+ec*vein*.75+spec*mix(vec3(1.),ec,.3)*.5*body;',
    ' float darkA=mix(.95,.0,smoothstep(.0,.27,z));',
    ' float luma=dot(edgeCol,vec3(.3,.59,.11));dark*=clamp(.55/luma,.62,1.25);',
    ' dark*=.72+.28*smoothstep(.0,.09,z);',
    ' vec3 lipCol=mix(edgeCol,ownCol,.5+.5*sin(vUv.x*aspect*4.+time*.45));',
    ' float flare=smoothstep(.42,.78,fbm(vec2(vUv.x*aspect*2.6+time*.12,time*.2)));',
    ' float lip=exp(-z/.009)*(.15+.85*flare)*(.5+.5*body)*.62;',
    ' float own=smoothstep(.55,.83,f);',
    ' vec3 lite=ramp(ownCol,own)*.55+ownCol*vein*.45+spec*ownCol*.3*own;',
    ' lite*=smoothstep(1.,.35,z)*smoothstep(.12,.30,z)*.8;',
    ' float liteA=clamp(max(lite.r,max(lite.g,lite.b))*1.25,0.,1.);',
    ' vec3 col=dark*darkA+lite+lipCol*lip;',
    ' float A=clamp(darkA+liteA+lip,0.,1.);',
    ' gl_FragColor=vec4(col,A);}'
  ].join('\n');

  // the flow map: which way the liquid's folds run at each point, and how
  // strongly (r,g = direction, b = strength)
  var FLOW=COMMON+'\n'+[
    'void main(){',
    ' vec2 p=place(vUv);float t=time*.045;float e=.02;',
    ' float f=liquid(p,t),fx=liquid(p+vec2(e,0.),t),fy=liquid(p+vec2(0.,e),t);',
    ' vec2 g=vec2(fx-f,fy-f)/e;',
    ' vec2 tan=vec2(-g.y,g.x);float m=length(tan);',
    ' vec2 d=m>1e-4?tan/m:vec2(0.);',
    ' gl_FragColor=vec4(.5+.5*d,clamp(m*.6,0.,1.),1.);}'
  ].join('\n');

  // the displacement field the pointer smears into; relaxes slowly back to rest
  var DISP=[
    'precision highp float;varying vec2 vUv;uniform sampler2D uPrev;uniform vec2 res,texel;uniform float keep;',
    'uniform vec4 seg[8];',                              // x,y, dx,dy of this frame's pointer moves
    'void main(){',
    ' vec2 c=texture2D(uPrev,vUv).xy-.5;',
    ' vec2 b=(texture2D(uPrev,vUv+vec2(texel.x,0.)).xy+texture2D(uPrev,vUv-vec2(texel.x,0.)).xy',
    '        +texture2D(uPrev,vUv+vec2(0.,texel.y)).xy+texture2D(uPrev,vUv-vec2(0.,texel.y)).xy)*.25-.5;',
    ' vec2 d=mix(c,b,.18);',                            // spreads a little
    // fades slowly - with a minimum step, or 8-bit storage would freeze small smears in place
    ' d=sign(d)*max(abs(d)*keep-.0042,0.);',
    ' float aspect=res.x/res.y;',
    ' for(int i=0;i<8;i++){vec4 S=seg[i];if(S.z==0.&&S.w==0.)continue;',
    '  vec2 q=vec2((vUv.x-S.x)*aspect,vUv.y-S.y);float w=exp(-dot(q,q)/.0035);',
    '  d+=vec2(S.z*aspect,S.w)*w*5.;}',
    ' d=clamp(d,-.5,.5);',
    ' gl_FragColor=vec4(d+.5,0.,1.);}'
  ].join('\n');

  var PVS='attribute vec3 aP;attribute float aL;attribute vec3 aC;uniform float dpr;varying float vL;varying vec3 vC;'+
    'void main(){vL=aL;vC=aC;gl_Position=vec4(aP.x*2.-1.,aP.y*2.-1.,0.,1.);gl_PointSize=aP.z*dpr;}';
  // particles glow only where the liquid is, so they read as suspended in it
  var PFS='precision mediump float;varying float vL;varying vec3 vC;uniform sampler2D uLiquid;uniform vec2 res;'+
    'void main(){vec2 d=gl_PointCoord-.5;float r=length(d);float core=smoothstep(.5,.0,r);float glow=core*core;'+
    'vec4 L=texture2D(uLiquid,gl_FragCoord.xy/res);float inL=clamp(max(L.r,max(L.g,L.b))*2.6,0.,1.);'+
    'float a=min(1.,glow*vL*(.10+.90*inL)*2.2);vec3 c=mix(vC,vec3(1.),smoothstep(.25,.0,r)*.6);gl_FragColor=vec4(c*a,a);}';
  var COPY='precision mediump float;varying vec2 vUv;uniform sampler2D uTex;void main(){gl_FragColor=texture2D(uTex,vUv);}';

  function sh(type,src){ var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs,fs,attrs){ var p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));
    attrs.forEach(function(a,i){ gl.bindAttribLocation(p,i,a); }); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(var i=0;i<n;i++){ var nm=gl.getActiveUniform(p,i).name.replace(/\[0\]$/,''); u[nm]=gl.getUniformLocation(p,nm); }
    return {p:p,u:u}; }
  var P={};
  try{
    P.liq=prog(VS,LIQ,['aPos']); P.flow=prog(VS,FLOW,['aPos']); P.disp=prog(VS,DISP,['aPos']);
    P.copy=prog(VS,COPY,['aPos']); P.part=prog(PVS,PFS,['aP','aL','aC']);
  }catch(err){
    canvas.remove(); host.classList.remove('has-fluid'); host.classList.add('no-fluid');
    if(window.console) console.warn('Edge liquid switched off:',err.message); return null;
  }

  var quad=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);

  /* ================= render targets ================= */
  function rt(w,h){
    var tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    var fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.viewport(0,0,w,h); gl.clearColor(0.5,0.5,0,1); gl.clear(gl.COLOR_BUFFER_BIT);   // 0.5 = no displacement
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return {tex:tex,fb:fb,w:w,h:h};
  }
  var liqT, flowT, dispA, dispB, FW=0, FH=0, flowPix=null;
  function targets(w,h){
    liqT=rt(w,h);
    FW=96; FH=Math.max(16,Math.round(96*h/w));
    flowT=rt(FW,FH); flowPix=new Uint8Array(FW*FH*4);
    var dw=128, dh=Math.max(16,Math.round(128*h/w));
    dispA=rt(dw,dh); dispB=rt(dw,dh);
  }

  /* ================= particles ================= */
  var N=0, px,py,vx,vy,sz,ms,age,life,cdata,pdata,ldata, pbuf=gl.createBuffer(), lbuf=gl.createBuffer(), cbuf=gl.createBuffer();
  function zToY(z){ return TOP?1-z:z; }
  function zOf(y){ return TOP?1-y:y; }
  function makeParticles(){
    N=Math.max(600,Math.min(2700,Math.round(host.clientWidth*1.8)));
    px=new Float32Array(N);py=new Float32Array(N);vx=new Float32Array(N);vy=new Float32Array(N);
    sz=new Float32Array(N);ms=new Float32Array(N);age=new Float32Array(N);life=new Float32Array(N);
    cdata=new Float32Array(N*3);pdata=new Float32Array(N*3);ldata=new Float32Array(N);
    for(var i=0;i<N;i++){ spawn(i); age[i]=Math.random()*life[i]; }
  }
  function spawn(i){
    var z=Math.pow(Math.random(),1.15)*0.27;            // thickest at the edge
    px[i]=Math.random(); py[i]=zToY(z);
    vx[i]=0; vy[i]=0;
    sz[i]=2.6+Math.pow(Math.random(),2.2)*7.0;          // CSS px
    ms[i]=0.55+sz[i]/7;                                  // bigger = heavier
    age[i]=0; life[i]=6+Math.random()*9;
    var r=Math.random(), c=OWN;
    if(r<0.06) c=[1,1,1]; else if(z<0.08 && r<0.40) c=EDGE;
    cdata[i*3]=c[0]; cdata[i*3+1]=c[1]; cdata[i*3+2]=c[2];
  }
  // the flow map, sampled smoothly
  function flowAt(x,y){
    var fx=Math.min(FW-1.001,Math.max(0,x*FW-0.5)), fy=Math.min(FH-1.001,Math.max(0,y*FH-0.5));
    var ix=fx|0, iy=fy|0, ax=fx-ix, ay=fy-iy, o=[0,0,0];
    for(var k=0;k<4;k++){
      var dx=k&1, dy=k>>1, w=(dx?ax:1-ax)*(dy?ay:1-ay), j=((iy+dy)*FW+(ix+dx))*4;
      o[0]+=w*(flowPix[j]/127.5-1); o[1]+=w*(flowPix[j+1]/127.5-1); o[2]+=w*flowPix[j+2]/255;
    }
    return o;
  }
  function gauss(){ return (Math.random()+Math.random()+Math.random()-1.5)*1.15; }

  /* ================= pointer ================= */
  var segs=[], pend=[], lastP=null, lastT=0;
  addEventListener('pointermove',function(e){
    var r=host.getBoundingClientRect();
    var x=(e.clientX-r.left)/r.width, y=1-(e.clientY-r.top)/r.height;
    if(x<0||x>1||y<0||y>1){ lastP=null; return; }
    var now=performance.now();
    if(lastP && now-lastT<120){
      var dx=x-lastP.x, dy=y-lastP.y;
      if(Math.abs(dx)+Math.abs(dy)>0.0005){
        pend.push([x,y,dx,dy,Math.max(16,now-lastT)/1000]);   // never faster than one move per frame
        if(pend.length>8) pend.shift();
        wake();
      }
    }
    lastP={x:x,y:y}; lastT=now;
  },{passive:true});

  /* ================= scroll ================= */
  var lastSY=window.scrollY, push=0, quick=0;
  addEventListener('scroll',function(){
    lastP=null;
    push+=(window.scrollY-lastSY)/Math.max(1,host.clientHeight); lastSY=window.scrollY;
    wake();
  },{passive:true});

  /* ================= step ================= */
  var t=Math.random()*100;
  function stepParticles(dt){
    var aspect=canvas.width/canvas.height, toward=TOP?1:-1;
    // momentum from the pointer this frame (uv per second), and a scroll push
    var moves=segs, kick=Math.max(-0.5,Math.min(0.5,push)); push=0;
    if(kick) quick=Math.min(2.5,quick+Math.abs(kick)*5);
    for(var i=0;i<N;i++){
      var f=flowAt(px[i],py[i]);
      var z=zOf(py[i]);
      // the current along the liquid's folds, faster for the nearer (bigger) particles
      var sp=0.030*(0.55+sz[i]/9)*(0.35+0.65*f[2])*(1+quick*0.6);
      var tx=f[0]*sp/aspect, ty=f[1]*sp;
      // soft buoyancy: drifting out of the edge quarter, they are drawn back in
      if(z>0.22) ty+=toward*0.06*Math.min(1,(z-0.22)/0.08);
      // drag toward the current; heavier particles respond more slowly
      var drag=Math.min(1,dt*2.4/ms[i]);
      vx[i]+=(tx-vx[i])*drag; vy[i]+=(ty-vy[i])*drag;
      // a little Brownian jitter, less for heavier ones
      var j=0.010*Math.sqrt(dt)/ms[i]; vx[i]+=gauss()*j/aspect; vy[i]+=gauss()*j;
      // the pointer: particles in its path take on its velocity and coast on
      for(var k=0;k<moves.length;k++){
        var M=moves[k], ddx=(px[i]-M[0])*aspect, ddy=py[i]-M[1], d2=ddx*ddx+ddy*ddy;
        if(d2<0.02){
          var w=Math.exp(-d2/0.0025)/ms[i];
          var mvx=M[2]/M[4], mvy=M[3]/M[4];
          vx[i]+=(mvx*0.55-vx[i])*Math.min(1,w*0.5); vy[i]+=(mvy*0.55-vy[i])*Math.min(1,w*0.5);
        }
      }
      // a scroll: the page moves, the particles lag behind it, then settle
      if(kick) vy[i]-=kick*0.9/ms[i];
      px[i]+=vx[i]*dt; py[i]+=vy[i]*dt;
      if(px[i]<0) px[i]+=1; else if(px[i]>1) px[i]-=1;
      // a gentle bounce off the shared edge
      z=zOf(py[i]);
      if(z<0){ py[i]=zToY(-z); vy[i]=-vy[i]*0.35; z=-z; }
      age[i]+=dt;
      var lf=age[i]/life[i];
      if(lf>=1 || z>0.40){ spawn(i); lf=0; z=zOf(py[i]); }
      var fade=Math.min(1,age[i]*0.8)*Math.min(1,(1-lf)*2.5);
      var lum=fade*(0.25+0.75*(1-Math.min(1,Math.max(0,(z-0.12)/0.17))))*Math.min(1,Math.max(0,(0.36-z)/0.08));
      lum*=0.86+0.14*Math.sin(age[i]*2.3+i);            // a slow shimmer
      pdata[i*3]=px[i]; pdata[i*3+1]=py[i]; pdata[i*3+2]=sz[i]; ldata[i]=Math.max(0,lum);
    }
    quick*=Math.pow(0.25,dt);
  }

  /* ================= draw ================= */
  function bindQuad(){
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
  }
  function to(T){ gl.bindFramebuffer(gl.FRAMEBUFFER,T?T.fb:null); gl.viewport(0,0,T?T.w:canvas.width,T?T.h:canvas.height); }
  function tex(unit,T){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,T.tex); return unit; }
  var segArr=new Float32Array(32);

  function updateDisp(dt){
    // this frame's pointer moves become this frame's smears
    segs=pend; pend=[];
    for(var k=0;k<8;k++){ var S=segs[k];
      segArr[k*4]=S?S[0]:0; segArr[k*4+1]=S?S[1]:0; segArr[k*4+2]=S?S[2]:0; segArr[k*4+3]=S?S[3]:0; }
    bindQuad(); to(dispB);
    gl.useProgram(P.disp.p);
    gl.uniform1i(P.disp.u.uPrev,tex(0,dispA));
    gl.uniform2f(P.disp.u.res,canvas.width,canvas.height);
    gl.uniform2f(P.disp.u.texel,1/dispA.w,1/dispA.h);
    gl.uniform1f(P.disp.u.keep,Math.pow(0.42,dt));      // the smear relaxes over a couple of seconds
    gl.uniform4fv(P.disp.u.seg,segArr);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    var s=dispA; dispA=dispB; dispB=s;
  }
  function common(Pr){
    gl.uniform2f(Pr.u.res,canvas.width,canvas.height);
    gl.uniform1f(Pr.u.time,t);
    gl.uniform1i(Pr.u.uDisp,tex(1,dispA));
  }
  function readFlow(){
    bindQuad(); to(flowT);
    gl.useProgram(P.flow.p); common(P.flow);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    gl.readPixels(0,0,FW,FH,gl.RGBA,gl.UNSIGNED_BYTE,flowPix);
  }
  function draw(){
    gl.disable(gl.BLEND);
    bindQuad(); to(liqT);
    gl.useProgram(P.liq.p); common(P.liq);
    gl.uniform1f(P.liq.u.edgeTop,TOP?1:0);
    gl.uniform3f(P.liq.u.edgeCol,EDGE[0],EDGE[1],EDGE[2]);
    gl.uniform3f(P.liq.u.ownCol,OWN[0],OWN[1],OWN[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    to(null);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(P.copy.p);
    gl.uniform1i(P.copy.u.uTex,tex(0,liqT));
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    // particles, added as light, only where the liquid is
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P.part.p);
    gl.uniform1i(P.part.u.uLiquid,tex(0,liqT));
    gl.uniform2f(P.part.u.res,canvas.width,canvas.height);
    gl.uniform1f(P.part.u.dpr,canvas.width/Math.max(1,host.clientWidth));
    gl.bindBuffer(gl.ARRAY_BUFFER,pbuf); gl.bufferData(gl.ARRAY_BUFFER,pdata,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,lbuf); gl.bufferData(gl.ARRAY_BUFFER,ldata,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,1,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,cbuf); gl.bufferData(gl.ARRAY_BUFFER,cdata,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,3,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.POINTS,0,N);
    gl.disable(gl.BLEND);
  }

  function tick(dt,still){
    if(!still) t+=dt*(1+quick*0.8);
    updateDisp(dt);
    readFlow();
    if(!still || segs.length) stepParticles(dt);
  }

  /* ================= run ================= */
  function size(){
    // painted at ~0.6 of a CSS pixel and stretched (the liquid is soft); never over ~700k pixels
    var sc=0.6, cw=host.clientWidth, ch=host.clientHeight;
    if(cw*ch*sc*sc>700000) sc=Math.sqrt(700000/(cw*ch));
    var w=Math.max(2,Math.round(cw*sc)), h=Math.max(2,Math.round(ch*sc));
    if(w===canvas.width && h===canvas.height) return false;
    canvas.width=w; canvas.height=h; targets(w,h); makeParticles(); return true;
  }
  var visible=false, raf=0, prev=0;
  function frame(now){
    raf=0;
    if(!visible || document.hidden) return;
    var dt=Math.min((now-prev)/1000,0.05); prev=now;
    if(size()){ for(var w=0;w<60;w++) tick(1/60,false); }
    tick(dt, !!(RM && RM.matches));
    draw();
    raf=requestAnimationFrame(frame);
  }
  function wake(){ if(!raf && visible && !document.hidden){ prev=performance.now(); raf=requestAnimationFrame(frame); } }

  size();
  for(var w0=0;w0<60;w0++) tick(1/60,false);            // already settled on first sight
  draw();
  if(window.IntersectionObserver){
    new IntersectionObserver(function(es){ visible=es[0].isIntersecting; wake(); },{rootMargin:'100px 0px'}).observe(host);
  } else { visible=true; wake(); }
  document.addEventListener('visibilitychange',wake);

  return {
    canvas:canvas,
    /* for testing the look: run for a number of seconds at exactly 60fps, draw once */
    advance:function(seconds){ for(var i=0,n=Math.round(seconds*60);i<n;i++) tick(1/60,false); draw(); },
    /* for testing the physics: current particle positions (0..1, y up) */
    particles:function(){ return {x:px,y:py,n:N}; },
    /* for testing the pointer: a move to (x,y) in 0..1 of the layer, y from the top */
    pointer:function(x,y){
      var r=host.getBoundingClientRect();
      window.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+x*r.width,clientY:r.top+y*r.height}));
    }
  };
}

window.EdgeLiquid=EdgeLiquid;
})();
