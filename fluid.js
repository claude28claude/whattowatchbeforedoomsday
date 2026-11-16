/* Live liquid where The Doomsday Protocol and the Road to Secret Wars meet.
 *
 * A small real-time fluid simulation (stable fluids: advect, curl, vorticity,
 * divergence, pressure, subtract gradient) on the graphics card. Green ink is
 * fed in along the top edge and violet along the bottom; the two layers slide
 * past each other so they curl into one another, and the pointer stirs it.
 *
 * Drawn as a GLOWING, SEE-THROUGH layer (bloom + gloss, dark = transparent),
 * so it sits behind a page's content rather than in a box of its own:
 *   - Secret Wars: across the top of the page, mostly green (Doomsday's
 *     colour running into this site), fading down the hero;
 *   - Doomsday: across the end of the page, mostly violet (Secret Wars'
 *     colour rising into this one), fading up.
 *
 * The same file ships with both sites. Usage:
 *   SeamFluid(hostElement, {top: share of ink fed from the top edge, 0..1})
 * It only runs while on screen, honours reduced motion (no ambient flow,
 * still answers the pointer), and if WebGL or float render targets are
 * missing it leaves the host's CSS fallback showing.
 */
(function(){
"use strict";

var GREEN=[0.30,0.80,0.16], VIOLET=[0.52,0.28,1.00];

function SeamFluid(host,opts){
  if(!host) return null;
  opts=opts||{};
  var TOP=opts.top==null?0.5:opts.top;   // share of the ink fed from the top edge
  var canvas=document.createElement('canvas');
  canvas.setAttribute('aria-hidden','true');
  var ctx=getContext(canvas);
  if(!ctx){ host.classList.add('no-fluid'); return null; }
  host.insertBefore(canvas,host.firstChild);
  host.classList.add('has-fluid');
  var gl=ctx.gl, ext=ctx.ext;

  var RM=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var CFG={
    SIM:96,            // grid cells across the band's short side
    DYE:512,           // dye pixels across the short side (capped below)
    DENSITY_DISSIPATION:0.20,
    VELOCITY_DISSIPATION:0.30,
    SHEAR:30,          // how hard the two layers slide past each other
    PRESSURE:0.8,
    PRESSURE_ITERATIONS:24,
    CURL:22,
    SPLAT_RADIUS:0.0026,
    SPLAT_FORCE:5200
  };

  /* ---------------- shaders ---------------- */
  var baseVS=
    'precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;'+
    'void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);'+
    'vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}';
  var HEAD='precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;';
  var FS={
    splat:HEAD+'uniform sampler2D uTarget;uniform float aspectRatio,radius;uniform vec3 color;uniform vec2 point;'+
      'void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 s=exp(-dot(p,p)/radius)*color;'+
      'gl_FragColor=vec4(texture2D(uTarget,vUv).xyz+s,1.);}',
    advection:HEAD+'uniform sampler2D uVelocity,uSource;uniform vec2 texelSize,dyeTexelSize;uniform float dt,dissipation;'+
      'vec4 bilerp(sampler2D sam,vec2 uv,vec2 ts){vec2 st=uv/ts-.5;vec2 i=floor(st);vec2 f=fract(st);'+
      'vec4 a=texture2D(sam,(i+vec2(.5,.5))*ts);vec4 b=texture2D(sam,(i+vec2(1.5,.5))*ts);'+
      'vec4 c=texture2D(sam,(i+vec2(.5,1.5))*ts);vec4 d=texture2D(sam,(i+vec2(1.5,1.5))*ts);'+
      'return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}'+
      'void main(){vec2 coord=vUv-dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize;'+
      'gl_FragColor=bilerp(uSource,coord,dyeTexelSize)/(1.+dissipation*dt);}',
    divergence:HEAD+'uniform sampler2D uVelocity;'+
      'void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;'+
      'vec2 C=texture2D(uVelocity,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;'+
      'gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}',
    curl:HEAD+'uniform sampler2D uVelocity;'+
      'void main(){float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;'+
      'gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}',
    vorticity:HEAD+'uniform sampler2D uVelocity,uCurl;uniform float curl,dt;'+
      'void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;'+
      'vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;'+
      'vec2 v=texture2D(uVelocity,vUv).xy+f*dt;v=clamp(v,-1000.,1000.);gl_FragColor=vec4(v,0.,1.);}',
    pressure:HEAD+'uniform sampler2D uPressure,uDivergence;'+
      'void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;'+
      'float d=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-d)*.25,0.,0.,1.);}',
    gradient:HEAD+'uniform sampler2D uPressure,uVelocity;'+
      'void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;'+
      'vec2 v=texture2D(uVelocity,vUv).xy-vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}',
    /* the two layers slide past each other: top one way, bottom the other,
       with a slow wobble along the band so the waves never line up */
    shear:HEAD+'uniform sampler2D uVelocity;uniform float dt,shear,time;'+
      'void main(){vec2 v=texture2D(uVelocity,vUv).xy;float y=clamp((vUv.y-.5)*5.,-6.,6.);'+
      'float s=(exp(2.*y)-1.)/(exp(2.*y)+1.);float wob=1.+.35*sin(time*.45+vUv.x*5.3);'+
      'v.x+=dt*shear*s*wob;gl_FragColor=vec4(v,0.,1.);}',
    /* each edge keeps topping up its own colour */
    refill:HEAD+'uniform sampler2D uSource;uniform vec3 top,bottom;uniform float amount,edge;'+
      'void main(){vec3 c=texture2D(uSource,vUv).rgb;'+
      'float t=smoothstep(1.-edge,1.,vUv.y),b=1.-smoothstep(0.,edge,vUv.y);'+
      'c=mix(c,top,clamp(t*amount,0.,1.));c=mix(c,bottom,clamp(b*amount,0.,1.));gl_FragColor=vec4(c,1.);}',
    clear:HEAD+'uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}',
    /* the picture: dark green above, dark violet below, the liquid on top,
       lit from the front so it reads as a surface rather than smoke */
    display:HEAD+'uniform sampler2D uTexture;uniform vec2 texelSize;'+
      'void main(){vec3 c=texture2D(uTexture,vUv).rgb;'+
      'vec3 l=texture2D(uTexture,vL).rgb,r=texture2D(uTexture,vR).rgb,t=texture2D(uTexture,vT).rgb,b=texture2D(uTexture,vB).rgb;'+
      'float dx=length(r)-length(l),dy=length(t)-length(b);vec3 n=normalize(vec3(dx,dy,length(texelSize)));'+
      'float diffuse=clamp(dot(n,vec3(0.,0.,1.))+.72,.72,1.);'+
      'float spec=pow(clamp(dot(n,normalize(vec3(-.35,.45,1.))),0.,1.),24.)*min(length(c)*1.6,1.);'+
      'c=c*diffuse+spec*.35;'+
      'c=1.-exp(-c*1.35);'+                                  // soft tone curve: glows, never clips
      'vec3 bg=mix(vec3(.028,.012,.034),vec3(.012,.032,.024),vUv.y);'+
      'gl_FragColor=vec4(bg+c*(1.-bg),1.);}',
    /* the page layer: same liquid, plus a soft bloom around it, and dark
       areas go see-through so the page shows behind (premultiplied alpha) */
    glow:HEAD+'uniform sampler2D uTexture;uniform vec2 texelSize;'+
      'void main(){vec3 c=texture2D(uTexture,vUv).rgb;'+
      'vec3 l=texture2D(uTexture,vL).rgb,r=texture2D(uTexture,vR).rgb,t=texture2D(uTexture,vT).rgb,b=texture2D(uTexture,vB).rgb;'+
      'float dx=length(r)-length(l),dy=length(t)-length(b);vec3 n=normalize(vec3(dx,dy,length(texelSize)));'+
      'float diffuse=clamp(dot(n,vec3(0.,0.,1.))+.7,.7,1.);'+
      'float spec=pow(clamp(dot(n,normalize(vec3(-.35,.5,1.))),0.,1.),28.)*min(length(c)*1.8,1.);'+
      'vec3 halo=vec3(0.);'+
      'for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 d=vec2(cos(a),sin(a));'+
      'halo+=texture2D(uTexture,vUv+d*texelSize*3.).rgb+.7*texture2D(uTexture,vUv+d*texelSize*8.).rgb;}'+
      'halo/=13.6;'+
      'c=c*diffuse+spec*.55+halo*.65;'+
      'c=1.-exp(-c*1.7);'+
      'float a=clamp(max(c.r,max(c.g,c.b))*1.3,0.,1.);'+
      'gl_FragColor=vec4(c,a);}'
  };

  function compile(type,src){
    var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var VS=compile(gl.VERTEX_SHADER,baseVS);
  function program(fs){
    var p=gl.createProgram();
    gl.attachShader(p,VS); gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));
    gl.bindAttribLocation(p,0,'aPosition'); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u={}, n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(var i=0;i<n;i++){ var name=gl.getActiveUniform(p,i).name; u[name]=gl.getUniformLocation(p,name); }
    return {p:p,u:u};
  }
  var P={};
  try{ Object.keys(FS).forEach(function(k){ P[k]=program(FS[k]); }); }
  catch(err){ fail(err); return null; }

  // one full-screen quad
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,1,1,-1]),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),gl.STATIC_DRAW);
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.enableVertexAttribArray(0);
  function blit(target){
    if(target){ gl.viewport(0,0,target.w,target.h); gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo); }
    else { gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
    gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);
  }

  /* ---------------- render targets ---------------- */
  function fbo(w,h,filter){
    gl.activeTexture(gl.TEXTURE0);
    var tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,ext.internal,w,h,0,gl.RGBA,ext.type,null);
    var fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.viewport(0,0,w,h); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
    return {tex:tex,fbo:fb,w:w,h:h,tx:1/w,ty:1/h,
            attach:function(id){ gl.activeTexture(gl.TEXTURE0+id); gl.bindTexture(gl.TEXTURE_2D,tex); return id; }};
  }
  function dbl(w,h,filter){
    var a=fbo(w,h,filter), b=fbo(w,h,filter);
    return {w:w,h:h,tx:a.tx,ty:a.ty,get read(){return a;},get write(){return b;},swap:function(){var t=a;a=b;b=t;}};
  }
  function res(n){
    var w=canvas.width, h=canvas.height, aspect=Math.max(w,h)/Math.min(w,h);
    var long=Math.min(Math.round(n*aspect),2048);
    return w>=h ? {w:long,h:n} : {w:n,h:long};
  }
  var dye,velocity,divergence,curlT,pressure,filter;
  function build(){
    filter=ext.linear?gl.LINEAR:gl.NEAREST;
    var s=res(CFG.SIM), d=res(CFG.DYE);
    dye=dbl(d.w,d.h,filter);
    velocity=dbl(s.w,s.h,filter);
    divergence=fbo(s.w,s.h,gl.NEAREST);
    curlT=fbo(s.w,s.h,gl.NEAREST);
    pressure=dbl(s.w,s.h,gl.NEAREST);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('render target');
  }

  function size(){
    var dpr=Math.min(window.devicePixelRatio||1,2);
    var w=Math.max(2,Math.round(host.clientWidth*dpr)), h=Math.max(2,Math.round(host.clientHeight*dpr));
    if(w===canvas.width && h===canvas.height) return false;
    canvas.width=w; canvas.height=h; return true;
  }
  size();
  try{ build(); }catch(err){ fail(err); return null; }

  function fail(err){
    canvas.remove(); host.classList.remove('has-fluid'); host.classList.add('no-fluid');
    if(window.console) console.warn('Seam liquid switched off:',err && err.message);
  }

  /* ---------------- simulation ---------------- */
  function splat(x,y,dx,dy,color,radiusScale){
    var a=canvas.width/canvas.height;
    gl.useProgram(P.splat.p);
    gl.uniform1i(P.splat.u.uTarget,velocity.read.attach(0));
    gl.uniform1f(P.splat.u.aspectRatio,a);
    gl.uniform2f(P.splat.u.point,x,y);
    gl.uniform3f(P.splat.u.color,dx,dy,0);
    var r=CFG.SPLAT_RADIUS*(radiusScale||1); if(a>1) r*=a;
    gl.uniform1f(P.splat.u.radius,r);
    blit(velocity.write); velocity.swap();
    gl.uniform1i(P.splat.u.uTarget,dye.read.attach(0));
    gl.uniform3f(P.splat.u.color,color[0],color[1],color[2]);
    blit(dye.write); dye.swap();
  }

  var clock=0;
  function step(dt){
    gl.disable(gl.BLEND);
    clock+=dt;
    var sx=velocity.tx, sy=velocity.ty;
    gl.useProgram(P.shear.p);
    gl.uniform2f(P.shear.u.texelSize,sx,sy);
    gl.uniform1i(P.shear.u.uVelocity,velocity.read.attach(0));
    gl.uniform1f(P.shear.u.dt,dt);
    gl.uniform1f(P.shear.u.shear,CFG.SHEAR);
    gl.uniform1f(P.shear.u.time,clock);
    blit(velocity.write); velocity.swap();
    gl.useProgram(P.curl.p);
    gl.uniform2f(P.curl.u.texelSize,sx,sy);
    gl.uniform1i(P.curl.u.uVelocity,velocity.read.attach(0));
    blit(curlT);

    gl.useProgram(P.vorticity.p);
    gl.uniform2f(P.vorticity.u.texelSize,sx,sy);
    gl.uniform1i(P.vorticity.u.uVelocity,velocity.read.attach(0));
    gl.uniform1i(P.vorticity.u.uCurl,curlT.attach(1));
    gl.uniform1f(P.vorticity.u.curl,CFG.CURL);
    gl.uniform1f(P.vorticity.u.dt,dt);
    blit(velocity.write); velocity.swap();

    gl.useProgram(P.divergence.p);
    gl.uniform2f(P.divergence.u.texelSize,sx,sy);
    gl.uniform1i(P.divergence.u.uVelocity,velocity.read.attach(0));
    blit(divergence);

    gl.useProgram(P.clear.p);
    gl.uniform1i(P.clear.u.uTexture,pressure.read.attach(0));
    gl.uniform1f(P.clear.u.value,CFG.PRESSURE);
    blit(pressure.write); pressure.swap();

    gl.useProgram(P.pressure.p);
    gl.uniform2f(P.pressure.u.texelSize,sx,sy);
    gl.uniform1i(P.pressure.u.uDivergence,divergence.attach(0));
    for(var i=0;i<CFG.PRESSURE_ITERATIONS;i++){
      gl.uniform1i(P.pressure.u.uPressure,pressure.read.attach(1));
      blit(pressure.write); pressure.swap();
    }

    gl.useProgram(P.gradient.p);
    gl.uniform2f(P.gradient.u.texelSize,sx,sy);
    gl.uniform1i(P.gradient.u.uPressure,pressure.read.attach(0));
    gl.uniform1i(P.gradient.u.uVelocity,velocity.read.attach(1));
    blit(velocity.write); velocity.swap();

    gl.useProgram(P.advection.p);
    gl.uniform2f(P.advection.u.texelSize,sx,sy);
    gl.uniform2f(P.advection.u.dyeTexelSize,sx,sy);
    var vid=velocity.read.attach(0);
    gl.uniform1i(P.advection.u.uVelocity,vid);
    gl.uniform1i(P.advection.u.uSource,vid);
    gl.uniform1f(P.advection.u.dt,dt);
    gl.uniform1f(P.advection.u.dissipation,CFG.VELOCITY_DISSIPATION);
    blit(velocity.write); velocity.swap();

    gl.uniform2f(P.advection.u.dyeTexelSize,dye.tx,dye.ty);
    gl.uniform1i(P.advection.u.uVelocity,velocity.read.attach(0));
    gl.uniform1i(P.advection.u.uSource,dye.read.attach(1));
    gl.uniform1f(P.advection.u.dissipation,CFG.DENSITY_DISSIPATION);
    blit(dye.write); dye.swap();
  }

  function refill(amount,edge){
    gl.useProgram(P.refill.p);
    gl.uniform2f(P.refill.u.texelSize,dye.tx,dye.ty);
    gl.uniform1i(P.refill.u.uSource,dye.read.attach(0));
    gl.uniform3f(P.refill.u.top,GREEN[0]*0.62,GREEN[1]*0.62,GREEN[2]*0.62);
    gl.uniform3f(P.refill.u.bottom,VIOLET[0]*0.66,VIOLET[1]*0.66,VIOLET[2]*0.66);
    gl.uniform1f(P.refill.u.amount,amount);
    gl.uniform1f(P.refill.u.edge,edge);
    blit(dye.write); dye.swap();
  }

  function render(){
    var D=P.glow;
    gl.useProgram(D.p);
    gl.uniform2f(D.u.texelSize,3/gl.drawingBufferWidth,3/gl.drawingBufferHeight);
    gl.uniform1i(D.u.uTexture,dye.read.attach(0));
    blit(null);
  }

  /* ---------------- the two liquids ---------------- */
  function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
  function scale(c,k){ return [c[0]*k,c[1]*k,c[2]*k]; }
  /* Ink fed in along each edge - green threads from the top, violet from
     the bottom - which the sliding layers stretch into filaments and curl
     where they meet. Small nudges along the meeting line keep waves forming. */
  var feed=0, kick=0, side=0;
  function ambient(dt){
    feed-=dt; kick-=dt;
    while(feed<=0){
      feed+=0.028;
      side=Math.random()<TOP?1:0;
      var x=Math.random(), k=0.7+Math.random()*0.9, v=110+Math.random()*300, r=0.35+Math.random()*0.8;
      if(side) splat(x,0.985,(Math.random()-0.5)*160,-v,scale(GREEN,0.22*k),r);
      else     splat(x,0.015,(Math.random()-0.5)*160, v,scale(VIOLET,0.25*k),r);
    }
    if(kick<=0){
      kick=0.12+Math.random()*0.25;
      var up=(Math.random()<0.5?-1:1)*(300+Math.random()*500);
      splat(Math.random(),0.42+Math.random()*0.16,(Math.random()-0.5)*400,up,[0,0,0],0.5+Math.random()*0.9);
    }
  }
  // start already marbled: scattered ink in each half, moving every which way
  function seed(){
    for(var i=0;i<22;i++){
      var a=Math.random()*Math.PI*2, f=300+Math.random()*700;
      splat(Math.random(),0.55+Math.random()*0.45,Math.cos(a)*f,Math.sin(a)*f,scale(GREEN,0.25+Math.random()*0.25),0.5+Math.random()*1.5);
      a=Math.random()*Math.PI*2; f=300+Math.random()*700;
      splat(Math.random(),Math.random()*0.45,Math.cos(a)*f,Math.sin(a)*f,scale(VIOLET,0.28+Math.random()*0.25),0.5+Math.random()*1.5);
    }
  }
  seed();

  /* ---------------- the pointer stirs it ---------------- */
  var ptr={x:0,y:0,set:false};
  function onMove(clientX,clientY){
    var r=host.getBoundingClientRect();
    var x=(clientX-r.left)/r.width, y=1-(clientY-r.top)/r.height;
    if(x<0||x>1||y<0||y>1){ ptr.set=false; return; }
    if(!ptr.set){ ptr.x=x; ptr.y=y; ptr.set=true; return; }
    var dx=(x-ptr.x)*CFG.SPLAT_FORCE*(r.width/r.height), dy=(y-ptr.y)*CFG.SPLAT_FORCE;
    ptr.x=x; ptr.y=y;
    if(Math.abs(dx)+Math.abs(dy)<0.5) return;
    // the colour you drag is the liquid you are in: green near the top, violet near the bottom
    var c=scale(mix(VIOLET,GREEN,Math.min(1,Math.max(0,y*1.2-0.1))),0.5);
    pending.push([x,y,dx,dy,c]);
    wake();
  }
  var pending=[];
  // the layer sits behind the page and takes no clicks, so listen on the window
  addEventListener('pointermove',function(e){ onMove(e.clientX,e.clientY); },{passive:true});
  addEventListener('pointerleave',function(){ ptr.set=false; });
  addEventListener('touchmove',function(e){ var t=e.touches[0]; if(t) onMove(t.clientX,t.clientY); },{passive:true});
  addEventListener('touchend',function(){ ptr.set=false; },{passive:true});
  addEventListener('scroll',function(){ ptr.set=false; },{passive:true});

  /* ---------------- run only while it can be seen ---------------- */
  var visible=false, raf=0, last=0;
  function frame(now){
    raf=0;
    if(!visible || document.hidden) return;
    var dt=Math.min((now-last)/1000,0.033); last=now;
    if(size()){ try{ build(); seed(); }catch(err){ fail(err); return; } }
    if(!(RM && RM.matches)) ambient(dt);
    while(pending.length){ var p=pending.shift(); splat(p[0],p[1],p[2],p[3],p[4],1); }
    step(dt); render();
    raf=requestAnimationFrame(frame);
  }
  function wake(){ if(!raf && visible && !document.hidden){ last=performance.now(); raf=requestAnimationFrame(frame); } }
  if(window.IntersectionObserver){
    new IntersectionObserver(function(es){ visible=es[0].isIntersecting; wake(); },{rootMargin:'120px 0px'}).observe(host);
  } else { visible=true; wake(); }
  document.addEventListener('visibilitychange',wake);
  // paint once even before it is seen, so a screenshot or slow device never shows a blank band
  step(0.016); render();
  return {
    canvas:canvas,
    /* for testing the look: run the simulation for a given number of
       seconds at exactly 60 frames per second, then draw it once */
    advance:function(seconds){
      for(var i=0,n=Math.round(seconds*60);i<n;i++){
        if(!(RM && RM.matches)) ambient(1/60);
        while(pending.length){ var p=pending.shift(); splat(p[0],p[1],p[2],p[3],p[4],1); }
        step(1/60);
      }
      render();
    }
  };
}

/* WebGL2 with half-float targets, else WebGL1 with the half-float extension */
function getContext(canvas){
  var opts={alpha:true,premultipliedAlpha:true,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'};
  var gl=canvas.getContext('webgl2',opts), ext;
  if(gl){
    if(!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
    ext={internal:gl.RGBA16F,type:gl.HALF_FLOAT,linear:true};
  } else {
    gl=canvas.getContext('webgl',opts)||canvas.getContext('experimental-webgl',opts);
    if(!gl) return null;
    var hf=gl.getExtension('OES_texture_half_float');
    if(!hf) return null;
    ext={internal:gl.RGBA,type:hf.HALF_FLOAT_OES,linear:!!gl.getExtension('OES_texture_half_float_linear')};
  }
  return {gl:gl,ext:ext};
}

window.SeamFluid=SeamFluid;
})();
