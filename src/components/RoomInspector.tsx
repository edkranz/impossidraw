import React, { useState, useEffect } from 'react';
import { Room as RoomType } from '../types/Room';
import './RoomInspector.css';

interface RoomInspectorProps {
  selectedRoom: RoomType | null;
  onUpdateRoom: (updatedRoom: RoomType) => void;
  isVisible: boolean;
  toggleVisibility: () => void;
}

const RoomInspector: React.FC<RoomInspectorProps> = ({ 
  selectedRoom, 
  onUpdateRoom, 
  isVisible,
  toggleVisibility 
}) => {
  const [roomName, setRoomName] = useState<string>('');
  const [roomColor, setRoomColor] = useState<string>('');

  // Update local state when selected room changes
  useEffect(() => {
    if (selectedRoom) {
      setRoomName(selectedRoom.name);
      // Convert RGBA to HEX for the color input
      setRoomColor(rgbaToHex(selectedRoom.color));
    }
  }, [selectedRoom]);

  // Update the room when user changes a value
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomName(e.target.value);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomColor(e.target.value);
  };

  const handleNameBlur = () => {
    if (selectedRoom && roomName !== selectedRoom.name) {
      onUpdateRoom({
        ...selectedRoom,
        name: roomName
      });
    }
  };

  const handleColorBlur = () => {
    if (selectedRoom && roomColor) {
      const rgbaColor = hexToRgba(roomColor, 0.2); // Keep the same alpha value
      onUpdateRoom({
        ...selectedRoom,
        color: rgbaColor
      });
    }
  };

  // Helper function to convert RGBA to HEX
  const rgbaToHex = (rgba: string): string => {
    // Extract RGB values from the RGBA string
    const rgbaMatch = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
    if (!rgbaMatch) return '#ffffff';
    
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    
    // Convert to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Helper function to convert HEX to RGBA
  const hexToRgba = (hex: string, alpha: number): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Return as RGBA
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  if (!selectedRoom) {
    return (
      <div className={`room-inspector ${isVisible ? '' : 'hidden'}`}>
        <button className="inspector-close-button" onClick={toggleVisibility}>
          ×
        </button>
        <h2>Room Inspector</h2>
        <p>Select a room to edit its properties</p>
      </div>
    );
  }

  // Convert dimensions to meters for display
  const widthInMeters = (selectedRoom.width / 1000).toFixed(2);
  const heightInMeters = (selectedRoom.height / 1000).toFixed(2);

  return (
    <div className={`room-inspector ${isVisible ? '' : 'hidden'}`}>
      <button className="inspector-close-button" onClick={toggleVisibility}>
        ×
      </button>
      <h2>Room Inspector</h2>
      
      <div className="inspector-field">
        <label htmlFor="room-name">Name</label>
        <input 
          id="room-name" 
          type="text" 
          value={roomName} 
          onChange={handleNameChange} 
          onBlur={handleNameBlur}
        />
      </div>
      
      <div className="inspector-field">
        <label htmlFor="room-color">Color</label>
        <div className="color-picker-container">
          <input 
            id="room-color" 
            type="color" 
            value={roomColor} 
            onChange={handleColorChange} 
            onBlur={handleColorBlur}
          />
          <div className="color-preview" style={{ backgroundColor: roomColor }}></div>
        </div>
      </div>
      
      <div className="inspector-field">
        <label>Dimensions</label>
        <div className="dimensions-display">
          {widthInMeters}m × {heightInMeters}m
        </div>
      </div>
      
      <div className="inspector-field">
        <label>Grid Position</label>
        <div className="grid-position-display">
          Cell: {selectedRoom.gridX},{selectedRoom.gridY}
        </div>
      </div>
      
      <div className="inspector-field">
        <label>Portals</label>
        <div className="portals-display">
          {selectedRoom.portals.length > 0 ? (
            <ul className="portal-list">
              {selectedRoom.portals.map(portal => (
                <li key={portal.id} className="portal-item">
                  {portal.wallPosition} wall ({(portal.position * 100).toFixed(0)}%)
                  {portal.connectedRoomId ? ' - Connected' : ' - Unconnected'}
                </li>
              ))}
            </ul>
          ) : (
            <p>No portals</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomInspector; 