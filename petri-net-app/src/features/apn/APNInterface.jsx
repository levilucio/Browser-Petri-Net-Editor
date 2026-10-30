import React from 'react';
import { Layer, Group, Rect, Text, Arrow } from 'react-konva';

/** CO-OPN class boundary, black methods, white gates and dashed synchronizations.
 * Method-to-transition synchronization is by matching names, without an edge.
 */
export default function APNInterface({ layout }) {
  if (!layout) return null;
  const { frame, methods, gates, connections, title } = layout;
  return <Layer name="apn-interface">
    <Rect name="apn-boundary" {...frame} stroke="black" strokeWidth={1.5} cornerRadius={8} listening={false} />
    <Text text={title} x={frame.x + 14} y={frame.y + 12} width={frame.width - 28} fontSize={13} fontStyle="bold" fill="#222" listening={false} />
    {connections.map(edge => <Group key={edge.id} name="gate-synchronization" listening={false}>
      <Arrow points={edge.points} stroke="#333" fill="#333" strokeWidth={1.4} dash={[7, 5]} pointerLength={8} pointerWidth={7} />
      <Text text={edge.label} x={edge.labelX} y={edge.labelY} width={edge.labelWidth} fontSize={11} fill="#333" wrap="word" />
    </Group>)}
    {methods.map(port => <Group key={port.name} name="method-port" portName={port.name} onClick={e => { e.cancelBubble = true; }} onTap={e => { e.cancelBubble = true; }}>
      <Rect x={port.x - 20} y={port.y - 7} width={40} height={14} fill="black" stroke="black" strokeWidth={1.5} />
      <Text text={port.label} x={port.x - 80} y={port.y + 16} width={160} align="center" fontSize={13} fill="black" />
    </Group>)}
    {gates.map(port => <Group key={port.name} name="gate-port" portName={port.name} onClick={e => { e.cancelBubble = true; }} onTap={e => { e.cancelBubble = true; }}>
      <Rect x={port.x - 7} y={port.y - 18} width={14} height={36} fill="white" stroke="black" strokeWidth={1.5} />
      <Text text={port.label} x={port.x + 16} y={port.y - 7} width={190} fontSize={13} fill="black" wrap="word" />
    </Group>)}
  </Layer>;
}
