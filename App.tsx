import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { motion, useMotionValue, useSpring, useTransform, animate, useVelocity } from 'framer-motion';
import { Gear, Play, Pause, ArrowClockwise, Plus, Info } from '@phosphor-icons/react';

// --- Types ---
type ShapeType = 'circle' | 'square' | 'triangle';

interface ShapeData {
  id: number;
  type: ShapeType;
  color: string;
  size: number;
}

// --- Components ---

/**
 * Individual Shape Component
 * Driven by Matter.js body data but rendered via Framer Motion
 */
const PhysicsShape: React.FC<{ 
  engine: Matter.Engine;
  body: Matter.Body; 
  data: ShapeData;
}> = ({ engine, body, data }) => {
  const x = useMotionValue(body.position.x);
  const y = useMotionValue(body.position.y);
  const rotate = useMotionValue(body.angle * (180 / Math.PI));
  
  const squash = useMotionValue(1);
  const stretch = useMotionValue(1);
  const impactX = useMotionValue(0);
  const impactY = useMotionValue(0);

  const springSquash = useSpring(squash, { stiffness: 200, damping: 25 });
  const springStretch = useSpring(stretch, { stiffness: 200, damping: 25 });

  const velX = useVelocity(x);
  const velY = useVelocity(y);

  // Peak tracking for physics-accurate drop velocity
  const peakY = useRef(body.position.y);
  const lastStateResetTime = useRef(Date.now());

  useEffect(() => {
    // Collision-triggered rebound logic
    const handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
      if (body.label === 'dragging') return;

      event.pairs.forEach((pair) => {
        const { bodyA, bodyB, collision } = pair;
        if (bodyA.id !== body.id && bodyB.id !== body.id) return;

        const otherBody = bodyA.id === body.id ? bodyB : bodyA;
        
        // Impact Physics: Use relative velocity of the pair
        const relativeVel = Matter.Vector.sub(bodyA.velocity, bodyB.velocity);
        const impactSpeed = Matter.Vector.magnitude(relativeVel) * 60;
        
        // Trigger rebound based on relative impact force
        if (impactSpeed > 200) {
          const normal = bodyA.id === body.id ? collision.normal : { x: -collision.normal.x, y: -collision.normal.y };
          const intensity = Math.min(0.7, impactSpeed / 2200);
          const ratio = Math.abs(normal.y) / (Math.abs(normal.x) + 0.1);

          if (ratio > 1.2) {
            impactY.set(-intensity);
            impactX.set(intensity * 0.5);
            animate(impactY, 0, { type: 'spring', stiffness: 300, damping: 12 });
            animate(impactX, 0, { type: 'spring', stiffness: 300, damping: 12 });
          } else if (ratio < 0.8) {
            impactX.set(-intensity);
            impactY.set(intensity * 0.5);
            animate(impactX, 0, { type: 'spring', stiffness: 300, damping: 12 });
            animate(impactY, 0, { type: 'spring', stiffness: 300, damping: 12 });
          } else {
            const df = intensity * 0.7;
            impactX.set(-df);
            impactY.set(-df);
            animate(impactX, 0, { type: 'spring', stiffness: 300, damping: 12 });
            animate(impactY, 0, { type: 'spring', stiffness: 300, damping: 12 });
          }
        }

        // Reset peak tracking on impact
        peakY.current = body.position.y;
        lastStateResetTime.current = Date.now();
      });
    };

    const update = () => {
      // Sync positions
      if (body.label !== 'dragging') {
        x.set(body.position.x);
        y.set(body.position.y);
        rotate.set(body.angle * (180 / Math.PI));

        // Track peak height reached (lowest Y is highest point)
        if (body.position.y < peakY.current) {
          peakY.current = body.position.y;
          lastStateResetTime.current = Date.now();
        }
      }

      const vx = velX.get();
      const vy = velY.get();
      const speed = Math.sqrt(vx * vx + vy * vy);

      // --- Continuous Motion Deformation (Stretch in direction of motion) ---
      const stretchMax = 0.35;
      const stretchAmount = Math.max(0, Math.min(stretchMax, speed / 2500));

      let finalScaleX = 1;
      let finalScaleY = 1;

      if (speed > 40) {
        const vRatio = Math.abs(vy) / (Math.abs(vx) + 0.1);
        if (vRatio > 1.2) {
          finalScaleX = 1 - (stretchAmount * 0.5);
          finalScaleY = 1 + stretchAmount;
        } else if (vRatio < 0.8) {
          finalScaleX = 1 + stretchAmount;
          finalScaleY = 1 - (stretchAmount * 0.5);
        } else {
          finalScaleX = 1 + stretchAmount * 0.3;
          finalScaleY = 1 + stretchAmount * 0.3;
        }
      }

      // Final Cumulative Scales
      stretch.set(finalScaleX + impactX.get());
      squash.set(finalScaleY + impactY.get());
    };

    Matter.Events.on(engine, 'collisionStart', handleCollision);
    Matter.Events.on(engine, 'afterUpdate', update);
    return () => {
      Matter.Events.off(engine, 'collisionStart', handleCollision);
      Matter.Events.off(engine, 'afterUpdate', update);
    };
  }, [engine, body]);

  const handleDragStart = () => {
    Matter.Body.setStatic(body, true);
    body.label = 'dragging';
  };

  const handleDrag = () => {
    Matter.Body.setPosition(body, { x: x.get(), y: y.get() });
  };

  const handleDragEnd = () => {
    Matter.Body.setStatic(body, false);
    body.label = 'body';
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);
  };

  const renderPath = () => {
    const s = data.size;
    switch (data.type) {
      case 'circle':
        return <circle cx="0" cy="0" r={s / 2} fill={data.color} />;
      case 'square':
        return <rect x={-s / 2} y={-s / 2} width={s} height={s} fill={data.color} rx={4} />;
      case 'triangle':
        return (
          <path 
            d={`M 0 ${-s/2} L ${s/2} ${s/2} L ${-s/2} ${s/2} Z`} 
            fill={data.color} 
          />
        );
    }
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        x,
        y,
        rotate,
        scaleX: springStretch,
        scaleY: springSquash,
        width: data.size,
        height: data.size,
        marginLeft: -data.size / 2,
        marginTop: -data.size / 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        zIndex: 10,
        pointerEvents: 'auto', // MUST BE AUTO to receive drag events
      }}
      whileDrag={{ cursor: 'grabbing', zIndex: 100 }}
    >
      <svg 
        width={data.size * 2} 
        height={data.size * 2} 
        viewBox={`-${data.size} -${data.size} ${data.size * 2} ${data.size * 2}`}
        style={{ overflow: 'visible' }}
      >
        <filter id={`glow-${data.id}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <g filter={`url(#glow-${data.id})`}>
           {renderPath()}
        </g>
      </svg>
    </motion.div>
  );
};

export const App: React.FC = () => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  
  const [bodies, setBodies] = useState<{ id: number; body: Matter.Body; data: ShapeData }[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (!sceneRef.current) return;

    const container = sceneRef.current;
    let thickness = 100;
    
    // Matter.js engine setup
    const engine = Matter.Engine.create();
    engine.gravity.y = 1; 
    engineRef.current = engine;

    const render = Matter.Render.create({
      element: container,
      engine: engine,
      options: {
        width: container.clientWidth || window.innerWidth,
        height: container.clientHeight || window.innerHeight,
        wireframes: false,
        background: 'transparent',
      }
    });
    render.canvas.style.display = 'none';
    renderRef.current = render;

    const runner = Matter.Runner.create();
    runnerRef.current = runner;

    // Create walls with large dimensions to ensure they cover all screen sizes
    const walls = [
      Matter.Bodies.rectangle(0, 0, 5000, thickness, { isStatic: true, label: 'wall' }), // Top
      Matter.Bodies.rectangle(0, 0, 5000, thickness, { isStatic: true, label: 'wall' }), // Bottom
      Matter.Bodies.rectangle(0, 0, thickness, 5000, { isStatic: true, label: 'wall' }), // Left
      Matter.Bodies.rectangle(0, 0, thickness, 5000, { isStatic: true, label: 'wall' }), // Right
    ];
    Matter.World.add(engine.world, walls);

    let hasInitialized = false;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) return;

        render.canvas.width = width;
        render.canvas.height = height;
        
        // Reposition walls based on new dimensions
        Matter.Body.setPosition(walls[0], { x: width / 2, y: -thickness / 2 });
        Matter.Body.setPosition(walls[1], { x: width / 2, y: height + thickness / 2 });
        Matter.Body.setPosition(walls[2], { x: -thickness / 2, y: height / 2 });
        Matter.Body.setPosition(walls[3], { x: width + thickness / 2, y: height / 2 });

        if (!hasInitialized) {
          // Initial bodies
          const initialShapes: { id: number; body: Matter.Body; data: ShapeData }[] = [];
          const colors = ['#FF4D4D', '#4DFF4D', '#4D4DFF', '#FFFF4D', '#FF4DFF', '#4DFFFF'];
          
          for (let i = 0; i < 15; i++) {
              const type: ShapeType = ['circle', 'square', 'triangle'][Math.floor(Math.random() * 3)] as ShapeType;
              const size = 40 + Math.random() * 40;
              const xPos = Math.random() * width;
              const yPos = Math.random() * (height / 2);
              
              let body;
              if (type === 'circle') body = Matter.Bodies.circle(xPos, yPos, size / 2, { restitution: 0.6, friction: 0.1, label: 'body' });
              else if (type === 'square') body = Matter.Bodies.rectangle(xPos, yPos, size, size, { restitution: 0.4, friction: 0.2, label: 'body' });
              else body = Matter.Bodies.polygon(xPos, yPos, 3, size / 2, { restitution: 0.3, friction: 0.3, label: 'body' });
              
              Matter.World.add(engine.world, body);
              initialShapes.push({
                  id: body.id,
                  body,
                  data: { id: body.id, type, color: colors[i % colors.length], size }
              });
          }

          setBodies(initialShapes);
          Matter.Runner.run(runner, engine);
          hasInitialized = true;
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      Matter.Engine.clear(engine);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.World.clear(engine.world, false);
      render.canvas.remove();
    };
  }, []);

  const togglePause = () => {
    if (!runnerRef.current || !engineRef.current) return;
    if (isPaused) {
       Matter.Runner.run(runnerRef.current, engineRef.current);
    } else {
       Matter.Runner.stop(runnerRef.current);
    }
    setIsPaused(!isPaused);
  };

  const addShape = () => {
    if (!engineRef.current) return;
    const type: ShapeType = ['circle', 'square', 'triangle'][Math.floor(Math.random() * 3)] as ShapeType;
    const size = 40 + Math.random() * 40;
    const x = Math.random() * window.innerWidth;
    const y = 50;
    const colors = ['#FF4D4D', '#4DFF4D', '#4D4DFF', '#FFFF4D', '#FF4DFF', '#4DFFFF'];
    
    let body;
    if (type === 'circle') body = Matter.Bodies.circle(x, y, size / 2, { restitution: 0.6, friction: 0.1 });
    else if (type === 'square') body = Matter.Bodies.rectangle(x, y, size, size, { restitution: 0.4, friction: 0.2 });
    else body = Matter.Bodies.polygon(x, y, 3, size / 2, { restitution: 0.3, friction: 0.3 });
    
    Matter.World.add(engineRef.current.world, body);
    setBodies(prev => [...prev, {
        id: body.id,
        body,
        data: { id: body.id, type, color: colors[prev.length % colors.length], size }
    }]);
  };

  const resetSimulation = () => {
    window.location.reload();
  };

  return (
    <div className="relative w-full h-screen bg-[#0A0A0A] overflow-hidden select-none font-sans text-white">
      {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1A1A1A_0%,#0A0A0A_100%)]" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Simulation Layer */}
      <div ref={sceneRef} className="absolute inset-0 pointer-events-auto z-0" />
       
      {/* Rendering Shapes with React (Framer Motion) */}
      <div className="absolute inset-0 pointer-events-none z-10">
         {engineRef.current && bodies.map(({ id, body, data }) => (
           <PhysicsShape 
              key={id} 
              engine={engineRef.current!}
              body={body} 
              data={data} 
           />
         ))}
      </div>

      {/* Global CSS for pointer events in Matter.js canvas */}
      <style>{`
        canvas {
          touch-action: none;
        }
      `}</style>
    </div>
  );
};
