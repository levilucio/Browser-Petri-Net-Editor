/**
 * Debug tool for PNML parser testing
 * This file creates a global function to test the parser with any PNML string
 */
import { parsePNML } from './pnml-parser';

// Create a global testing function
window.testPNMLParser = function(pnmlString) {
  console.log('================ PNML PARSER DEBUG ================');
  console.log('Testing parser with PNML string:', pnmlString.substring(0, 100) + '...');
  
  try {
    // Parse the PNML string
    const result = parsePNML(pnmlString);
    
    // Log the result
    console.log('Parsing result:', result);
    console.log(`Places: ${result.places.length}`);
    console.log(`Transitions: ${result.transitions.length}`);
    console.log(`Arcs: ${result.arcs.length}`);
    
    // Log the actual XML structure for debugging
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(pnmlString, 'application/xml');
    
    console.log('XML document structure:');
    console.log('Root element:', xmlDoc.documentElement.tagName);
    
    // Check for namespace
    console.log('Root namespace:', xmlDoc.documentElement.namespaceURI);
    
    // Try direct tag access
    const places = xmlDoc.getElementsByTagName('place');
    const transitions = xmlDoc.getElementsByTagName('transition');
    const arcs = xmlDoc.getElementsByTagName('arc');
    
    console.log(`Direct tag access - Places: ${places.length}, Transitions: ${transitions.length}, Arcs: ${arcs.length}`);
    
    // Try with namespace
    const nsURI = xmlDoc.documentElement.namespaceURI;
    if (nsURI) {
      const nsPlaces = xmlDoc.getElementsByTagNameNS(nsURI, 'place');
      const nsTransitions = xmlDoc.getElementsByTagNameNS(nsURI, 'transition');
      const nsArcs = xmlDoc.getElementsByTagNameNS(nsURI, 'arc');
      
      console.log(`Namespace tag access - Places: ${nsPlaces.length}, Transitions: ${nsTransitions.length}, Arcs: ${nsArcs.length}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error in PNML parser test:', error);
    return null;
  } finally {
    console.log('================ END DEBUG ================');
  }
};

// Add function to automatically test with a sample PNML
window.testWithSamplePNML = function() {
  const samplePNML = `
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="net1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <name>
      <text>Petri Net</text>
    </name>
    <page id="page1">
      <place id="place-1747503889991">
        <name>
          <text>P1</text>
        </name>
        <graphics>
          <position x="360" y="80"/>
        </graphics>
      </place>
      <transition id="transition-1747503891563">
        <name>
          <text>T1</text>
        </name>
        <graphics>
          <position x="520" y="320"/>
        </graphics>
      </transition>
      <arc id="arc-1747503895775" source="place-1747503889991" target="transition-1747503891563">
        <graphics>
          <metadata>
            <sourceDirection>south</sourceDirection>
            <targetDirection>north</targetDirection>
          </metadata>
        </graphics>
      </arc>
    </page>
  </net>
</pnml>
  `;
  
  return window.testPNMLParser(samplePNML);
};

// Export the testing functions
export const testPNMLParser = () => window.testPNMLParser;
export const testWithSamplePNML = () => window.testWithSamplePNML;
