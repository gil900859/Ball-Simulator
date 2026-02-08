
export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  pulseScale: number; // Current expansion scale [1.0 to 2.0]
  color: string;
  frequency: number;
  hue: number;
  count: number; // Number of original balls in this clump
  isClone: boolean; // Only clones can clump
  spawnTime: number; // Used for the 0.2s delay
  timeAtEdge: number; // Time in ms spent within 1px of the boundary
}

export interface SimulationConfig {
  gravity: number;
  friction: number;
  ballCount: number;
  ballSize: number;
  boundaryRadius: number;
  rodGap: number; // For horizontal mode
  playbackSpeed: number;
  trailLength: number;
  pulseIntensity: number; // How much balls/container grow on bounce
  mode: 'circular' | 'horizontal';
  // Advanced features
  ballSizeMultiplier: number; // 1.0 = neutral
  containerSizeMultiplier: number;
  cloneOnBounce: boolean;
  ballCollisions: boolean;
  clumpingEnabled: boolean;
}

export interface AIPattern {
  name: string;
  description: string;
  velocities: { vx: number; vy: number; freq: number }[];
  accentColor: string;
}
