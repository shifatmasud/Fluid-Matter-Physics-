import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { 
  motion, 
  AnimatePresence, 
  useDragControls, 
  useAnimation, 
  useMotionValue, 
  useVelocity, 
  useTransform, 
  useSpring,
  animate
} from 'framer-motion';

// -----------------------------------------------------------------------------
// TIER 2: DESIGN SYSTEM (THEME)
// -----------------------------------------------------------------------------

const Theme = {
  Color: {
    Base: {
      Surface: {
        1: '#E8E8ED', // Studio Cool Grey
        2: '#FFFFFF', // Panel White
        3: '#F2F2F7', // Control Background
      },
      Content: {
        1: '#1D1D1F', // Primary Text
        2: '#86868B', // Secondary Text
        3: '#AEAEB2', // Tertiary
      },
    },
  },
  Type: {
    Readable: {
      Label: {
        S: { 
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
          fontSize: '13px', 
          fontWeight: 500, 
          letterSpacing: '-0.01em' 
        },
        XS: { 
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
          fontSize: '11px', 
          fontWeight: 600, 
          letterSpacing: '0.02em' 
        },
      },
    },
  },
  Space: { XS: 4, S: 8, M: 16, L: 24, XL: 48 },
  Radius: { S: 8, M: 16, Full: 9999 },
};

// -----------------------------------------------------------------------------
// UTILS: GLASS GENERATOR (RECT ONLY)
// -----------------------------------------------------------------------------

interface GlassMaps {
  surfaceUrl: string;
}

function generateGlassMaps(
  width: number,
  height: number,
  radius: number,
  bezel: number,
): GlassMaps {
  
  if (width <= 0 || height <= 0) return { surfaceUrl: '' };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return { surfaceUrl: '' };

  const size = width * height;
  const heightMap = new Float32Array(size);

  const cx = width / 2;
  const cy = height / 2;
  
  // Safe radius clamping
  const r = Math.min(radius, Math.min(width, height) / 2);
  const bx = (width / 2) - r;
  const by = (height / 2) - r;

  // --- STAGE 1: GEOMETRY (Rounded Box SDF) ---
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      const dx = Math.abs(x - cx) - bx;
      const dy = Math.abs(y - cy) - by;
      const dOuter = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2);
      const dInner = Math.min(Math.max(dx, dy), 0);
      const dist = dOuter + dInner - r; 

      // Height Profile (0 to 1)
      let h = 0;
      if (dist < -bezel) h = 1.0;
      else if (dist > 1.0) h = 0.0;
      else {
        const t = Math.max(0, Math.min(1, -dist / bezel));
        // Smoothstep-like ease for glass slope
        h = t * t * (3 - 2 * t); 
      }

      heightMap[idx] = h;
    }
  }

  // --- STAGE 2: NORMALS & PACKING ---
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;
  const steepness = 8.0; // Strong normals for glass

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(width - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(height - 1, y + 1);
      
      const hVal = heightMap[y * width + x];
      
      const dx = (heightMap[y * width + x0] - heightMap[y * width + x1]) * steepness;
      const dy = (heightMap[y0 * width + x] - heightMap[y1 * width + x]) * steepness;
      
      // Normalize
      const len = Math.sqrt(dx * dx + dy * dy + 1.0);
      const nx = dx / len;
      const ny = dy / len;

      // Pack Data:
      // R: Normal X (0..255). 128 is 0.
      // G: Normal Y (0..255). 128 is 0.
      // B: Unused (Height)
      // A: 255 (Full Opacity). CRITICAL FIX: Do not use transparency.
      
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = hVal * 255; 
      data[i + 3] = 255; // ALWAYS OPAQUE
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { surfaceUrl: canvas.toDataURL('image/png') };
}

// -----------------------------------------------------------------------------
// COMPONENTS: SECTIONS
// -----------------------------------------------------------------------------

const CodeIO: React.FC = () => {
  const styles = {
    wrapper: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: Theme.Space.M,
    },
    section: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: Theme.Space.XS,
    },
    label: {
      ...Theme.Type.Readable.Label.XS,
      color: Theme.Color.Base.Content[3],
      letterSpacing: '0.1em',
    },
    block: {
      fontSize: '11px',
      background: 'rgba(0,0,0,0.4)',
      padding: Theme.Space.M,
      borderRadius: Theme.Radius.S,
      color: Theme.Color.Base.Content[2],
      border: `1px solid ${Theme.Color.Base.Surface[3]}`,
      whiteSpace: 'pre-wrap' as const,
      fontFamily: '"JetBrains Mono", monospace',
    },
    keyword: { color: '#FF7B72' },
    prop: { color: '#D2A8FF' },
    value: { color: '#79C0FF' },
    comment: { color: '#6E7681', fontStyle: 'italic' },
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.section}>
        <span style={styles.label}>INPUT (Filter Props)</span>
        <div style={styles.block}>
          {`{
  "feDisplacementMap": {
    "in": "SourceGraphic",
    "in2": "displacementMap",
    "scale": `}<span style={styles.value}>30</span>{`,
    "xChannelSelector": "R",
    "yChannelSelector": "G"
  }
}`}
        </div>
      </div>

      <div style={styles.section}>
        <span style={styles.label}>COLOR MAPPING LOGIC</span>
        <div style={styles.block}>
          <span style={styles.comment}>// How pixels map to displacement:</span>{'\n'}
          <span style={styles.comment}>// 0   (0x00) -{'>'} Negative Shift (-Scale/2)</span>{'\n'}
          <span style={styles.comment}>// 127 (0x7F) -{'>'} Zero Displacement (Neutral)</span>{'\n'}
          <span style={styles.comment}>// 255 (0xFF) -{'>'} Positive Shift (+Scale/2)</span>{'\n'}
          {'\n'}
          <span style={styles.keyword}>function</span> <span style={styles.prop}>mapColorToOffset</span>(color) {'{'}{'\n'}
          {'  '}<span style={styles.keyword}>return</span> ((color / 255) - 0.5) * scale;{'\n'}
          {'}'}
        </div>
      </div>

      <div style={styles.section}>
        <span style={styles.label}>SURFACE FUNCTION (Squircle)</span>
        <div style={styles.block}>
          <span style={styles.comment}>// Superellipse SDF approximation</span>{'\n'}
          <span style={styles.keyword}>const</span> u = (x - cx) / rx;{'\n'}
          <span style={styles.keyword}>const</span> v = (y - cy) / ry;{'\n'}
          <span style={styles.comment}>// Implicit Surface Equation (n=4)</span>{'\n'}
          <span style={styles.keyword}>const</span> val = <span style={styles.prop}>pow</span>(<span style={styles.prop}>abs</span>(u), 4) + <span style={styles.prop}>pow</span>(<span style={styles.prop}>abs</span>(v), 4);{'\n'}
          <span style={styles.keyword}>const</span> height = val {'>'} 1 ? 0 : 1; 
        </div>
      </div>
    </div>
  );
};

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'action' | 'system';
}

const Console: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', justifyContent: 'flex-start' }}>
      {logs.length === 0 && (
        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: Theme.Color.Base.Content[3], textAlign: 'center', marginTop: '20px' }}>
          _
        </div>
      )}
      {logs.map((log, index) => (
        <div 
          key={log.id} 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: '60px 1fr',
            gap: '12px', 
            fontSize: '11px',
            fontFamily: 'monospace',
            opacity: Math.max(0.4, 1 - (logs.length - 1 - index) * 0.1),
          }}
        >
          <span style={{ color: Theme.Color.Base.Content[3], textAlign: 'right' }}>
            {log.timestamp.split(' ')[0]}
          </span>
          <span style={{ 
            color: log.type === 'action' ? '#79C0FF' : 
                   log.type === 'system' ? '#E2E8F0' : 
                   Theme.Color.Base.Content[2],
            wordBreak: 'break-word'
          }}>
            {log.type === 'system' && <span style={{ color: '#FFD60A', marginRight: '8px' }}>➜</span>}
            {log.message}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

const StudioBackground: React.FC = () => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      background: '#F0F0F5', 
      pointerEvents: 'none',
    }}>
      {/* Engineering Grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(#D6D6DD 1px, transparent 1px),
          linear-gradient(90deg, #D6D6DD 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
        opacity: 0.8,
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(#E8E8ED 1px, transparent 1px),
          linear-gradient(90deg, #E8E8ED 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        opacity: 0.5,
      }} />
      
      {/* Studio Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, transparent 30%, rgba(180,180,190,0.5) 100%)',
      }} />
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
    <div style={{ 
      textTransform: 'uppercase', 
      fontSize: '11px', 
      fontWeight: 600, 
      color: Theme.Color.Base.Content[3],
      letterSpacing: '0.05em'
    }}>
      {title}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {children}
    </div>
  </div>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void }> = ({ label, value, min, max, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: Theme.Space.XS }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ ...Theme.Type.Readable.Label.S, color: Theme.Color.Base.Content[2] }}>{label}</span>
      <span style={{ ...Theme.Type.Readable.Label.XS, fontFamily: 'monospace', color: Theme.Color.Base.Content[1] }}>{value.toFixed(1)}</span>
    </div>
    <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
      <input
        type="range"
        min={min} max={max} step={0.1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%', height: '4px', appearance: 'none',
          background: Theme.Color.Base.Surface[3], borderRadius: Theme.Radius.Full,
          outline: 'none', cursor: 'ew-resize',
        }}
        className="range-input"
      />
      <style>{`.range-input::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #000; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.1s; } .range-input::-webkit-slider-thumb:hover { transform: scale(1.1); }`}</style>
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// COMPONENT: LIQUID GLASS FILTER (SVG DEF)
// -----------------------------------------------------------------------------

interface LiquidGlassFilterProps {
  id: string;
  mapUrl: string;
  width: number;
  height: number;
  intensity: number;
  chromaticDelta: number;
}

const LiquidGlassFilter: React.FC<LiquidGlassFilterProps> = React.memo(({
  id,
  mapUrl,
  width,
  height,
  intensity,
  chromaticDelta,
}) => {
  if (!width || !height) return null;

  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        <filter 
          id={id} 
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          x="0" y="0" 
          width={width} 
          height={height}
        >
          {/* Source Map */}
          <feImage 
            href={mapUrl} 
            result="map" 
            x="0" y="0" 
            width={width} 
            height={height} 
            preserveAspectRatio="none"
          />

          {/* 
             SPECTRAL DISPLACEMENT 
             We split the displacement into R, G, B channels with offsets.
          */}

          {/* Red Channel: Scale + Delta */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="map" 
            scale={intensity + chromaticDelta} 
            xChannelSelector="R" 
            yChannelSelector="G" 
            result="dispR"
            colorInterpolationFilters="sRGB"
          />

          {/* Green Channel: Base Scale */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="map" 
            scale={intensity} 
            xChannelSelector="R" 
            yChannelSelector="G" 
            result="dispG"
            colorInterpolationFilters="sRGB"
          />

          {/* Blue Channel: Scale - Delta */}
          <feDisplacementMap 
            in="SourceGraphic" 
            in2="map" 
            scale={intensity - chromaticDelta} 
            xChannelSelector="R" 
            yChannelSelector="G" 
            result="dispB"
            colorInterpolationFilters="sRGB"
          />

          {/* 
             RECOMBINATION
             We need to take the Red component from dispR, Green from dispG, Blue from dispB.
             Using feColorMatrix instead of feComponentTransfer for better performance.
          */}
          
          <feColorMatrix in="dispR" result="R" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
          <feColorMatrix in="dispG" result="G" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" />
          <feColorMatrix in="dispB" result="B" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />

          {/* Merge channels. Arithmetic add works well here since channels are isolated. */}
          <feComposite operator="arithmetic" k2="1" k3="1" in="R" in2="G" result="RG" />
          <feComposite operator="arithmetic" k2="1" k3="1" in="RG" in2="B" result="RGB" />

        </filter>
      </defs>
    </svg>
  );
});

// -----------------------------------------------------------------------------
// COMPONENT: GLASS BUBBLE (PARENT-CHILD ARCHITECTURE)
// -----------------------------------------------------------------------------

interface GlassBubbleProps {
  radius?: number;
  bezel?: number;
  intensity?: number;
  chromaticDelta?: number;
  frost?: number;
  highlight?: number;
  ambient?: number; // New Ambient Glow Prop
  dropShadow?: number;
  volumeShadow?: number;
  debug?: boolean;
}

export const GlassBubble: React.FC<GlassBubbleProps> = ({
  radius = 80,
  bezel = 40,
  intensity = 30,
  chromaticDelta = 0,
  frost = 0,
  highlight = 0.5,
  ambient = 0.5, // Default Ambient
  dropShadow = 0.5,
  volumeShadow = 0.5,
  debug = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapUrl, setMapUrl] = useState<string>('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const rawId = useId();
  const filterId = `glass-refract-${rawId.replace(/[:]/g, '')}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = Math.ceil(entry.contentRect.width);
        const h = Math.ceil(entry.contentRect.height);
        setDimensions({ width: w, height: h });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    const timeout = setTimeout(() => {
      const { surfaceUrl } = generateGlassMaps(
        dimensions.width,
        dimensions.height,
        radius,
        bezel
      );
      setMapUrl(surfaceUrl);
    }, 50);
    return () => clearTimeout(timeout);
  }, [dimensions, radius, bezel]);

  // STYLES
  const containerStyle: React.CSSProperties = {
    position: 'relative', 
    width: '100%', 
    height: '100%',
    borderRadius: radius,
    // PARENT: Handles Refraction via SVG Filter
    // Combines with FROST (blur)
    backdropFilter: mapUrl ? `url(#${filterId}) blur(${frost}px)` : `blur(${frost}px)`,
    WebkitBackdropFilter: mapUrl ? `url(#${filterId}) blur(${frost}px)` : `blur(${frost}px)`,
    
    // PARENT: Handles Shape Clipping
    overflow: 'hidden',
    // PARENT: Handles Drop Shadow - Realistic diffused look
    boxShadow: `
      0 50px 100px -20px rgba(0,0,0,${dropShadow * 0.25}),
      0 30px 60px -30px rgba(0,0,0,${dropShadow * 0.3})
    `,
    zIndex: 10,
    willChange: 'transform, backdrop-filter',
    transform: 'translateZ(0)', // Force GPU layer
  };

  const layerInset: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    pointerEvents: 'none',
  };

  return (
    <motion.div 
      ref={containerRef} 
      style={containerStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* RENDER THE SVG FILTER */}
      {mapUrl && (
        <LiquidGlassFilter 
          id={filterId}
          mapUrl={mapUrl}
          width={dimensions.width}
          height={dimensions.height}
          intensity={intensity}
          chromaticDelta={chromaticDelta}
        />
      )}

      {/* CHILD 1: VOLUME (Dark Inner Edges) - zIndex 1 */}
      {/* Adds mass and density to the object by darkening the thickest parts */}
      <div style={{
        ...layerInset,
        boxShadow: `
          inset 0 0 ${bezel}px rgba(0,0,0,${volumeShadow * 0.4}),
          inset 0 0 20px rgba(0,0,0,${volumeShadow * 0.3})
        `,
        mixBlendMode: 'multiply',
        zIndex: 1,
      }} />
      
      {/* CHILD 2: VOLUMETRIC LIGHT (White Border Glow) - zIndex 2 */}
      {/* Simulates white light entering and scattering from the edges. */}
      <div style={{
        ...layerInset,
        boxShadow: `inset 0 0 ${bezel * 1.5}px rgba(255, 255, 255, ${ambient * 0.5})`,
        mixBlendMode: 'screen',
        zIndex: 2,
      }} />

      {/* CHILD 3: INNER GLOW (Warm Center/Bottom) - zIndex 3 */}
      {/* NEW: Simulates light scattering inside the volume (Subsurface Scattering) */}
      <div style={{
         ...layerInset,
         background: `
            radial-gradient(circle at 50% 120%, rgba(255,255,255,${ambient * 0.35}) 0%, transparent 60%),
            radial-gradient(circle at 50% -20%, rgba(255,255,255,${ambient * 0.1}) 0%, transparent 50%)
         `,
         mixBlendMode: 'screen', // Adds light without washing out shadows
         zIndex: 3,
      }} />

      {/* CHILD 4: EDGE BLUR (Milky Caustic Edge) - zIndex 4 */}
      {/* NEW: A heavily blurred inset border creating a soft, milky transition at the edge */}
      <div style={{
         ...layerInset,
         boxShadow: `inset 0 0 0 ${Math.max(1, bezel/6)}px rgba(255,255,255,${highlight * 0.3})`,
         filter: `blur(${Math.max(2, bezel/3)}px)`,
         zIndex: 4,
         mixBlendMode: 'overlay',
         opacity: 0.8,
      }} />

      {/* CHILD 5: AMBIENT GLOW (Sharp Inner Edge) - zIndex 5 */}
      {/* Defines the inner boundary of the glass surface */}
      <div style={{
        ...layerInset,
        boxShadow: `
          inset 0 0 ${bezel}px rgba(255,255,255,${ambient * 0.15}),
          inset 0 0 ${Math.max(2, bezel / 8)}px rgba(255,255,255,${ambient * 0.5})
        `,
        mixBlendMode: 'screen',
        zIndex: 5,
      }} />

      {/* CHILD 6: SPECULAR (Rim Light & Gloss) - zIndex 6 */}
      {/* The sharpest reflection on the outer surface */}
      <div style={{
        ...layerInset,
        boxShadow: `
          inset 0 1px 0 0 rgba(255,255,255, ${highlight * 0.9}),
          inset 0 -1px 0 0 rgba(255,255,255, ${highlight * 0.3})
        `,
        background: `
          radial-gradient(100% 100% at 30% 20%, rgba(255,255,255,${highlight * 0.4}) 0%, transparent 40%),
          linear-gradient(180deg, rgba(255,255,255,${highlight * 0.1}) 0%, transparent 100%)
        `,
        zIndex: 6,
      }} />
      
      {/* CHILD 7: FROST OVERLAY - zIndex 7 */}
      {frost > 0 && (
         <div style={{
            ...layerInset,
            backgroundColor: `rgba(255,255,255, ${Math.min(0.2, frost * 0.02)})`,
            zIndex: 7,
         }} />
      )}

      {/* Debug View */}
      {debug && mapUrl && (
        <div style={{
          ...layerInset,
          backgroundImage: `url("${mapUrl}")`, 
          backgroundSize: '100% 100%',
          opacity: 0.8,
          zIndex: 100
        }} />
      )}
    </motion.div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: LIQUID WRAPPER (PHYSICS MOTION)
// -----------------------------------------------------------------------------

const LiquidWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Track position for velocity
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const velX = useVelocity(x);
  const velY = useVelocity(y);
  
  // Tap pressure motion value (0 = no pressure, 1 = full pressure)
  const pressure = useMotionValue(0);
  // Internal flag to track if we've moved since the last pointer down
  const handedOff = useRef(false);

  // Total velocity magnitude
  const velocity = useTransform([velX, velY], ([vx, vy]) => {
    const v = Math.sqrt(Math.pow(vx as number, 2) + Math.pow(vy as number, 2));
    
    // DECELERATION LOGIC:
    // If we were moving and now we are effectively stopped (v < 50), 
    // we want the spring to return to 1.0. By clearing pressure here,
    // we ensure the "stretch" (spring overshoot) triggers immediately.
    if (v > 150) {
      if (!handedOff.current) {
        handedOff.current = true;
        animate(pressure, 0, { duration: 0.1 });
      }
    }
    return v;
  });

  // Calculate the target squash based on both velocity and pressure
  // v / 3000 -> mapping velocity to squash (up to 0.25)
  const targetScaleX = useTransform([velocity, pressure], ([v, p]) => {
    const vFactor = Math.min(0.25, (v as number) / 3000);
    // Pressure only contributes if we haven't handed off to velocity yet
    const pFactor = handedOff.current ? 0 : (p as number) * 0.2;
    return 1 + vFactor + pFactor;
  });

  const targetScaleY = useTransform([velocity, pressure], ([v, p]) => {
    const vFactor = Math.min(0.25, (v as number) / 3000);
    const pFactor = handedOff.current ? 0 : (p as number) * 0.2;
    return 1 - vFactor - pFactor;
  });

  // OBSERVER-BASED PHYSICS:
  // Using low damping (12) ensures that when velocity hits 0,
  // the scale "overshoots" 1.0, creating a natural vertical stretch/wobble.
  const springX = useSpring(targetScaleX, { stiffness: 450, damping: 12, mass: 1 });
  const springY = useSpring(targetScaleY, { stiffness: 450, damping: 12, mass: 1 });

  return (
    <motion.div
      drag
      dragMomentum={true}
      dragElastic={0.1}
      onPointerDown={() => {
        handedOff.current = false;
        animate(pressure, 1, { duration: 0.15 });
      }}
      onPointerUp={() => {
        animate(pressure, 0, { duration: 0.1 });
      }}
      onPointerCancel={() => {
        animate(pressure, 0);
      }}
      style={{
        x, y,
        scaleX: springX,
        scaleY: springY,
        position: 'absolute', top: '50%', left: '50%',
        width: 'clamp(300px, 50vw, 600px)', 
        height: 'clamp(200px, 30vw, 360px)', 
        zIndex: 10, cursor: 'grab',
        touchAction: 'none',
        transformOrigin: 'center center',
        willChange: 'transform',
        translateX: '-50%',
        translateY: '-50%',
      }}
    >
      {children}
    </motion.div>
  );
};

// -----------------------------------------------------------------------------
// APP: META GLASS
// -----------------------------------------------------------------------------

interface GlassState {
  bezel: number;
  intensity: number;
  chromaticDelta: number;
  frost: number;
  highlight: number;
  ambient: number; // NEW
  radius: number;
  dropShadow: number;
  volumeShadow: number;
  debug: 'off' | 'on';
}

const DraggableWindow: React.FC<{
  id: string; title: string; isOpen: boolean; onClose: () => void;
  width?: string; children: React.ReactNode;
}> = ({ id, title, isOpen, onClose, width = '300px', children }) => {
  const dragControls = useDragControls();
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false} // Only listen on the handle
          dragMomentum={false} // Prevent drifting after release
          dragElastic={0} // Remove elastic band effect for tighter control
          
          initial={{ opacity: 0, y: 20, x: '-50%', left: '50%', top: '100px' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
          
          style={{
            position: 'absolute', 
            width, 
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(30px) saturate(150%)', 
            WebkitBackdropFilter: 'blur(30px) saturate(150%)',
            borderRadius: '16px', 
            boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 20px 50px -12px rgba(0,0,0,0.2)',
            zIndex: 100, 
            overflow: 'hidden',
          }}
        >
          {/* Header Handle */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            style={{
              height: '40px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '0 12px 0 16px', 
              borderBottom: '1px solid rgba(0,0,0,0.06)', 
              cursor: 'grab',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0))',
              touchAction: 'none', // Critical for touch drag
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#333', letterSpacing: '-0.01em', opacity: 0.8 }}>{title}</span>
            <button 
              onClick={onClose} 
              onPointerDown={(e) => e.stopPropagation()}
              style={{ 
                width: '20px', height: '20px', borderRadius: '50%', 
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#AEAEB2'
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          {/* Content */}
          <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MetaGlassApp = () => {
  const [glass, setGlass] = useState<GlassState>({
    bezel: 40, 
    intensity: 30, 
    chromaticDelta: 8, 
    frost: 0, 
    highlight: 0.6, 
    ambient: 0.5, 
    radius: 80, 
    dropShadow: 0.6,
    volumeShadow: 0.5,
    debug: 'off',
  });

  const [windows, setWindows] = useState([
    { id: 'controls', isOpen: true, title: 'Glass Properties', width: '300px' },
    { id: 'code', isOpen: false, title: 'Code I/O', width: '420px' },
    { id: 'console', isOpen: false, title: 'Console', width: '300px' },
  ]);

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, timestamp: new Date().toLocaleTimeString(), message: 'System initialized. Performance mode active.', type: 'system' }
  ]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => {
      const newLogs = [...prev, { id: Date.now(), timestamp: new Date().toLocaleTimeString(), message, type }];
      return newLogs.slice(-50);
    });
  };

  const toggleWindow = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isOpen: !w.isOpen } : w));
    const win = windows.find(w => w.id === id);
    if (win && !win.isOpen) addLog(`Process spawned: ${win.title}`, 'system');
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <StudioBackground />
      
      <LiquidWrapper>
         <GlassBubble {...glass} debug={glass.debug === 'on'} />
      </LiquidWrapper>

      {windows.map(w => (
        <DraggableWindow 
          key={w.id} 
          id={w.id} 
          title={w.title} 
          isOpen={w.isOpen} 
          onClose={() => toggleWindow(w.id)}
          width={w.width}
        >
           {w.id === 'controls' && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Section title="Material Physics">
                  <Slider label="Refraction" value={glass.intensity} min={0} max={100} onChange={v => setGlass(p => ({ ...p, intensity: v }))} />
                  <Slider label="Dispersion (RGB)" value={glass.chromaticDelta} min={0} max={30} onChange={v => setGlass(p => ({ ...p, chromaticDelta: v }))} />
                  <Slider label="Frost (Density)" value={glass.frost} min={0} max={20} onChange={v => setGlass(p => ({ ...p, frost: v }))} />
                </Section>
                
                <Section title="Light & Surface">
                  <Slider label="Specular (Rim)" value={glass.highlight} min={0} max={1} onChange={v => setGlass(p => ({ ...p, highlight: v }))} />
                  <Slider label="Ambient Glow" value={glass.ambient} min={0} max={1} onChange={v => setGlass(p => ({ ...p, ambient: v }))} />
                  <Slider label="Bezel Depth" value={glass.bezel} min={0} max={100} onChange={v => setGlass(p => ({ ...p, bezel: v }))} />
                </Section>

                <Section title="Shadows">
                  <Slider label="Drop Shadow" value={glass.dropShadow} min={0} max={1} onChange={v => setGlass(p => ({ ...p, dropShadow: v }))} />
                  <Slider label="Volume (Inner)" value={glass.volumeShadow} min={0} max={1} onChange={v => setGlass(p => ({ ...p, volumeShadow: v }))} />
                </Section>

                <Section title="Geometry">
                  <Slider label="Corner Radius" value={glass.radius} min={0} max={120} onChange={v => setGlass(p => ({ ...p, radius: v }))} />
                </Section>
             </div>
           )}
           {w.id === 'code' && <CodeIO />}
           {w.id === 'console' && <Console logs={logs} />}
        </DraggableWindow>
      ))}
      
      <div style={{ position: 'absolute', bottom: 40, width: '100%', display: 'flex', justifyContent: 'center', gap: '12px', pointerEvents: 'none' }}>
        {windows.map(w => (
          <motion.button 
            key={w.id}
            onClick={() => toggleWindow(w.id)} 
            style={{ 
              pointerEvents: 'auto', background: w.isOpen ? '#000' : '#fff', border: 'none', padding: '10px 20px', 
              borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600, cursor: 'pointer',
              color: w.isOpen ? '#fff' : '#333', fontSize: '12px', transition: 'color 0.2s, background-color 0.2s'
            }}
          >
            {w.title}
          </motion.button>
        ))}
      </div>
    </div>
  );
};