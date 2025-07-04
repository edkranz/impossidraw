import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import { FloorPlan, Portal } from '../types/Room';

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

interface FloorplanCenter {
  x: number;
  y: number;
  z: number;
  size: number;
}

// Types for portal schema export
interface PortalCorner {
  x: number;
  y: number;
  z: number;
}

interface PortalSchemaData {
  portalId: string;
  roomId: string;
  roomName: string;
  connectedRoomId: string | null;
  connectedPortalId: string | null;
  corners: PortalCorner[];
}

// Helper function to collect portal schema data
const collectPortalSchema = (floorPlan: FloorPlan, wallHeight: number): PortalSchemaData[] => {
  const portalData: PortalSchemaData[] = [];
  
  floorPlan.rooms.forEach((room) => {
    // Find portals in this room - check for walls with isPortal property
    const portals = room.walls.filter(wall => 'isPortal' in wall && (wall as Portal).isPortal === true);
    
    portals.forEach((wall) => {
      // Get vertices for this portal
      const vertexIDs = wall.vertexIds;
      if (vertexIDs.length !== 2) return;
      
      const v1 = room.vertices.find(v => v.id === vertexIDs[0]);
      const v2 = room.vertices.find(v => v.id === vertexIDs[1]);
      
      if (!v1 || !v2) return;
      
      // Calculate portal corners in world coordinates
      const start = new THREE.Vector3(room.x + v1.x, 0, room.y + v1.y);
      const end = new THREE.Vector3(room.x + v2.x, 0, room.y + v2.y);
      
      // Create corner coordinates (4 corners: bottom-start, bottom-end, top-start, top-end)
      const corners: PortalCorner[] = [
        { x: start.x, y: 0, z: start.z }, // Bottom start
        { x: end.x, y: 0, z: end.z },     // Bottom end
        { x: start.x, y: wallHeight, z: start.z }, // Top start
        { x: end.x, y: wallHeight, z: end.z },     // Top end
      ];
      
      // Get connection info if it's a portal
      const portal = wall as Portal; // Type assertion for portal properties
      
      portalData.push({
        portalId: wall.id,
        roomId: room.id,
        roomName: room.name,
        connectedRoomId: portal.connectedRoomId || null,
        connectedPortalId: portal.connectedPortalId || null,
        corners: corners
      });
    });
  });
  
  return portalData;
};

// Helper function to format portal schema as text
const formatPortalSchemaAsText = (portalData: PortalSchemaData[]): string => {
  let text = `Portal Schema Export\n`;
  text += `Generated: ${new Date().toISOString()}\n`;
  text += `Total Portals: ${portalData.length}\n\n`;
  text += `Coordinates are in millimeters (mm)\n`;
  text += `Format: X, Y, Z\n\n`;
  
  portalData.forEach((portal, index) => {
    text += `Portal ${index + 1}:\n`;
    text += `  ID: ${portal.portalId}\n`;
    text += `  Room: ${portal.roomName} (${portal.roomId})\n`;
    text += `  Connected to Room: ${portal.connectedRoomId || 'None'}\n`;
    text += `  Connected to Portal: ${portal.connectedPortalId || 'None'}\n`;
    text += `  Corners:\n`;
    portal.corners.forEach((corner, cornerIndex) => {
      const cornerName = cornerIndex === 0 ? 'Bottom Start' : 
                        cornerIndex === 1 ? 'Bottom End' : 
                        cornerIndex === 2 ? 'Top Start' : 'Top End';
      text += `    ${cornerName}: ${corner.x.toFixed(2)}, ${corner.y.toFixed(2)}, ${corner.z.toFixed(2)}\n`;
    });
    text += `\n`;
  });
  
  return text;
};

const ThreeDBuilder: React.FC<ThreeDBuilderProps> = ({ floorPlan, isOpen, onClose }) => {
  // Calculate default wall height (75% of the smallest room dimension)
  const defaultWallHeight = useMemo(() => {
    return 2000;
  }, [floorPlan]);
  
  // Calculate default wall thickness
  const defaultWallThickness = useMemo(() => {
    if (floorPlan.rooms.length === 0) {
      return 20; // Default thickness
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
  
  // Calculate center point of all rooms
  const floorplanCenter = useMemo<FloorplanCenter>(() => {
    if (floorPlan.rooms.length === 0) {
      return { x: 0, y: 0, z: 0, size: 5000 };
    }
    
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    floorPlan.rooms.forEach(room => {
      // Calculate room boundaries
      const roomMinX = room.x;
      const roomMaxX = room.x + room.width;
      const roomMinY = room.y;
      const roomMaxY = room.y + room.height;
      
      // Update overall boundaries
      minX = Math.min(minX, roomMinX);
      maxX = Math.max(maxX, roomMaxX);
      minY = Math.min(minY, roomMinY);
      maxY = Math.max(maxY, roomMaxY);
    });
    
    // Calculate center point
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Calculate model size for camera positioning
    const modelWidth = maxX - minX;
    const modelHeight = maxY - minY;
    const modelSize = Math.max(modelWidth, modelHeight, 1000); // Minimum size to prevent issues with empty scenes
    
    return { 
      x: centerX, 
      y: 0, 
      z: centerY,
      size: modelSize 
    };
  }, [floorPlan]);
  
  const [wallHeight, setWallHeight] = useState<number>(defaultWallHeight);
  const [wallThickness, setWallThickness] = useState<number>(defaultWallThickness);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  
  // Render control states - all enabled by default
  const [showWalls, setShowWalls] = useState<boolean>(true);
  const [showFloors, setShowFloors] = useState<boolean>(true);
  const [showPortals, setShowPortals] = useState<boolean>(true);
  const [showPortalMarkers, setShowPortalMarkers] = useState<boolean>(true);
  
  // Calculate camera position based on model size
  const cameraPosition = useMemo<[number, number, number]>(() => {
    const distance = floorplanCenter.size * 1.5; // Position camera 1.5x the model size away
    return [
      floorplanCenter.x + distance,
      distance,
      floorplanCenter.z + distance
    ];
  }, [floorplanCenter]);
  
  // Update wall height and thickness when defaults change
  useEffect(() => {
    setWallHeight(defaultWallHeight);
    setWallThickness(defaultWallThickness);
  }, [defaultWallHeight, defaultWallThickness]);
  
  // Log the floorplan data to help debugging
  useEffect(() => {
    if (isOpen) {
      console.log('Floorplan data:', floorPlan);
      console.log('Floorplan center:', floorplanCenter);
      console.log('Camera position:', cameraPosition);
    }
  }, [floorPlan, isOpen, floorplanCenter, cameraPosition]);
  
  if (!isOpen) return null;
  
  const handleExport = (format: 'glb' | 'obj') => {
    // The export function is called from inside the 3D scene
    const event = new CustomEvent('export-model', { detail: { format } });
    window.dispatchEvent(event);
  };

  const handlePortalSchemaExport = () => {
    // Collect all portal data with corner coordinates
    const portalSchema = collectPortalSchema(floorPlan, wallHeight);
    
    // Create text content
    const textContent = formatPortalSchemaAsText(portalSchema);
    
    // Create and download file
    const blob = new Blob([textContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `portal_schema_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
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
          
          <div className="three-d-builder-form-group checkbox-group">
            <label>Render Elements:</label>
            <div className="checkbox-option">
              <input 
                type="checkbox" 
                id="show-walls"
                checked={showWalls} 
                onChange={(e) => setShowWalls(e.target.checked)}
              />
              <label htmlFor="show-walls">Walls</label>
            </div>
            
            <div className="checkbox-option">
              <input 
                type="checkbox" 
                id="show-floors"
                checked={showFloors} 
                onChange={(e) => setShowFloors(e.target.checked)}
              />
              <label htmlFor="show-floors">Floors</label>
            </div>
            
            <div className="checkbox-option">
              <input 
                type="checkbox" 
                id="show-portals"
                checked={showPortals} 
                onChange={(e) => setShowPortals(e.target.checked)}
              />
              <label htmlFor="show-portals">Portals</label>
            </div>
            
            <div className="checkbox-option">
              <input 
                type="checkbox" 
                id="show-portal-markers"
                checked={showPortalMarkers} 
                onChange={(e) => setShowPortalMarkers(e.target.checked)}
              />
              <label htmlFor="show-portal-markers">Portal Markers</label>
            </div>
          </div>
          
          <div className="export-buttons">
            <button className="export-button" onClick={() => handleExport('glb')}>
              Export GLB
            </button>
            <button className="export-button" onClick={() => handleExport('obj')}>
              Export OBJ
            </button>
            <button className="export-button" onClick={handlePortalSchemaExport}>
              Export Portal Schema
            </button>
          </div>
        </div>
        
        <div className="three-d-builder-canvas">
          <Canvas 
            camera={{ position: cameraPosition, far: 100000, near: 1 }}
            shadows
          >
            <color attach="background" args={['#1a1a1a']} />
            
            {/* Enhanced lighting setup for better visibility */}
            <ambientLight intensity={0.4} />
            
            {/* Main directional light from top-right */}
            <directionalLight 
              position={[floorplanCenter.x + floorplanCenter.size, floorplanCenter.size * 1.5, floorplanCenter.z + floorplanCenter.size]} 
              intensity={1.2}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-far={floorplanCenter.size * 3}
              shadow-camera-left={-floorplanCenter.size}
              shadow-camera-right={floorplanCenter.size}
              shadow-camera-top={floorplanCenter.size}
              shadow-camera-bottom={-floorplanCenter.size}
            />
            
            {/* Secondary directional light from opposite side for fill lighting */}
            <directionalLight 
              position={[floorplanCenter.x - floorplanCenter.size * 0.5, floorplanCenter.size, floorplanCenter.z - floorplanCenter.size * 0.5]} 
              intensity={0.6}
              color="#ffffff"
            />
            
            {/* Additional light from the front to illuminate wall details */}
            <directionalLight 
              position={[floorplanCenter.x, floorplanCenter.size * 0.8, floorplanCenter.z + floorplanCenter.size * 1.2]} 
              intensity={0.8}
              color="#f0f0f0"
            />
            
            {/* Point light for additional detail illumination */}
            <pointLight 
              position={[floorplanCenter.x, floorplanCenter.size * 0.5, floorplanCenter.z]} 
              intensity={0.5}
              distance={floorplanCenter.size * 2}
              decay={2}
            />
            
            <CameraControls 
              autoRotate={autoRotate} 
              center={[floorplanCenter.x, floorplanCenter.y, floorplanCenter.z]} 
            />
            <Grid 
              args={[floorplanCenter.size * 2, floorplanCenter.size * 2]} 
              cellSize={1000}
              cellThickness={1}
              cellColor="#6f6f6f"
              sectionColor="#9d4b4b"
              position={[floorplanCenter.x, 0, floorplanCenter.z]}
            />
            <axesHelper args={[5000]} position={[floorplanCenter.x, 0, floorplanCenter.z]} />
            <FloorPlanModel 
              floorPlan={floorPlan} 
              wallHeight={wallHeight} 
              wallThickness={wallThickness}
              wireframe={wireframe}
              floorplanCenter={floorplanCenter}
              showWalls={showWalls}
              showFloors={showFloors}
              showPortals={showPortals}
              showPortalMarkers={showPortalMarkers}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
};

// Component to handle camera positioning
const CameraControls: React.FC<{ 
  autoRotate: boolean;
  center: [number, number, number];
}> = ({ autoRotate, center }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  // Update camera target to look at the center of the model
  useEffect(() => {
    camera.lookAt(center[0], center[1], center[2]);
    
    if (controlsRef.current) {
      controlsRef.current.target.set(center[0], center[1], center[2]);
      controlsRef.current.update();
    }
  }, [camera, center]);
  
  // Update auto-rotate setting
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
      target={new THREE.Vector3(center[0], center[1], center[2])}
    />
  );
};

// Component to create the 3D model of the floor plan
const FloorPlanModel: React.FC<{ 
  floorPlan: FloorPlan; 
  wallHeight: number;
  wallThickness: number;
  wireframe: boolean;
  floorplanCenter: FloorplanCenter;
  showWalls: boolean;
  showFloors: boolean;
  showPortals: boolean;
  showPortalMarkers: boolean;
}> = ({ floorPlan, wallHeight, wallThickness, wireframe, floorplanCenter, showWalls, showFloors, showPortals, showPortalMarkers }) => {
  const sceneRef = useRef<THREE.Group>(null);
  
  // Handle model export
  React.useEffect(() => {
    const handleExport = (event: Event) => {
      if (!sceneRef.current) return;
      
      // Get export format from event detail
      const customEvent = event as CustomEvent;
      const format = customEvent.detail?.format || 'glb';
      
      // Create a scaled copy of the scene to convert mm to m for export
      const scaleFactor = 0.001; // Convert mm to m (1/1000)
      const exportGroup = new THREE.Group();
      const sceneClone = sceneRef.current.clone();
      sceneClone.scale.set(scaleFactor, scaleFactor, scaleFactor);
      sceneClone.updateMatrixWorld( true )
      exportGroup.add(sceneClone);
      
      if (format === 'glb') {
        // Export as GLB
        const exporter = new GLTFExporter();
        exporter.parse(
          exportGroup,
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
      } else if (format === 'obj') {
        // Export as OBJ
        const exporter = new OBJExporter();
        const result = exporter.parse(exportGroup);
        const blob = new Blob([result], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `floorplan_3d_${new Date().toISOString().slice(0, 10)}.obj`;
        link.click();
      }
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
          {showFloors && (
            <mesh 
              position={[room.x + room.width / 2, 0, room.y + room.height / 2]} 
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[room.width, room.height]} />
              <meshStandardMaterial 
                color={wireframe ? "#ffffff" : "#f5f5f5"} 
                wireframe={wireframe}
                roughness={0.8}
                metalness={0.1}
              />
            </mesh>
          )}
          
          {/* Room perimeter walls - always render these */}
          {/* Front wall */}
          {showWalls && (
            <mesh 
              position={[room.x + room.width / 2, wallHeight / 2, room.y]} 
              rotation={[0, 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[room.width, wallHeight, wallThickness]} />
              <meshStandardMaterial 
                color={wireframe ? "#ffffff" : "#e8e8e8"} 
                wireframe={wireframe}
                roughness={0.7}
                metalness={0.0}
              />
            </mesh>
          )}
          
          {/* Back wall */}
          {showWalls && (
            <mesh 
              position={[room.x + room.width / 2, wallHeight / 2, room.y + room.height]} 
              rotation={[0, 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[room.width, wallHeight, wallThickness]} />
              <meshStandardMaterial 
                color={wireframe ? "#ffffff" : "#e8e8e8"} 
                wireframe={wireframe}
                roughness={0.7}
                metalness={0.0}
              />
            </mesh>
          )}
          
          {/* Left wall */}
          {showWalls && (
            <mesh 
              position={[room.x, wallHeight / 2, room.y + room.height / 2]} 
              rotation={[0, Math.PI / 2, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[room.height, wallHeight, wallThickness]} />
              <meshStandardMaterial 
                color={wireframe ? "#ffffff" : "#e8e8e8"} 
                wireframe={wireframe}
                roughness={0.7}
                metalness={0.0}
              />
            </mesh>
          )}
          
          {/* Right wall */}
          {showWalls && (
            <mesh 
              position={[room.x + room.width, wallHeight / 2, room.y + room.height / 2]} 
              rotation={[0, Math.PI / 2, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[room.height, wallHeight, wallThickness]} />
              <meshStandardMaterial 
                color={wireframe ? "#ffffff" : "#e8e8e8"} 
                wireframe={wireframe}
                roughness={0.7}
                metalness={0.0}
              />
            </mesh>
          )}
          
          {/* Internal walls (if any) */}
          {room.walls.map((wall, wallIndex) => {
            // Check if this is a portal - same logic as in FloorPlanCanvas
            const isPortal = 'isPortal' in wall && (wall as Portal).isPortal === true;
            
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
              <React.Fragment key={`${room.id}-wall-${wallIndex}`}>
                {/* Render wall/portal based on type and settings */}
                {((isPortal && showPortals) || (!isPortal && showWalls)) && (
                  <mesh 
                    position={[room.x + mid.x, wallHeight / 2, room.y + mid.z]}
                    rotation={[0, Math.atan2(dir.x, dir.z), 0]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[wallThickness, wallHeight, length]} />
                    <meshStandardMaterial 
                      color={isPortal ? '#ff6b6b' : (wireframe ? "#ffffff" : "#e8e8e8")} 
                      wireframe={wireframe}
                      roughness={0.7}
                      metalness={0.0}
                      emissive={isPortal ? "#ff2222" : "#000000"}
                      emissiveIntensity={isPortal ? 0.2 : 0}
                    />
                  </mesh>
                )}
                
                {/* Add corner indicators for portals */}
                {showPortalMarkers && isPortal && (
                  <>
                    {/* Corner indicator at start vertex (bottom) */}
                    <mesh 
                      position={[room.x + start.x, wallThickness / 2, room.y + start.z]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[wallThickness * 2, wallThickness, wallThickness * 2]} />
                      <meshStandardMaterial 
                        color="#ffff00" 
                        wireframe={wireframe}
                        emissive="#ffaa00"
                        emissiveIntensity={0.3}
                      />
                    </mesh>
                    
                    {/* Corner indicator at end vertex (bottom) */}
                    <mesh 
                      position={[room.x + end.x, wallThickness / 2, room.y + end.z]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[wallThickness * 2, wallThickness, wallThickness * 2]} />
                      <meshStandardMaterial 
                        color="#ffff00" 
                        wireframe={wireframe}
                        emissive="#ffaa00"
                        emissiveIntensity={0.3}
                      />
                    </mesh>
                    
                    {/* Corner indicator at start vertex (top) */}
                    <mesh 
                      position={[room.x + start.x, wallHeight - wallThickness / 2, room.y + start.z]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[wallThickness * 2, wallThickness, wallThickness * 2]} />
                      <meshStandardMaterial 
                        color="#ffff00" 
                        wireframe={wireframe}
                        emissive="#ffaa00"
                        emissiveIntensity={0.3}
                      />
                    </mesh>
                    
                    {/* Corner indicator at end vertex (top) */}
                    <mesh 
                      position={[room.x + end.x, wallHeight - wallThickness / 2, room.y + end.z]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[wallThickness * 2, wallThickness, wallThickness * 2]} />
                      <meshStandardMaterial 
                        color="#ffff00" 
                        wireframe={wireframe}
                        emissive="#ffaa00"
                        emissiveIntensity={0.3}
                      />
                    </mesh>
                  </>
                )}
              </React.Fragment>
            );
          })}
        </group>
      ))}
    </group>
  );
};

export default ThreeDBuilder; 