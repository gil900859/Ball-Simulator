
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SimulationConfig, Ball, AIPattern } from './types';
import { audioService } from './services/audioService';
import { Play, Pause, RotateCcw, Settings2, Music, Circle, Columns, Copy, Zap, Combine, X, Menu } from 'lucide-react';

const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

export default function App() {
  const [config, setConfig] = useState<SimulationConfig>({
    gravity: 0.15,
    friction: 0.999,
    ballCount: 12,
    ballSize: 8,
    boundaryRadius: 280,
    rodGap: 500,
    playbackSpeed: 1,
    trailLength: 0.15,
    pulseIntensity: 0.5,
    mode: 'circular',
    ballSizeMultiplier: 1.0,
    containerSizeMultiplier: 1.0,
    cloneOnBounce: false,
    ballCollisions: false,
    clumpingEnabled: false,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [balls, setBalls] = useState<Ball[]>([]);
  
  const ballsRef = useRef<Ball[]>([]);
  const configRef = useRef<SimulationConfig>(config);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const boundaryPulseRef = useRef(0);
  const lastIdRef = useRef(0);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    ballsRef.current = balls;
  }, [balls]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const createBall = (
    x: number, 
    y: number, 
    vx: number, 
    vy: number, 
    baseRadius: number, 
    hue: number, 
    count: number = 1,
    isClone: boolean = false
  ): Ball => {
    const id = ++lastIdRef.current;
    return {
      id,
      x,
      y,
      vx,
      vy,
      radius: baseRadius,
      baseRadius,
      pulseScale: 1.0,
      hue,
      color: `hsl(${hue % 360}, 80%, 60%)`,
      frequency: PENTATONIC[id % PENTATONIC.length],
      count,
      isClone,
      spawnTime: performance.now(),
      timeAtEdge: 0
    };
  };

  const initBalls = useCallback((customPattern?: AIPattern) => {
    lastIdRef.current = 0;
    const newBalls: Ball[] = [];
    const count = customPattern ? customPattern.velocities.length : config.ballCount;

    for (let i = 0; i < count; i++) {
      let vx, vy, x, y;

      if (customPattern) {
        x = 0;
        y = 0;
        vx = customPattern.velocities[i].vx;
        vy = customPattern.velocities[i].vy;
      } else {
        if (config.mode === 'circular') {
          x = 0;
          y = 0;
          const angle = (i / count) * Math.PI * 2;
          const speed = 2 + i * 0.15;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
        } else {
          x = 0;
          y = -350 + (i * (700 / Math.max(1, count - 1)));
          vx = 3 + (i * 0.5);
          vy = 0;
        }
      }

      newBalls.push(createBall(x, y, vx, vy, config.ballSize, (i * (360 / Math.max(1, count))) % 360, 1, false));
    }
    setBalls(newBalls);
    ballsRef.current = newBalls;
  }, [config.ballCount, config.mode, config.ballSize]);

  useEffect(() => {
    initBalls();
  }, [initBalls]);

  useEffect(() => {
    setBalls(prev => prev.map(b => ({ ...b, baseRadius: config.ballSize })));
  }, [config.ballSize]);

  const processBallInteractions = (ballList: Ball[], currentConfig: SimulationConfig) => {
    if (!currentConfig.ballCollisions && !currentConfig.clumpingEnabled) return ballList;

    const toRemove = new Set<number>();
    const updatedBalls = [...ballList];
    const now = performance.now();

    const totalUnits = updatedBalls.reduce((sum, b) => sum + b.count, 0);
    const clumpLimit = Math.max(2, Math.floor(totalUnits / 100));

    for (let i = 0; i < updatedBalls.length; i++) {
      if (toRemove.has(updatedBalls[i].id)) continue;

      for (let j = i + 1; j < updatedBalls.length; j++) {
        if (toRemove.has(updatedBalls[j].id)) continue;

        const b1 = updatedBalls[i];
        const b2 = updatedBalls[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        const minDist = b1.baseRadius + b2.baseRadius;

        if (
          currentConfig.clumpingEnabled && 
          (b1.count + b2.count <= clumpLimit) &&
          b1.isClone && b2.isClone && 
          (now - b1.spawnTime > 200) && (now - b2.spawnTime > 200) && 
          dist < (minDist + 5)
        ) {
          const speed1 = Math.sqrt(b1.vx * b1.vx + b1.vy * b1.vy);
          const speed2 = Math.sqrt(b2.vx * b2.vx + b2.vy * b2.vy);
          
          let isParallel = false;
          if (speed1 > 0 && speed2 > 0) {
            const dot = (b1.vx * b2.vx + b1.vy * b2.vy) / (speed1 * speed2);
            if (dot > 0.99) isParallel = true;
          } else if (speed1 === 0 && speed2 === 0) {
            isParallel = true;
          }

          if (isParallel) {
            const m1 = b1.count;
            const m2 = b2.count;
            const totalCount = m1 + m2;

            b1.vx = (b1.vx * m1 + b2.vx * m2) / totalCount;
            b1.vy = (b1.vy * m1 + b2.vy * m2) / totalCount;
            b1.x = (b1.x * m1 + b2.x * m2) / totalCount;
            b1.y = (b1.y * m1 + b2.y * m2) / totalCount;
            b1.baseRadius = currentConfig.ballSize;
            b1.hue = (b1.hue * m1 + b2.hue * m2) / totalCount;
            b1.color = `hsl(${b1.hue % 360}, 80%, 60%)`;
            b1.count = totalCount;
            b1.isClone = true;
            b1.spawnTime = Math.min(b1.spawnTime, b2.spawnTime);

            toRemove.add(b2.id);
            continue;
          }
        }

        if (currentConfig.ballCollisions && dist < minDist && dist > 0) {
          const angle = Math.atan2(dy, dx);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);

          const m1 = b1.count;
          const m2 = b2.count;

          const vx1 = b1.vx * cos + b1.vy * sin;
          const vy1 = b1.vy * cos - b1.vx * sin;
          const vx2 = b2.vx * cos + b2.vy * sin;
          const vy2 = b2.vy * cos - b2.vx * sin;

          const newVx1 = ((m1 - m2) * vx1 + 2 * m2 * vx2) / (m1 + m2);
          const newVx2 = (2 * m1 * vx1 + (m2 - m1) * vx2) / (m1 + m2);

          b1.vx = newVx1 * cos - vy1 * sin;
          b1.vy = vy1 * cos + newVx1 * sin;
          b2.vx = newVx2 * cos - vy2 * sin;
          b2.vy = vy2 * cos + newVx2 * sin;

          const overlap = minDist - dist;
          const moveX = (overlap / 2) * cos;
          const moveY = (overlap / 2) * sin;
          b1.x -= moveX;
          b1.y -= moveY;
          b2.x += moveX;
          b2.y += moveY;

          b1.pulseScale = 1.1;
          b2.pulseScale = 1.1;
        }
      }
    }

    return updatedBalls.filter(b => !toRemove.has(b.id));
  };

  const updateSimulation = useCallback(() => {
    if (!isPlaying) return;

    const now = performance.now();
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;

    const currentConfig = configRef.current;
    let containerUpdated = false;
    let newContainerSize = currentConfig.mode === 'circular' ? currentConfig.boundaryRadius : currentConfig.rodGap;

    let currentBalls = [...ballsRef.current];
    const addedBalls: Ball[] = [];

    const updatedAndFiltered = currentBalls.map(ball => {
      let { x, y, vx, vy, pulseScale, baseRadius, hue, count, isClone, timeAtEdge } = ball;

      if (currentConfig.mode === 'circular') {
        vy += currentConfig.gravity;
        vy *= currentConfig.friction;
      } else {
        vy = 0;
      }
      vx *= currentConfig.friction;

      x += vx * currentConfig.playbackSpeed;
      y += vy * currentConfig.playbackSpeed;

      let collided = false;
      let isNearBorder = false;

      if (currentConfig.mode === 'circular') {
        const dist = Math.sqrt(x * x + y * y);
        // Using 20px threshold for border proximity
        if (dist + baseRadius >= currentConfig.boundaryRadius - 20) {
          isNearBorder = true;
        }

        if (dist + baseRadius > currentConfig.boundaryRadius) {
          collided = true;
          const nx = dist === 0 ? 0 : x / dist;
          const ny = dist === 0 ? 1 : y / dist;
          const dot = vx * nx + vy * ny;
          
          if (Math.abs(dot) > 0.05) {
            audioService.playNote(ball.frequency);
            boundaryPulseRef.current = 1.0;
            pulseScale = 1.0 + currentConfig.pulseIntensity;
          }

          vx -= 2 * dot * nx;
          vy -= 2 * dot * ny;
          const overlap = dist + baseRadius - currentConfig.boundaryRadius;
          x -= nx * overlap;
          y -= ny * overlap;
        }
      } else {
        const halfGap = currentConfig.rodGap / 2;
        // Using 20px threshold for border proximity
        if (Math.abs(x) + baseRadius >= halfGap - 20) {
          isNearBorder = true;
        }

        if (x + baseRadius > halfGap) {
          collided = true;
          if (Math.abs(vx) > 0.05) {
            audioService.playNote(ball.frequency);
            boundaryPulseRef.current = 1.0;
            pulseScale = 1.0 + currentConfig.pulseIntensity;
          }
          vx = -Math.abs(vx);
          x = halfGap - baseRadius;
        } else if (x - baseRadius < -halfGap) {
          collided = true;
          if (Math.abs(vx) > 0.05) {
            audioService.playNote(ball.frequency);
            boundaryPulseRef.current = 1.0;
            pulseScale = 1.0 + currentConfig.pulseIntensity;
          }
          vx = Math.abs(vx);
          x = -halfGap + baseRadius;
        }
      }

      // Update time at edge
      if (isNearBorder) {
        timeAtEdge += dt;
      } else {
        timeAtEdge = 0;
      }

      // If ball stays within 20px of boundary for > 3s, return null to signal removal
      if (timeAtEdge > 3000) {
        return null;
      }

      if (collided) {
        baseRadius *= currentConfig.ballSizeMultiplier;
        if (currentConfig.containerSizeMultiplier !== 1.0) {
          newContainerSize *= currentConfig.containerSizeMultiplier;
          containerUpdated = true;
        }

        if (currentConfig.cloneOnBounce) {
          const cloneVx = vx * 0.95 + (Math.random() - 0.5) * 0.5;
          const cloneVy = vy * 0.95 + (Math.random() - 0.5) * 0.5;
          addedBalls.push(createBall(x, y, cloneVx, cloneVy, currentConfig.ballSize, hue + 15, 1, true));
        }
      } else {
        pulseScale += (1.0 - pulseScale) * 0.15;
      }

      return { ...ball, x, y, vx, vy, pulseScale, baseRadius, timeAtEdge };
    }).filter((b): b is Ball => b !== null); // Filter out removed balls

    const finalBalls = processBallInteractions([...updatedAndFiltered, ...addedBalls], currentConfig);
    
    ballsRef.current = finalBalls;
    setBalls(finalBalls);

    if (containerUpdated) {
      setConfig(prev => ({
        ...prev,
        boundaryRadius: prev.mode === 'circular' ? Math.max(1, newContainerSize) : prev.boundaryRadius,
        rodGap: prev.mode === 'horizontal' ? Math.max(1, newContainerSize) : prev.rodGap
      }));
    }

    if (boundaryPulseRef.current > 0) {
      boundaryPulseRef.current -= 0.05;
    }
  }, [isPlaying]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentConfig = configRef.current;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.fillStyle = `rgba(2, 6, 23, ${currentConfig.trailLength})`;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX, centerY);

    const pulseVal = boundaryPulseRef.current * currentConfig.pulseIntensity * 20;

    if (currentConfig.mode === 'circular') {
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0, currentConfig.boundaryRadius + pulseVal), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + boundaryPulseRef.current * 0.4})`;
      ctx.lineWidth = 4 + boundaryPulseRef.current * 8;
      ctx.stroke();
    } else {
      const halfGap = currentConfig.rodGap / 2;
      const rodWidth = 8 + pulseVal;
      
      [-halfGap, halfGap].forEach(posX => {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + boundaryPulseRef.current * 0.5})`;
        ctx.fillRect(posX - rodWidth/2, -450, rodWidth, 900);
        
        if (boundaryPulseRef.current > 0) {
          ctx.shadowBlur = 15 * boundaryPulseRef.current;
          ctx.shadowColor = 'white';
          ctx.fillRect(posX - rodWidth/2, -450, rodWidth, 900);
          ctx.shadowBlur = 0;
        }
      });
    }

    ballsRef.current.forEach(ball => {
      const currentRadius = ball.baseRadius * ball.pulseScale;
      if (currentRadius <= 1) return;
      
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.shadowBlur = Math.min(30, currentRadius);
      ctx.shadowColor = ball.color;
      ctx.fill();
    });

    ctx.restore();

    requestRef.current = requestAnimationFrame(() => {
      updateSimulation();
      draw();
    });
  }, [isPlaying, updateSimulation]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(requestRef.current);
  }, [draw]);

  const handleStart = () => {
    audioService.init();
    setIsPlaying(!isPlaying);
    lastTimeRef.current = performance.now();
  };

  const totalBallUnits = balls.reduce((acc, b) => acc + b.count, 0);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-slate-950 font-sans text-white overflow-hidden relative">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden h-full">
        <canvas
          ref={canvasRef}
          width={1000}
          height={1000}
          className="max-h-full max-w-full aspect-square"
        />
        
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-900/90 backdrop-blur-lg p-3 rounded-full border border-slate-700 shadow-2xl z-10">
          <button 
            onClick={() => initBalls()} 
            className="p-2.5 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white" 
            title="Reset Simulation"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <button 
            onClick={handleStart} 
            className="p-4 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-all shadow-lg hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-current text-white" /> : <Play className="w-6 h-6 fill-current translate-x-0.5 text-white" />}
          </button>

          <div className="h-6 w-[1px] bg-slate-700 mx-1" />
          
          <button 
            onClick={() => setConfig(p => ({...p, mode: 'circular'}))}
            className={`p-2.5 rounded-full transition-all ${config.mode === 'circular' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Circle className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setConfig(p => ({...p, mode: 'horizontal'}))}
            className={`p-2.5 rounded-full transition-all ${config.mode === 'horizontal' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Columns className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`lg:hidden p-2.5 rounded-full transition-all ${isSidebarOpen ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute top-6 left-6 text-[10px] font-mono text-slate-500 bg-slate-900/50 backdrop-blur p-2.5 rounded-lg flex flex-col gap-1 border border-slate-800/50">
          <div>BALL UNITS: {totalBallUnits}</div>
          <div>SPRITES: {balls.length}</div>
          <div>CLUMP CAP: {Math.max(2, Math.floor(totalBallUnits / 100))}</div>
        </div>
      </div>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 right-0 z-50 w-full max-w-xs md:max-w-sm lg:static lg:translate-x-0 
        bg-slate-900 border-l border-slate-800 p-6 shadow-2xl flex flex-col transition-transform duration-300 ease-out
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg"><Music className="w-5 h-5 text-white" /></div>
            <h1 className="text-lg font-bold tracking-tight uppercase tracking-[0.2em] text-white">Harmonic Pulse</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <section className="space-y-6 flex-1 overflow-y-auto no-scrollbar pb-10">
          <div className="space-y-5">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2">Core Physics</h3>
            <ControlSlider label="Gravity" min={0} max={1.0} step={0.01} value={config.gravity} onChange={v => setConfig({...config, gravity: v})} />
            <ControlSlider label="Friction" min={0} max={1.0} step={0.001} value={config.friction} onChange={v => setConfig({...config, friction: v})} />
            <ControlSlider label="Base Ball Size" min={0} max={50} step={1} value={config.ballSize} onChange={v => setConfig({...config, ballSize: v})} />
            <ControlSlider label="Initial Ball Count" min={0} max={100} step={1} value={config.ballCount} onChange={v => setConfig({...config, ballCount: v})} />
            
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 pt-4 border-b border-slate-800 pb-2">Dynamics</h3>
            <div className="flex items-center gap-3 py-2">
              <ToggleControl 
                active={config.cloneOnBounce} 
                onClick={() => setConfig({...config, cloneOnBounce: !config.cloneOnBounce})}
                icon={<Copy className="w-4 h-4" />}
                label="Clone"
              />
              <ToggleControl 
                active={config.ballCollisions} 
                onClick={() => setConfig({...config, ballCollisions: !config.ballCollisions})}
                icon={<Zap className="w-4 h-4" />}
                label="Physics"
              />
              <ToggleControl 
                active={config.clumpingEnabled} 
                onClick={() => setConfig({...config, clumpingEnabled: !config.clumpingEnabled})}
                icon={<Combine className="w-4 h-4" />}
                label="Clump"
              />
            </div>

            <ControlSlider label="Size Scale (Ball)" min={0.5} max={1.5} step={0.01} value={config.ballSizeMultiplier} onChange={v => setConfig({...config, ballSizeMultiplier: v})} />
            <ControlSlider label="Size Scale (Cont.)" min={0.95} max={1.05} step={0.001} value={config.containerSizeMultiplier} onChange={v => setConfig({...config, containerSizeMultiplier: v})} />
            <ControlSlider label="Pulse Power" min={0} max={5} step={0.1} value={config.pulseIntensity} onChange={v => setConfig({...config, pulseIntensity: v})} />
            
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 pt-4 border-b border-slate-800 pb-2">Environment</h3>
            {config.mode === 'circular' ? (
              <ControlSlider label="Container Radius" min={0} max={500} step={10} value={config.boundaryRadius} onChange={v => setConfig({...config, boundaryRadius: v})} />
            ) : (
              <ControlSlider label="Rod Distance" min={0} max={1000} step={10} value={config.rodGap} onChange={v => setConfig({...config, rodGap: v})} />
            )}
            
            <ControlSlider label="Speed" min={0} max={5.0} step={0.1} value={config.playbackSpeed} onChange={v => setConfig({...config, playbackSpeed: v})} />
            <ControlSlider label="Trail Effect" min={0} max={1.0} step={0.01} value={config.trailLength} onChange={v => setConfig({...config, trailLength: v})} />
          </div>
        </section>

        <div className="pt-6 border-t border-slate-800 opacity-50 text-center">
          <p className="text-[9px] text-slate-500 leading-relaxed uppercase tracking-widest text-wrap">
            Inspired by @form_pulse<br/>CLEANUP MODE: 20PX/3S REMOVAL ACTIVE
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleControl({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all border ${active ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
    >
      {icon}
      <span className="text-[9px] font-bold uppercase">{label}</span>
    </button>
  );
}

function ControlSlider({ label, min, max, step, value, onChange }: { label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold mb-2 uppercase tracking-widest text-slate-400">
        <span>{label}</span>
        <span className="text-indigo-400">{typeof value === 'number' ? value.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0) : value}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}
