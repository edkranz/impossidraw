import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { FloorPlan } from '../types/Room';

// Type for wall segment in 3D representation
interface Wall3D {
  start: THREE.Vector3;
  end: THREE.Vector3;
  isPortal: boolean;
}

interface ThreeDBuilderProps {
  floorPlan: FloorPlan;
  isOpen: boolean;
  onClose: () => void;
}

const ThreeDBuilder: React.FC<ThreeDBuilderProps> = ({ floorPlan, isOpen, onClose }) => {
  // Calculate default wall height (75% of the smallest room dimension)
  const defaultWallHeight = useMemo(() => {
    if (floorPlan.rooms.length === 0) {
      return 2000; // Default if no rooms
    }
    
    // Find the smallest dimension of all rooms
    let smallestDimension = Number.MAX_VALUE;
    
    floorPlan.rooms.forEach(room => {
      const minDimension = Math.min(room.width, room.height);
      if (minDimension < smallestDimension) {
        smallestDimension = minDimension;
      }
    });
    
    // Return 75% of the smallest dimension, with a reasonable minimum
    return Math.max(1000, smallestDimension * 0.75);
  }, [floorPlan]);
  
  // Calculate default wall thickness
  const defaultWallThickness = useMemo(() => {
    if (floorPlan.rooms.length === 0) {
      return 100; // Default thickness
    }
    
    // Calculate average room dimensions
    let totalWidth = 0;
    let totalHeight = 0;
    
    floorPlan.rooms.forEach(room => {
      totalWidth += room.width;
      totalHeight += room.height;
    });
    
    const avgWidth = totalWidth / floorPlan.rooms.length;
    const avgHeight = totalHeight / floorPlan.rooms.length;
    
    // Reference size is 5000mm
    const referenceSize = 5000;
    const baseThickness = 100;
    
    // Scale factor based on average room size
    const avgSize = (avgWidth + avgHeight) / 2;
    const scaleFactor = avgSize / referenceSize;
    
    // Clamp thickness to reasonable values
    const thickness = baseThickness * scaleFactor;
    return Math.max(50, Math.min(200, thickness));
  }, [floorPlan]);
  
  const [wallHeight, setWallHeight] = useState<number>(defaultWallHeight);
  const [wallThickness, setWallThickness] = useState<number>(defaultWallThickness);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  
  // Update wall height and thickness when defaults change
  useEffect(() => {
    setWallHeight(defaultWallHeight);
    setWallThickness(defaultWallThickness);
  }, [defaultWallHeight, defaultWallThickness]);
  
  // Log the floorplan data to help debugging
  useEffect(() => {
    if (isOpen) {
      console.log('Floorplan data:', floorPlan);
    }
  }, [floorPlan, isOpen]);
  
  if (!isOpen) return null;
  
  const handleExport = () => {
    // The export function is called from inside the 3D scene
    const event = new CustomEvent('export-model');
    window.dispatchEvent(event);
  };
  
  return (
    <div className="three-d-builder-overlay three-d-builder">
      <div className="three-d-builder-container">
        <div className="three-d-builder-header">
          <h2>3D Floorplan Builder</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="three-d-builder-controls">
          <div className="three-d-builder-form-group slider-group">
            <label htmlFor="wall-height">Wall Height: {wallHeight}mm</label>
            <div className="slider-with-input">
              <input 
                type="range" 
                id="wall-height-slider"
                min="500" 
                max="5000"
                step="50"
                value={wallHeight} 
                onChange={(e) => setWallHeight(Number(e.target.value))}
                className="slider-input"
              />
              <input 
                type="number" 
                id="wall-height"
                value={wallHeight} 
                onChange={(e) => setWallHeight(Math.max(100, Number(e.target.value)))} 
                min="100" 
                max="10000"
                className="number-input"
              />
            </div>
          </div>
          
          <div className="three-d-builder-form-group slider-group">
            <label htmlFor="wall-thickness">Wall Thickness: {wallThickness}mm</label>
            <div className="slider-with-input">
              <input 
                type="range" 
                id="wall-thickness-slider"
                min="20" 
                max="300"
                step="5"
                value={wallThickness} 
                onChange={(e) => setWallThickness(Number(e.target.value))}
                className="slider-input"
              />
              <input 
                type="number" 
                id="wall-thickness"
                value={wallThickness} 
                onChange={(e) => setWallThickness(Math.max(20, Number(e.target.value)))} 
                min="20" 
                max="500"
                className="number-input"
              />
            </div>
          </div>
          
          <div className="three-d-builder-form-group checkbox-group">
            <div className="checkbox-option">
              <input 
                type="checkbox" 
                id="auto-rotate"
                checked={autoRotate} 
                onChange={(e) => setAutoRotate(e.target.checked)}
              />
              <label htmlFor="auto-rotate">Auto-Rotate</label>
            </div>
            
            <div className="checkbox-option">
              <input 
                type="checkbox" 
                id="wireframe"
                checked={wireframe} 
                onChange={(e) => setWireframe(e.target.checked)}
              />
              <label htmlFor="wireframe">Wireframe</label>
            </div>
          </div>
          
          <button className="export-button" onClick={handleExport}>
            Export GLB
          </button>
        </div>
        
        <div className="three-d-builder-canvas">
          <Canvas camera={{ position: [5000, 5000, 5000], far: 50000, near: 1 }}>
            <color attach="background" args={['#f0f0f0']} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[10000, 10000, 5000]} intensity={1} />
            <CameraControls autoRotate={autoRotate} />
            <Grid 
              args={[10000, 10000]} 
              cellSize={1000}
              cellThickness={1}
              cellColor="#6f6f6f"
              sectionColor="#9d4b4b"
            />
            <axesHelper args={[5000]} />
            <FloorPlanModel 
              floorPlan={floorPlan} 
              wallHeight={wallHeight} 
              wallThickness={wallThickness}
              wireframe={wireframe}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
};

// Component to handle camera positioning
const CameraControls: React.FC<{ autoRotate: boolean }> = ({ autoRotate }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);
  
  return (
    <OrbitControls 
      ref={controlsRef}
      makeDefault
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
    />
  );
};

// Component to create the 3D model of the floor plan
const FloorPlanModel: React.FC<{ 
  floorPlan: FloorPlan; 
  wallHeight: number;
  wallThickness: number;
  wireframe: boolean;
}> = ({ floorPlan, wallHeight, wallThickness, wireframe }) => {
  const sceneRef = useRef<THREE.Group>(null);
  
  // Handle model export
  React.useEffect(() => {
    const handleExport = () => {
      if (!sceneRef.current) return;
      
      const exporter = new GLTFExporter();
      exporter.parse(
        sceneRef.current,
        (gltf) => {
          const blob = new Blob([gltf as BlobPart], { type: 'application/octet-stream' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `floorplan_3d_${new Date().toISOString().slice(0, 10)}.glb`;
          link.click();
        },
        (error) => {
          console.error('An error happened during export:', error);
        },
        { binary: true } // Export as binary GLB
      );
    };
    
    window.addEventListener('export-model', handleExport);
    return () => {
      window.removeEventListener('export-model', handleExport);
    };
  }, []);
  
  // Log when the model is rendered
  useEffect(() => {
    console.log('Rendering 3D model with rooms:', floorPlan.rooms.length);
  }, [floorPlan, wallHeight, wallThickness, wireframe]);
  
  return (
    <group ref={sceneRef}>
      {/* No rooms message */}
      {floorPlan.rooms.length === 0 && (
        <group position={[0, 1000, 0]}>
          <mesh>
            <boxGeometry args={[1000, 100, 1000]} />
            <meshStandardMaterial color="#ff0000" wireframe={wireframe} />
          </mesh>
        </group>
      )}
      
      {/* Render each room */}
      {floorPlan.rooms.map((room) => (
        <group key={room.id} position={[0, 0, 0]}>
          {/* Room floor */}
          <mesh 
            position={[room.x + room.width / 2, 0, room.y + room.height / 2]} 
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[room.width, room.height]} />
            <meshStandardMaterial color="#ffffff" wireframe={wireframe} />
          </mesh>
          
          {/* Room perimeter walls - always render these */}
          {/* Front wall */}
          <mesh 
            position={[room.x + room.width / 2, wallHeight / 2, room.y]} 
            rotation={[0, 0, 0]}
          >
            <boxGeometry args={[room.width, wallHeight, wallThickness]} />
            <meshStandardMaterial color="#ffffff" wireframe={wireframe} />
          </mesh>
          
          {/* Back wall */}
          <mesh 
            position={[room.x + room.width / 2, wallHeight / 2, room.y + room.height]} 
            rotation={[0, 0, 0]}
          >
            <boxGeometry args={[room.width, wallHeight, wallThickness]} />
            <meshStandardMaterial color="#ffffff" wireframe={wireframe} />
          </mesh>
          
          {/* Left wall */}
          <mesh 
            position={[room.x, wallHeight / 2, room.y + room.height / 2]} 
            rotation={[0, Math.PI / 2, 0]}
          >
            <boxGeometry args={[room.height, wallHeight, wallThickness]} />
            <meshStandardMaterial color="#ffffff" wireframe={wireframe} />
          </mesh>
          
          {/* Right wall */}
          <mesh 
            position={[room.x + room.width, wallHeight / 2, room.y + room.height / 2]} 
            rotation={[0, Math.PI / 2, 0]}
          >
            <boxGeometry args={[room.height, wallHeight, wallThickness]} />
            <meshStandardMaterial color="#ffffff" wireframe={wireframe} />
          </mesh>
          
          {/* Internal walls (if any) */}
          {room.walls.map((wall, wallIndex) => {
            // Check if this is a portal
            const isPortal = room.portalIds.includes(wall.id);
            
            // Get vertices for this wall
            const vertexIDs = wall.vertexIds;
            if (vertexIDs.length !== 2) return null;
            
            const v1 = room.vertices.find(v => v.id === vertexIDs[0]);
            const v2 = room.vertices.find(v => v.id === vertexIDs[1]);
            
            if (!v1 || !v2) return null;
            
            // Calculate wall dimensions and position
            const start = new THREE.Vector3(v1.x, 0, v1.y);
            const end = new THREE.Vector3(v2.x, 0, v2.y);
            
            // Direction vector from start to end
            const dir = new THREE.Vector3().subVectors(end, start);
            const length = dir.length();
            
            // Skip very short walls
            if (length < 10) return null;
            
            // Midpoint for wall position (relative to room)
            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            
            return (
              <group 
                key={`${room.id}-wall-${wallIndex}`} 
                position={[room.x + mid.x, wallHeight / 2, room.y + mid.z]}
              >
                <mesh rotation={[0, Math.atan2(dir.x, dir.z), 0]}>
                  <boxGeometry args={[wallThickness, wallHeight, length]} />
                  <meshStandardMaterial 
                    color={isPortal ? '#ff0000' : '#ffffff'} 
                    wireframe={wireframe}
                  />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
};

export default ThreeDBuilder; 