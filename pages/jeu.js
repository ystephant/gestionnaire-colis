import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/ThemeContext';

// ─────────────────────────────────────────────────────────────────
//  DATA — Pièces individuelles
// ─────────────────────────────────────────────────────────────────
const PIECES = {
  'red-station':  { name: 'Gare rouge',      emoji: '🏠', color: '#ef4444' },
  'yellow-wagon': { name: 'Wagon jaune',     emoji: '🚃', color: '#fbbf24' },
  'green-cube':   { name: 'Cube vert',       emoji: '🟩', color: '#4ade80' },
  'wood-ox':      { name: 'Bœuf en bois',   emoji: '🐄', color: '#d97706' },
  'blue-tile':    { name: 'Tuile bleue',     emoji: '🔷', color: '#60a5fa' },
  'gold-token':   { name: 'Jeton or',        emoji: '🪙', color: '#fde68a' },
  'bird-card':    { name: 'Carte oiseau',    emoji: '🦅', color: '#fb923c' },
  'firework':     { name: "Feu d'artifice",  emoji: '🎆', color: '#f472b6' },
  'farmer':       { name: 'Fermier',         emoji: '👩‍🌾', color: '#84cc16' },
  'age3-card':    { name: 'Carte Age III',   emoji: '📜', color: '#a855f7' },
  'rabbit-card':  { name: 'Carte lapin',     emoji: '🐰', color: '#ec4899' },
  'egg':          { name: 'Oeuf',            emoji: '🥚', color: '#fef3c7' },
};

// ─────────────────────────────────────────────────────────────────
//  DATA — Jeux de société
// ─────────────────────────────────────────────────────────────────
const GAMES = [
  { name: 'Les Aventuriers du Rail', short: 'AVT.RAIL',  col: '#ef4444', bg: '#7f1d1d', pieceType: 'red-station'  },
  { name: 'Catan',                   short: 'CATAN',     col: '#f59e0b', bg: '#78350f', pieceType: 'yellow-wagon' },
  { name: 'Carcassonne',             short: 'CARCA.',    col: '#84cc16', bg: '#3f6212', pieceType: 'farmer'       },
  { name: '7 Wonders',               short: '7 WOND.',   col: '#a855f7', bg: '#581c87', pieceType: 'age3-card'    },
  { name: 'Pandemie',                short: 'PANDEM.',   col: '#06b6d4', bg: '#164e63', pieceType: 'green-cube'   },
  { name: 'Splendor',                short: 'SPLEND.',   col: '#fbbf24', bg: '#92400e', pieceType: 'gold-token'   },
  { name: 'Azul',                    short: 'AZUL',      col: '#60a5fa', bg: '#1e3a5f', pieceType: 'blue-tile'    },
  { name: 'Agricola',                short: 'AGRICO.',   col: '#a78bfa', bg: '#4c1d95', pieceType: 'wood-ox'      },
  { name: 'Wingspan',                short: 'WINGSP.',   col: '#fb923c', bg: '#7c2d12', pieceType: 'bird-card'    },
  { name: 'Dixit',                   short: 'DIXIT',     col: '#f472b6', bg: '#831843', pieceType: 'rabbit-card'  },
  { name: 'Hanabi',                  short: 'HANABI',    col: '#fde68a', bg: '#713f12', pieceType: 'firework'     },
  { name: 'Takenoko',                short: 'TAKEN.',    col: '#4ade80', bg: '#14532d', pieceType: 'egg'          },
];

const BAG_MAX = 5;

// ─────────────────────────────────────────────────────────────────
//  ENGINE
// ─────────────────────────────────────────────────────────────────
function createGameEngine(canvas, cbs) {
  const { onScore, onLives, onLevel, onState, onBag, onLastEvent } = cbs;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  let state    = 'intro';
  let score    = 0, lives = 3, level = 1, caught = 0;
  let boxes    = [], pieceItems = [], particles = [], floatMsgs = [];
  let bag      = [];
  let flashMsg = null;
  let frame    = 0, spawnTimer = 0, spawnInterval = 105, pieceSpawnTimer = 0;
  let highScore = parseInt(localStorage.getItem('meepleHS') || '0');
  let animId   = null;
  let mouseX   = W / 2;
  let spaceWasDown = false;

  const meeple = { x: W / 2, happy: 0, sad: 0 };
  const keys   = { space: false };

  const MEEPLE_Y = H - 68;
  const CATCH_R  = 30;
  const CATCH_Y  = MEEPLE_Y - 18;

  const stars = Array.from({ length: 50 }, () => ({
    x: Math.random() * W, y: Math.random() * H * 0.7,
    r: Math.random() * 1.3 + 0.3, flicker: Math.random() * 100,
  }));

  // ── Helpers ───────────────────────────────────────────────────
  const px = n => Math.round(n);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
    ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
    ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
    ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  function pxText(text, x, y, size, color, align = 'left') {
    ctx.save();
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
    ctx.fillText(text, px(x), px(y));
    ctx.restore();
  }

  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI*2*i)/n + Math.random()*0.5;
      const sp = 1.5 + Math.random()*3;
      particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp-2,
        life:1, decay:0.028+Math.random()*0.02, r:2+Math.random()*3, color });
    }
  }

  function goldBurst(x, y) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random()*Math.PI*2;
      const sp = 1+Math.random()*5;
      particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp-3,
        life:1, decay:0.018, r:2.5, color: i%2===0?'#fde68a':'#f59e0b', star:true });
    }
  }

  function floatText(text, x, y, color) {
    floatMsgs.push({ text, x, y, vy:-1.4, life:1, decay:0.02, color });
  }

  // ── Spawn ─────────────────────────────────────────────────────
  function spawnBox() {
    const g = GAMES[Math.floor(Math.random()*GAMES.length)];
    const incomplete = Math.random() < Math.min(0.50, 0.25 + level*0.025);
    boxes.push({
      x: 16+Math.random()*(W-76), y:-54, w:50, h:50,
      game:g, incomplete,
      vy: 1.0+level*0.14+Math.random()*0.4,
      wobble: Math.random()*Math.PI*2,
      wobbleSpeed: 0.03+Math.random()*0.02,
      dying:false, dieTimer:0, inspected:false,
    });
  }

  function spawnPiece() {
    const pKeys = Object.keys(PIECES);
    const type  = pKeys[Math.floor(Math.random()*pKeys.length)];
    const piece = PIECES[type];
    pieceItems.push({
      type, piece,
      x: 16+Math.random()*(W-36), y:-28, w:26, h:26,
      vy: 0.9+level*0.1+Math.random()*0.5,
      wobble: Math.random()*Math.PI*2,
      dying:false, dieTimer:0,
    });
  }

  // ── Draw ──────────────────────────────────────────────────────
  function drawStars() {
    stars.forEach(s => {
      const f = 0.5+0.5*Math.sin(frame*0.04+s.flicker);
      ctx.fillStyle = `rgba(165,180,252,${f*0.4})`;
      ctx.fillRect(px(s.x),px(s.y),Math.max(1,px(s.r*2)),Math.max(1,px(s.r*2)));
    });
  }

  function drawGround() {
    const gy = H-48;
    ctx.fillStyle='#1e1b4b'; ctx.fillRect(0,gy,W,H-gy);
    ctx.fillStyle='#312e81'; ctx.fillRect(0,gy,W,2);
    ctx.fillStyle='#4338ca';
    for(let i=4;i<W;i+=12) ctx.fillRect(i,gy+2,4,2);
  }

  function drawBagBar() {
    const by = H-36;
    ctx.fillStyle='rgba(15,15,26,0.9)'; ctx.fillRect(0,by,W,36);
    ctx.fillStyle='#312e81'; ctx.fillRect(0,by,W,1);
    pxText('BESACE:', 8, by+10, 5, '#6366f1');
    const slotSize=24, startX=74;
    for(let i=0;i<BAG_MAX;i++){
      const sx=startX+i*(slotSize+4), sy=by+6;
      ctx.fillStyle='#1e1b4b';
      roundRect(sx,sy,slotSize,slotSize,4); ctx.fill();
      ctx.strokeStyle='#312e81'; ctx.lineWidth=1;
      roundRect(sx,sy,slotSize,slotSize,4); ctx.stroke();
      if(bag[i]){
        const p=PIECES[bag[i]];
        ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(p.emoji, px(sx+slotSize/2), px(sy+slotSize/2));
        ctx.fillStyle=p.color+'bb';
        ctx.beginPath(); ctx.arc(sx+slotSize-4,sy+4,3,0,Math.PI*2); ctx.fill();
      }
    }
  }

  function drawHUD() {
    ctx.fillStyle='rgba(15,15,26,0.9)'; ctx.fillRect(0,0,W,34);
    pxText('SCORE',8,4,5,'#6366f1');
    pxText(String(score).padStart(5,'0'),8,14,7,'#a5b4fc');
    for(let i=0;i<3;i++){
      ctx.font='13px serif';
      ctx.fillStyle=i<lives?'#ef4444':'#374151';
      ctx.fillText('♥',W-20-i*16,8);
    }
    pxText(`LVL ${level}`,W/2,9,5,'#818cf8','center');
    ctx.fillStyle='#312e81'; ctx.fillRect(0,34,W,1);
  }

  function drawBox(box) {
    const {x,y,w,h,game,incomplete,wobble,dying,dieTimer} = box;
    ctx.save();
    ctx.globalAlpha = dying ? Math.max(0,1-dieTimer/14) : 1;
    const wx = dying ? 0 : Math.sin(wobble)*1.8;
    ctx.translate(px(x+w/2+wx), px(y+h/2));
    if(dying){
      ctx.rotate((dieTimer/14)*Math.PI*0.35*(incomplete?1:-1));
      const sc=Math.max(0.01,1-dieTimer/17);
      ctx.scale(sc,sc);
    }
    ctx.shadowColor=incomplete?'#f97316':game.col; ctx.shadowBlur=8;
    ctx.fillStyle=game.bg; roundRect(-w/2,-h/2,w,h,6); ctx.fill();
    ctx.strokeStyle=incomplete?'#f97316':game.col; ctx.lineWidth=2;
    roundRect(-w/2,-h/2,w,h,6); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle=game.col+'1e';
    ctx.fillRect(-w/2+3,-h/2+3,w-6,h*0.40);

    ctx.font='15px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🎲',0,-h/2+h*0.20);
    ctx.font="4px 'Press Start 2P',monospace";
    ctx.fillStyle=game.col; ctx.textBaseline='bottom';
    ctx.fillText(game.short,0,h/2-10);

    if(incomplete){
      const pData=PIECES[game.pieceType];
      const hasPiece=bag.includes(game.pieceType);
      ctx.fillStyle=hasPiece?'#065f46':'#dc2626';
      roundRect(-14,-5,28,10,3); ctx.fill();
      ctx.font='9px serif'; ctx.fillStyle='#fff'; ctx.textBaseline='middle';
      ctx.fillText(pData.emoji,-5,0);
      if(hasPiece){
        ctx.font="4px 'Press Start 2P',monospace"; ctx.fillStyle='#6ee7b7';
        ctx.fillText('OK',6,0);
      } else {
        ctx.font="4px 'Press Start 2P',monospace"; ctx.fillStyle='#fca5a5';
        ctx.fillText('?',7,0);
      }
    } else {
      ctx.fillStyle='#16a34a'; roundRect(-11,-5,22,10,3); ctx.fill();
      ctx.font='9px serif'; ctx.fillStyle='#fff'; ctx.textBaseline='middle';
      ctx.fillText('✓',0,0);
    }
    ctx.restore();
  }

  function drawPieceItem(item) {
    const {x,y,w,h,piece,dying,dieTimer} = item;
    ctx.save();
    ctx.globalAlpha = dying ? Math.max(0,1-dieTimer/12) : 1;
    const wx = Math.sin(item.wobble)*2;
    ctx.translate(px(x+w/2+wx), px(y+h/2));
    if(dying){ const sc=Math.max(0.01,1-dieTimer/14); ctx.scale(sc,sc); }
    ctx.shadowColor=piece.color; ctx.shadowBlur=10;
    ctx.fillStyle=piece.color+'33';
    ctx.beginPath(); ctx.arc(0,0,w/2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=piece.color; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,w/2,0,Math.PI*2); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(piece.emoji,0,1);
    ctx.restore();
  }

  function drawMeeple(mx, my) {
    const {happy,sad} = meeple;
    ctx.save();
    ctx.translate(px(mx),px(my));
    ctx.fillStyle='rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0,13,15,4,0,0,Math.PI*2); ctx.fill();
    const bounce = happy>0 ? -Math.sin(happy*0.15)*5 : 0;
    const shake  = sad>0   ?  Math.sin(sad*0.4)*3    : 0;
    ctx.translate(shake,bounce);
    const catching = keys.space;
    const col  = catching?'#818cf8':happy>0?'#a5f3fc':sad>0?'#fca5a5':'#6366f1';
    const dark = catching?'#4338ca':happy>0?'#0891b2':sad>0?'#dc2626':'#4338ca';

    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(0,-13,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=dark;
    if(happy>0){
      ctx.fillRect(-4,-15,2,2); ctx.fillRect(2,-15,2,2);
      ctx.beginPath(); ctx.arc(0,-11,3,0,Math.PI); ctx.fill();
    } else if(sad>0){
      ctx.fillRect(-4,-15,2,2); ctx.fillRect(2,-15,2,2);
      ctx.beginPath(); ctx.arc(0,-9,3,Math.PI,0); ctx.fill();
    } else {
      ctx.fillRect(-4,-15,2,2); ctx.fillRect(2,-15,2,2);
      ctx.fillRect(-3,-11,6,1);
    }
    ctx.fillStyle=col;
    ctx.fillRect(-3,-6,6,4);
    ctx.beginPath(); ctx.moveTo(-10,-2); ctx.lineTo(10,-2); ctx.lineTo(8,7); ctx.lineTo(-8,7); ctx.closePath(); ctx.fill();
    if(catching){
      ctx.fillRect(-14,-7,5,5); ctx.fillRect(10,-7,5,5);
      ctx.fillStyle='#fde68a';
      for(let i=0;i<4;i++){
        const a=frame*0.1+i*Math.PI/2;
        ctx.fillRect(px(Math.cos(a)*16)-1,px(Math.sin(a)*8-5)-1,3,3);
      }
    } else {
      ctx.fillRect(-13,-1,5,5); ctx.fillRect(9,-1,5,5);
    }
    ctx.fillRect(-7,7,5,7); ctx.fillRect(2,7,5,7);
    ctx.fillStyle=dark;
    ctx.fillRect(-9,12,7,3); ctx.fillRect(2,12,7,3);
    ctx.restore();
  }

  function drawParticles() {
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.life-=p.decay;
      ctx.save(); ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
      if(p.star){ ctx.font='9px serif'; ctx.textAlign='center'; ctx.fillText('★',p.x,p.y); }
      else { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
  }

  function drawFloatMsgs() {
    floatMsgs=floatMsgs.filter(m=>m.life>0);
    floatMsgs.forEach(m=>{
      m.y+=m.vy; m.life-=m.decay;
      ctx.save(); ctx.globalAlpha=m.life;
      ctx.font="6px 'Press Start 2P',monospace";
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillStyle=m.color; ctx.fillText(m.text,m.x,m.y);
      ctx.restore();
    });
  }

  function drawFlashMsg() {
    if(!flashMsg) return;
    flashMsg.timer--;
    const alpha=Math.min(1,flashMsg.timer/12);
    const rise=(28-flashMsg.timer)*0.8;
    ctx.save(); ctx.globalAlpha=alpha;
    ctx.font="6px 'Press Start 2P',monospace";
    ctx.textAlign='center'; ctx.textBaseline='top';
    if(flashMsg.lines){
      flashMsg.lines.forEach((line,i)=>{
        ctx.fillStyle=i===0?flashMsg.color:(i===1?'#fff':'#a5b4fc');
        ctx.fillText(line, W/2, H/2-62-rise+i*13);
      });
    } else {
      ctx.fillStyle=flashMsg.color;
      ctx.fillText(flashMsg.text, W/2, H/2-62-rise);
    }
    ctx.restore();
    if(flashMsg.timer<=0) flashMsg=null;
  }

  function drawIntro() {
    ctx.fillStyle='#0f0f1a'; ctx.fillRect(0,0,W,H);
    drawStars();
    ctx.save();
    ctx.shadowColor='#6366f1'; ctx.shadowBlur=18;
    pxText('MEEPLE',W/2,58,20,'#a5b4fc','center');
    pxText('CATCHER',W/2,85,18,'#818cf8','center');
    ctx.restore();
    ctx.font='24px serif'; ctx.textAlign='center'; ctx.fillText('🎲',W/2,125);
    drawMeeple(W/2, H/2-18);
    pxText('ATTRAPE LES JEUX',W/2,H/2+50,5,'#6366f1','center');
    pxText('COLLECTE LES PIECES',W/2,H/2+64,5,'#6366f1','center');
    pxText('COMPLETE LES INCOMPLETS',W/2,H/2+78,4,'#4b5563','center');
    pxText('POUR UN BONUS x2 !',W/2,H/2+91,4,'#4b5563','center');
    if(Math.floor(frame/28)%2===0)
      pxText('APPUIE SUR ESPACE',W/2,H-72,5,'#fde68a','center');
    if(highScore>0)
      pxText(`RECORD: ${highScore}`,W/2,H-50,5,'#6366f1','center');
  }

  function drawGameOver() {
    ctx.fillStyle='rgba(15,15,26,0.94)'; ctx.fillRect(0,0,W,H);
    ctx.save(); ctx.shadowColor='#ef4444'; ctx.shadowBlur=18;
    pxText('GAME',W/2,H/2-90,17,'#ef4444','center');
    pxText('OVER',W/2,H/2-67,17,'#ef4444','center');
    ctx.restore();
    pxText(`SCORE: ${score}`,W/2,H/2-24,7,'#a5b4fc','center');
    if(score>=highScore&&score>0)
      pxText('NOUVEAU RECORD !',W/2,H/2+2,5,'#fde68a','center');
    else
      pxText(`RECORD: ${highScore}`,W/2,H/2+2,5,'#6366f1','center');
    pxText(`NIVEAU: ${level}`,W/2,H/2+20,5,'#818cf8','center');
    pxText(`JEUX: ${caught}`,W/2,H/2+36,5,'#4b5563','center');
    if(Math.floor(frame/28)%2===0)
      pxText('ESPACE = REJOUER',W/2,H-65,5,'#fde68a','center');
  }

  // ── Game logic ────────────────────────────────────────────────
  function resetGame() {
    score=0; lives=3; level=1; caught=0; bag=[];
    boxes=[]; pieceItems=[]; particles=[]; floatMsgs=[]; flashMsg=null;
    meeple.x=W/2; meeple.happy=0; meeple.sad=0;
    spawnTimer=0; pieceSpawnTimer=0; spawnInterval=105; frame=0;
    state='playing';
    onState('playing'); onScore(0); onLives(3); onLevel(1); onBag([]);
  }

  function endGame() {
    state='gameover'; onState('gameover');
    if(score>highScore){ highScore=score; localStorage.setItem('meepleHS',highScore); }
  }

  function addToBag(type) {
    if(bag.length>=BAG_MAX) return false;
    bag=[...bag,type]; onBag([...bag]); return true;
  }

  function removeFromBag(type) {
    const idx=bag.indexOf(type); if(idx===-1) return false;
    bag=bag.filter((_,i)=>i!==idx); onBag([...bag]); return true;
  }

  function catchBox(box) {
    box.dying=true;
    const cx=box.x+box.w/2, cy=box.y+box.h/2;
    if(!box.incomplete){
      const pts=10+level*2; score+=pts; caught++;
      meeple.happy=35; onScore(score);
      burst(cx,cy,box.game.col,16);
      floatText(`+${pts}`,cx,cy,box.game.col);
      flashMsg={text:`+${pts} COMPLET !`,color:box.game.col,timer:40};
    } else {
      const pData=PIECES[box.game.pieceType];
      if(bag.includes(box.game.pieceType)){
        removeFromBag(box.game.pieceType);
        const pts=25; score+=pts; caught++;
        meeple.happy=50; onScore(score);
        goldBurst(cx,cy);
        floatText(`+${pts} BONUS !`,cx,cy,'#fde68a');
        flashMsg={
          lines:[`+${pts} BONUS !`,`${pData.emoji} ${pData.name}`,'COMPLETE !'],
          color:'#fde68a',timer:65,
        };
      } else {
        score+=2; caught++;
        meeple.sad=30; onScore(score);
        burst(cx,cy,'#f97316',8);
        floatText('+2',cx,cy,'#f97316');
        flashMsg={
          lines:[box.game.name,`MANQUE: ${pData.emoji} ${pData.name}`],
          color:'#f97316',timer:70,
        };
        onLastEvent({gameName:box.game.name,pieceName:pData.name,emoji:pData.emoji});
      }
    }
  }

  function catchPiece(item) {
    item.dying=true;
    const cx=item.x+item.w/2, cy=item.y+item.h/2;
    const ok=addToBag(item.type);
    if(ok){
      score+=3; onScore(score);
      meeple.happy=Math.max(meeple.happy,15);
      burst(cx,cy,item.piece.color,10);
      floatText(`+3 ${item.piece.emoji}`,cx,cy,item.piece.color);
    } else {
      burst(cx,cy,'#6b7280',6);
      floatText('PLEIN!',cx,cy,'#9ca3af');
    }
  }

  function update() {
    // Smooth mouse follow
    meeple.x+=(mouseX-meeple.x)*0.18;
    meeple.x=Math.max(16,Math.min(W-16,meeple.x));
    if(meeple.happy>0) meeple.happy--;
    if(meeple.sad>0)   meeple.sad--;

    const spacePulse=keys.space&&!spaceWasDown;
    spaceWasDown=keys.space;

    // Spawn boxes
    spawnTimer++;
    if(spawnTimer>=spawnInterval){
      spawnBox(); spawnTimer=0;
      if(level>=3&&Math.random()<0.3) spawnBox();
    }
    // Spawn pieces
    pieceSpawnTimer++;
    const pInterval=Math.max(85,175-level*10);
    if(pieceSpawnTimer>=pInterval){ spawnPiece(); pieceSpawnTimer=0; }

    // Level up every 6 catches
    const newLevel=Math.floor(caught/6)+1;
    if(newLevel!==level){
      level=newLevel; spawnInterval=Math.max(40,105-level*9);
      flashMsg={text:`NIVEAU ${level} !`,color:'#fde68a',timer:55};
      onLevel(level);
    }

    // Boxes
    boxes.forEach(box=>{
      if(box.dying){ box.dieTimer++; return; }
      box.y+=box.vy; box.wobble+=box.wobbleSpeed;
      const cx=box.x+box.w/2;
      // Auto-catch
      if(box.y+box.h>=CATCH_Y&&Math.abs(cx-meeple.x)<CATCH_R+box.w/2){ catchBox(box); return; }
      // Space = inspect
      if(spacePulse&&!box.inspected){
        const dist=Math.abs(cx-meeple.x);
        const yd=Math.abs((box.y+box.h/2)-MEEPLE_Y);
        if(dist<55&&yd<130){
          box.inspected=true;
          if(box.incomplete){
            const pData=PIECES[box.game.pieceType];
            const has=bag.includes(box.game.pieceType);
            floatText(has?`J'AI ${pData.name}!`:`MANQUE: ${pData.emoji} ${pData.name}`,cx,box.y,has?'#4ade80':'#f97316');
          } else {
            floatText('COMPLET !',cx,box.y,'#4ade80');
          }
        }
      }
      // Fell off
      if(box.y>H+10){
        if(!box.incomplete){
          lives=Math.max(0,lives-1); meeple.sad=45; onLives(lives);
          burst(cx,H-20,'#ef4444',8);
          flashMsg={text:'-1 VIE !',color:'#ef4444',timer:50};
          if(lives<=0) endGame();
        }
        // incomplete box missed = no penalty
        box.dying=true;
      }
    });

    // Pieces
    pieceItems.forEach(item=>{
      if(item.dying){ item.dieTimer++; return; }
      item.y+=item.vy; item.wobble+=0.06;
      const cx=item.x+item.w/2;
      if(item.y+item.h>=CATCH_Y&&Math.abs(cx-meeple.x)<CATCH_R+item.w/2){ catchPiece(item); return; }
      if(item.y>H+10) item.dying=true;
    });

    boxes=boxes.filter(b=>!b.dying||b.dieTimer<16);
    pieceItems=pieceItems.filter(p=>!p.dying||p.dieTimer<14);
  }

  // ── Main loop ─────────────────────────────────────────────────
  function loop() {
    frame++;
    ctx.fillStyle='#0f0f1a'; ctx.fillRect(0,0,W,H);

    if(state==='intro'){
      drawIntro();
      if(keys.space&&!spaceWasDown) resetGame();
      spaceWasDown=keys.space;
    } else if(state==='playing'){
      update();
      drawStars(); drawGround();
      pieceItems.forEach(drawPieceItem);
      boxes.forEach(drawBox);
      drawMeeple(meeple.x, MEEPLE_Y);
      drawParticles(); drawFloatMsgs();
      drawHUD(); drawBagBar(); drawFlashMsg();
      ctx.fillStyle='rgba(0,0,0,0.06)';
      for(let y=34;y<H;y+=3) ctx.fillRect(0,y,W,1);
    } else if(state==='gameover'){
      drawStars(); drawParticles(); drawGameOver();
      if(keys.space&&!spaceWasDown) resetGame();
      spaceWasDown=keys.space;
    }

    animId=requestAnimationFrame(loop);
  }

  loop();

  return {
    setKey:    (k,v) => { keys[k]=v; },
    setMouseX: (x)   => { mouseX=x; },
    destroy:   ()    => { if(animId) cancelAnimationFrame(animId); },
  };
}

// ─────────────────────────────────────────────────────────────────
//  REACT COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function JeuPage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [gameState, setGameState]   = useState('intro');
  const [score, setScore]           = useState(0);
  const [lives, setLives]           = useState(3);
  const [level, setLevel]           = useState(1);
  const [bag, setBag]               = useState([]);
  const [lastEvent, setLastEvent]   = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 340, h: 560 });

  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('username');
    if(saved) setIsLoggedIn(true); else router.push('/');
    setLoading(false);
  }, []);

  useEffect(() => {
    function compute() {
      const maxW = Math.min(window.innerWidth-32, 400);
      setCanvasSize({ w:maxW, h:Math.round(maxW*(560/340)) });
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    if(!isLoggedIn||!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width  = canvasSize.w;
    canvas.height = canvasSize.h;
    if(engineRef.current) engineRef.current.destroy();
    engineRef.current = createGameEngine(canvas, {
      onScore:     setScore,
      onLives:     setLives,
      onLevel:     setLevel,
      onState:     setGameState,
      onBag:       setBag,
      onLastEvent: setLastEvent,
    });
    return () => { if(engineRef.current) engineRef.current.destroy(); };
  }, [isLoggedIn, canvasSize]);

  // Mouse / touch on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const onMove = e => {
      if(!engineRef.current) return;
      const rect  = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const rawX  = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      engineRef.current.setMouseX(rawX * scaleX);
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onMove, { passive:true });
    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchmove', onMove);
    };
  }, [isLoggedIn, canvasSize]);

  // Keyboard
  useEffect(() => {
    const dn = e => { if(!engineRef.current) return; if(e.key===' '){ e.preventDefault(); engineRef.current.setKey('space',true); } };
    const up = e => { if(!engineRef.current) return; if(e.key===' ') engineRef.current.setKey('space',false); };
    window.addEventListener('keydown',dn); window.addEventListener('keyup',up);
    return () => { window.removeEventListener('keydown',dn); window.removeEventListener('keyup',up); };
  }, []);

  const setKey = useCallback((k,v) => { if(engineRef.current) engineRef.current.setKey(k,v); }, []);

  if(loading||!isLoggedIn) return null;

  return (
    <div className={`min-h-screen ${darkMode?'bg-gray-900':'bg-gradient-to-br from-blue-50 to-indigo-100'} py-8 px-4 transition-colors duration-300`}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className={`${darkMode?'bg-gray-800':'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')}
                className={`${darkMode?'text-gray-400 hover:text-indigo-400 hover:bg-gray-700':'text-gray-600 hover:text-indigo-600 hover:bg-gray-100'} p-2 rounded-lg transition`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-indigo-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="15" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="17"/>
                  <line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/>
                </svg>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${darkMode?'text-gray-100':'text-gray-800'}`}>Meeple Catcher</h1>
                <p className={`text-sm ${darkMode?'text-gray-400':'text-gray-500'}`}>
                  {gameState==='playing' ? `Score : ${score} · Niv. ${level}` : gameState==='gameover' ? 'Game Over !' : 'Prêt ?'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {gameState==='playing' && (
                <div className="flex gap-0.5">
                  {[0,1,2].map(i=>(
                    <span key={i} className={`text-lg leading-none ${i<lives?'text-red-500':'text-gray-600'}`}>♥</span>
                  ))}
                </div>
              )}
              <button onClick={toggleDarkMode}
                className={`p-3 rounded-xl transition-all duration-300 ${darkMode?'bg-gray-700 hover:bg-gray-600 text-yellow-400':'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                {darkMode?(
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ):(
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Last event banner */}
        {lastEvent && gameState==='playing' && (
          <div className={`mb-4 rounded-xl px-4 py-3 flex items-center gap-3 border ${
            darkMode?'bg-orange-950 border-orange-800 text-orange-200':'bg-orange-50 border-orange-200 text-orange-800'
          }`}>
            <span className="text-2xl">{lastEvent.emoji}</span>
            <div className="flex-1">
              <p className="font-bold text-sm">{lastEvent.gameName}</p>
              <p className="text-xs opacity-75">Il manquait : <span className="font-semibold">{lastEvent.pieceName}</span></p>
            </div>
            <button onClick={() => setLastEvent(null)} className="opacity-40 hover:opacity-80 text-xl">×</button>
          </div>
        )}

        {/* Canvas */}
        <div className={`${darkMode?'bg-gray-800':'bg-white'} rounded-2xl shadow-xl overflow-hidden`}>
          <canvas ref={canvasRef}
            style={{ display:'block', width:'100%', imageRendering:'pixelated', cursor:'none' }}
          />
          {/* Touch controls */}
          <div className={`flex items-center gap-3 p-4 ${darkMode?'bg-gray-800':'bg-white'}`}>
            <p className={`flex-1 text-center leading-relaxed ${darkMode?'text-gray-600':'text-gray-400'}`}
              style={{ fontFamily:"'Press Start 2P',monospace", fontSize:'7px' }}>
              GLISSE LE DOIGT<br/>SUR L'ECRAN
            </p>
            <button
              onPointerDown={() => setKey('space',true)}
              onPointerUp={()   => setKey('space',false)}
              onPointerLeave={()=> setKey('space',false)}
              className={`flex-[2] py-4 rounded-xl font-bold transition active:scale-95 select-none border-2 ${
                darkMode?'bg-indigo-900 border-indigo-600 text-indigo-200':'bg-indigo-600 border-indigo-700 text-white'
              }`}
              style={{ boxShadow:'0 4px 0 #3730a3', touchAction:'none', userSelect:'none',
                fontFamily:"'Press Start 2P',monospace", fontSize:'9px' }}
            >
              🔍 INSPECTER
            </button>
            <div className="flex-1"/>
          </div>
        </div>

        {/* Besace React UI */}
        {gameState==='playing' && (
          <div className={`mt-4 ${darkMode?'bg-gray-800':'bg-white'} rounded-2xl shadow-xl p-4 transition-colors duration-300`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🎒</span>
              <h2 className={`text-sm font-bold ${darkMode?'text-gray-200':'text-gray-800'}`}>
                Ma Besace ({bag.length}/{BAG_MAX})
              </h2>
              {bag.length === BAG_MAX && (
                <span className="ml-auto text-xs text-orange-400 font-semibold">PLEINE</span>
              )}
            </div>
            <div className="flex gap-2">
              {Array.from({ length:BAG_MAX }).map((_,i) => {
                const type = bag[i];
                const p    = type ? PIECES[type] : null;
                return (
                  <div key={i}
                    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border-2 transition-all ${
                      p
                        ? darkMode?'border-indigo-500 bg-gray-700':'border-indigo-300 bg-indigo-50'
                        : darkMode?'border-gray-700 bg-gray-900':'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {p ? (
                      <>
                        <span className="text-xl leading-none">{p.emoji}</span>
                        <span className="mt-0.5 leading-none text-center"
                          style={{ fontSize:'6px', color:p.color, fontFamily:"'Press Start 2P',monospace" }}>
                          {p.name.split(' ').slice(0,2).join(' ')}
                        </span>
                      </>
                    ) : (
                      <span className={`text-2xl ${darkMode?'text-gray-700':'text-gray-300'}`}>·</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Help */}
        <div className={`mt-4 ${darkMode?'bg-gray-800':'bg-white'} rounded-2xl shadow-xl p-5 transition-colors duration-300`}>
          <h2 className={`text-sm font-bold mb-3 ${darkMode?'text-gray-200':'text-gray-800'}`}>Comment jouer</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { icon:'✅', text:'Attrape les jeux complets → +10 pts' },
              { icon:'🎒', text:'Collecte les pièces qui tombent → +3 pts' },
              { icon:'🎉', text:'Pièce + jeu incomplet = COMPLETÉ ! → +25' },
              { icon:'⚠️', text:'Jeu incomplet sans pièce → +2 (pas de perte de vie)' },
              { icon:'💀', text:'Jeu complet manqué → -1 vie' },
              { icon:'🔍', text:'Inspecter pour voir ce qui manque' },
            ].map((tip,i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${darkMode?'bg-gray-700':'bg-gray-50'}`}>
                <span className="text-base leading-none">{tip.icon}</span>
                <span className={`${darkMode?'text-gray-300':'text-gray-600'} leading-snug`}>{tip.text}</span>
              </div>
            ))}
          </div>
          <p className={`mt-3 text-xs text-center ${darkMode?'text-gray-600':'text-gray-400'}`}>
            Déplace la souris / le doigt sur le jeu · Espace = inspecter
          </p>
        </div>

        <div className={`mt-4 rounded-xl p-4 text-center ${darkMode?'bg-gray-800 bg-opacity-60':'bg-white bg-opacity-60'}`}>
          <p className={`text-xs ${darkMode?'text-gray-500':'text-gray-400'}`}>
            🏆 Record sauvegardé localement · Niv. {level > 1 ? level : '—'}
          </p>
        </div>

      </div>
    </div>
  );
}
