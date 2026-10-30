import React from 'react';
import { render, screen } from '@testing-library/react';
import APNInterface from '../../features/apn/APNInterface';
import { apnInterfaceLayout } from '../../features/apn/interface-layout';
import { methodGateExamples, createMethodGateExample } from '../../satel/examples/methods-gates/editor';
import { semanticFingerprint } from '../../domain/apn/SemanticNet';
import { exportToPNML, importFromPNML } from '../../utils/python/index';

jest.mock('react-konva',()=>({
  Layer:({children,name})=><div data-testid={name}>{children}</div>,
  Group:({children,name,portName})=><div data-testid={name} data-port={portName}>{children}</div>,
  Rect:({name,fill,x,y,width,height})=><div data-testid={name||'rectangle'} data-fill={fill} data-box={JSON.stringify([x,y,width,height])}/>,
  Text:({text})=><span>{text}</span>,
  Arrow:({points,dash})=><div data-testid="sync-arrow" data-points={JSON.stringify(points)} data-dash={JSON.stringify(dash)}/>,
}));

test('all converted examples have an enclosing boundary and declared ports without changing semantics',()=>{
  for(const {filename} of methodGateExamples){
    const net=createMethodGateExample(filename),before=semanticFingerprint(net),layout=apnInterfaceLayout(net),f=layout.frame;
    expect(semanticFingerprint(net)).toBe(before);
    expect(layout.methods).toHaveLength(new Set(net.transitions.map(t=>t.method.name)).size);
    expect(layout.gates).toHaveLength(net.gates.length);
    expect(layout.connections).toHaveLength(net.transitions.reduce((n,t)=>n+t.gates.length,0));
    for(const node of [...net.places,...net.transitions]){
      expect(node.x-30).toBeGreaterThan(f.x);expect(node.y-30).toBeGreaterThan(f.y);
      expect(node.x+30).toBeLessThan(f.x+f.width);expect(node.y+45).toBeLessThan(f.y+f.height);
    }
    for(const p of layout.methods)expect(p.y).toBe(f.y+f.height);
    for(const p of layout.gates)expect(p.x).toBe(f.x+f.width);
    for(const edge of layout.connections){expect(edge.points.every(Number.isFinite)).toBe(true);expect(layout.gates.some(g=>g.name===edge.gate)).toBe(true);}
  }
});

test('ports are black methods and white gates; only gate synchronizations get arrows',()=>{
  const net=createMethodGateExample('gates-oracle-account-reference'),layout=apnInterfaceLayout(net);
  render(<APNInterface layout={layout}/>);
  expect(screen.getByTestId('apn-boundary')).toBeDefined();
  expect(screen.getAllByTestId('method-port')).toHaveLength(4); // two withdraw rules share a method
  expect(screen.getAllByTestId('gate-port')).toHaveLength(3);
  for(const p of screen.getAllByTestId('method-port'))expect(p.querySelector('[data-fill]')).toHaveAttribute('data-fill','black');
  for(const p of screen.getAllByTestId('gate-port'))expect(p.querySelector('[data-fill]')).toHaveAttribute('data-fill','white');
  expect(screen.getAllByTestId('sync-arrow')).toHaveLength(layout.connections.length);
  for(const edge of screen.getAllByTestId('sync-arrow'))expect(edge).toHaveAttribute('data-dash','[7,5]');
  expect(screen.getByText('withdraw(n)')).toBeDefined();
});

test('moving a transition updates the boundary and its gate edges',()=>{
  const net=createMethodGateExample('gates-oracle-account-reference');
  net.transitions[0].x=1800;net.transitions[0].y=1400;
  const layout=apnInterfaceLayout(net),edge=layout.connections.find(e=>e.transitionId===net.transitions[0].id);
  expect(edge.points[0]).toBeGreaterThanOrEqual(1800);
  expect(Math.max(Math.abs(edge.points[0]-1800)/20,Math.abs(edge.points[1]-1400)/25)).toBeCloseTo(1);
  expect(layout.frame.x+layout.frame.width).toBeGreaterThan(1820);
  expect(layout.frame.y+layout.frame.height).toBeGreaterThan(1450);
});

test('PNML roundtrip reconstructs the same graphical interface without synthetic places or arcs',async()=>{
  const net=createMethodGateExample('gates-oracle-account-reference');
  const restored=await importFromPNML(await exportToPNML(net));
  expect(apnInterfaceLayout(restored)).toEqual(apnInterfaceLayout(net));
  expect(restored.arcs).toHaveLength(net.arcs.length);expect(restored.places).toHaveLength(net.places.length);
});

test('legacy nets keep their existing presentation',()=>{
  expect(apnInterfaceLayout({places:[],transitions:[],arcs:[]})).toBeNull();
});
