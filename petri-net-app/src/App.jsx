import React, { useState, useRef } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import ExecutionPanel from './components/ExecutionPanel';
import Place from './components/Place';
import Transition from './components/Transition';
import Arc from './components/Arc';
import Grid from './components/Grid';

function App() {
  const [elements, setElements] = useState({
    places: [],
    transitions: [],
    arcs: []
  });
  const [selectedElement, setSelectedElement] = useState(null);
  const [mode, setMode] = useState('select'); // select, place, transition, arc
  const [arcStart, setArcStart] = useState(null); // For arc creation
  const [tempArcEnd, setTempArcEnd] = useState(null); // For visual feedback during arc creation
  const stageRef = useRef(null);

  const stageWidth = 800;
  const stageHeight = 600;
  const gridSize = 20;

  // Function to snap position to grid
  const snapToGrid = (x, y) => {
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize
    };
  };

  // Function to add a new element to the canvas
  const addElement = (type, x, y) => {
    const snappedPos = snapToGrid(x, y);
    
    if (type === 'place') {
      const newPlace = {
        id: `place-${Date.now()}`,
        x: snappedPos.x,
        y: snappedPos.y,
        name: `P${elements.places.length + 1}`,
        tokens: 0
      };
      setElements(prev => ({
        ...prev,
        places: [...prev.places, newPlace]
      }));
    } else if (type === 'transition') {
      const newTransition = {
        id: `transition-${Date.now()}`,
        x: snappedPos.x,
        y: snappedPos.y,
        name: `T${elements.transitions.length + 1}`
      };
      setElements(prev => ({
        ...prev,
        transitions: [...prev.transitions, newTransition]
      }));
    }
  };

  // Function to handle stage click
  const handleStageClick = (e) => {
    // Get position relative to the stage
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    const x = pointerPosition.x;
    const y = pointerPosition.y;

    if (mode === 'place') {
      addElement('place', x, y);
    } else if (mode === 'transition') {
      addElement('transition', x, y);
    }
  };

  // Function to handle mouse move for arc creation visual feedback
  const handleMouseMove = (e) => {
    if (mode === 'arc' && arcStart) {
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      setTempArcEnd({
        x: pointerPosition.x,
        y: pointerPosition.y
      });
    }
  };

  // Function to handle element click for arc creation
  const handleElementClick = (element, elementType) => {
    if (mode === 'arc') {
      if (!arcStart) {
        // Start creating an arc
        setArcStart({ element, elementType });
        console.log(`Arc creation started from ${elementType} ${element.id}`);
      } else {
        // Complete the arc if valid connection
        const startType = arcStart.elementType;
        const endType = elementType;
        
        // Validate: arcs can only connect place->transition or transition->place
        if ((startType === 'place' && endType === 'transition') ||
            (startType === 'transition' && endType === 'place')) {
          
          const newArc = {
            id: `arc-${Date.now()}`,
            sourceId: arcStart.element.id,
            sourceType: startType,
            targetId: element.id,
            targetType: endType,
            weight: 1
          };
          
          setElements(prev => ({
            ...prev,
            arcs: [...prev.arcs, newArc]
          }));
          console.log(`Arc created from ${startType} to ${endType}`);
        } else {
          console.log(`Invalid arc connection: ${startType} to ${endType}`);
        }
        
        // Reset arc start and temp end
        setArcStart(null);
        setTempArcEnd(null);
      }
    } else if (mode === 'select') {
      // Select the element
      setSelectedElement(element);
    }
  };

  // Function to cancel arc creation
  const cancelArcCreation = () => {
    setArcStart(null);
    setTempArcEnd(null);
  };

  // Update mode handler to reset arc creation state
  const handleModeChange = (newMode) => {
    if (mode === 'arc' && newMode !== 'arc') {
      cancelArcCreation();
    }
    setMode(newMode);
  };

  return (
    <div className="flex flex-col h-screen">
      <Toolbar mode={mode} setMode={handleModeChange} />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Stage 
            ref={stageRef}
            width={stageWidth} 
            height={stageHeight} 
            onClick={handleStageClick}
            onMouseMove={handleMouseMove}
            className="canvas-container"
          >
            <Layer>
              {/* Grid lines */}
              <Grid width={stageWidth} height={stageHeight} gridSize={gridSize} />
              
              {/* Places */}
              {elements.places.map(place => (
                <Place
                  key={place.id}
                  place={place}
                  isSelected={selectedElement && selectedElement.id === place.id || 
                    (arcStart && arcStart.element.id === place.id)}
                  onClick={() => handleElementClick(place, 'place')}
                  onDragMove={(e) => {
                    const pos = snapToGrid(e.target.x(), e.target.y());
                    setElements(prev => ({
                      ...prev,
                      places: prev.places.map(p => 
                        p.id === place.id ? { ...p, x: pos.x, y: pos.y } : p
                      )
                    }));
                  }}
                />
              ))}
              
              {/* Transitions */}
              {elements.transitions.map(transition => (
                <Transition
                  key={transition.id}
                  transition={transition}
                  isSelected={selectedElement && selectedElement.id === transition.id || 
                    (arcStart && arcStart.element.id === transition.id)}
                  onClick={() => handleElementClick(transition, 'transition')}
                  onDragMove={(e) => {
                    const pos = snapToGrid(e.target.x(), e.target.y());
                    setElements(prev => ({
                      ...prev,
                      transitions: prev.transitions.map(t => 
                        t.id === transition.id ? { ...t, x: pos.x, y: pos.y } : t
                      )
                    }));
                  }}
                />
              ))}
              
              {/* Arcs */}
              {elements.arcs.map(arc => (
                <Arc
                  key={arc.id}
                  arc={arc}
                  places={elements.places}
                  transitions={elements.transitions}
                  isSelected={selectedElement && selectedElement.id === arc.id}
                  onClick={() => setSelectedElement(arc)}
                />
              ))}
              
              {/* Temporary arc during creation */}
              {arcStart && tempArcEnd && (
                <Line
                  points={[
                    arcStart.element.x,
                    arcStart.element.y,
                    tempArcEnd.x,
                    tempArcEnd.y
                  ]}
                  stroke="gray"
                  strokeWidth={2}
                  dash={[5, 5]}
                />
              )}
            </Layer>
          </Stage>
        </div>
        
        <PropertiesPanel 
          selectedElement={selectedElement} 
          setElements={setElements} 
        />
      </div>
      
      <ExecutionPanel elements={elements} />
    </div>
  );
}

export default App;
