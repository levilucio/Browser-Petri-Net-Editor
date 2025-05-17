/**
 * Special debugging tool for diagnosing arc loading issues
 * This file provides utilities to inspect PNML files and track arc loading
 */
import { parsePNML } from './pnml-parser-fixed';

// Global debug counters
let debugSessionId = 1;

/**
 * Analyze a PNML file and log detailed information about its structure
 * @param {string} pnmlString - The PNML content as string
 * @returns {Object} - Analysis result
 */
export function analyzePNML(pnmlString) {
  const sessionId = debugSessionId++;
  console.log(`\n==== PNML ANALYSIS SESSION #${sessionId} ====`);
  
  try {
    // First parse using our regular parser
    console.log("Step 1: Parsing with standard parser");
    const result = parsePNML(pnmlString);
    
    console.log(`Standard parser found: ${result.places.length} places, ${result.transitions.length} transitions, ${result.arcs.length} arcs`);
    
    // Now let's do a more direct analysis
    console.log("\nStep 2: Direct XML structure analysis");
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(pnmlString, 'application/xml');
    
    // Get all arc elements regardless of namespace
    const allArcs = [];
    const arcElements = xmlDoc.getElementsByTagName('arc');
    if (arcElements.length > 0) {
      console.log(`Found ${arcElements.length} arc elements directly`);
      for (let i = 0; i < arcElements.length; i++) {
        allArcs.push(arcElements[i]);
      }
    }
    
    // Try with namespace
    const rootNS = xmlDoc.documentElement.namespaceURI;
    if (rootNS) {
      const nsArcs = xmlDoc.getElementsByTagNameNS(rootNS, 'arc');
      if (nsArcs.length > 0) {
        console.log(`Found ${nsArcs.length} arc elements with namespace ${rootNS}`);
        for (let i = 0; i < nsArcs.length; i++) {
          if (!allArcs.includes(nsArcs[i])) {
            allArcs.push(nsArcs[i]);
          }
        }
      }
    }
    
    // Get all elements and find any that might be arcs
    const allElements = xmlDoc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const elem = allElements[i];
      if (elem.tagName.toLowerCase().includes('arc') && !allArcs.includes(elem)) {
        console.log(`Found potential arc with tag ${elem.tagName}`);
        allArcs.push(elem);
      }
    }
    
    console.log(`\nTotal unique arc elements found: ${allArcs.length}`);
    
    // Analyze each arc in detail
    const arcDetails = [];
    allArcs.forEach((arc, index) => {
      const arcId = arc.getAttribute('id') || `unknown-${index}`;
      const sourceId = arc.getAttribute('source');
      const targetId = arc.getAttribute('target');
      
      console.log(`\nArc #${index + 1}: ${arcId}`);
      console.log(`  Source: ${sourceId || 'MISSING'}`);
      console.log(`  Target: ${targetId || 'MISSING'}`);
      
      // See if we can determine the arc type
      let inferredType = 'unknown';
      if (sourceId && targetId) {
        if (sourceId.toLowerCase().includes('place') && targetId.toLowerCase().includes('transition')) {
          inferredType = 'place-to-transition';
        } else if (sourceId.toLowerCase().includes('transition') && targetId.toLowerCase().includes('place')) {
          inferredType = 'transition-to-place';
        } else if (/p[0-9]+/i.test(sourceId) && /t[0-9]+/i.test(targetId)) {
          inferredType = 'place-to-transition';
        } else if (/t[0-9]+/i.test(sourceId) && /p[0-9]+/i.test(targetId)) {
          inferredType = 'transition-to-place';
        }
      }
      
      console.log(`  Inferred Type: ${inferredType}`);
      
      arcDetails.push({
        id: arcId,
        source: sourceId,
        target: targetId,
        type: inferredType
      });
    });
    
    // Compare with our parser result
    console.log("\nStep 3: Comparing direct analysis with parser results");
    
    const foundButNotParsed = arcDetails.filter(a => 
      !result.arcs.some(parsed => parsed.id === a.id));
      
    const parsedButNotFound = result.arcs.filter(a => 
      !arcDetails.some(found => found.id === a.id));
    
    console.log(`Arcs found in direct analysis but not in parsed result: ${foundButNotParsed.length}`);
    foundButNotParsed.forEach(a => console.log(`  ${a.id} (${a.source} -> ${a.target})`));
    
    console.log(`Arcs in parsed result but not found in direct analysis: ${parsedButNotFound.length}`);
    parsedButNotFound.forEach(a => console.log(`  ${a.id} (${a.source} -> ${a.target})`));
    
    // Now let's also check if the arcs are valid - do they reference real places and transitions?
    console.log("\nStep 4: Validating arc references");
    
    const placeIds = new Set();
    const transitionIds = new Set();
    
    // Get all place and transition elements
    const places = xmlDoc.getElementsByTagName('place');
    for (let i = 0; i < places.length; i++) {
      placeIds.add(places[i].getAttribute('id'));
    }
    
    const transitions = xmlDoc.getElementsByTagName('transition');
    for (let i = 0; i < transitions.length; i++) {
      transitionIds.add(transitions[i].getAttribute('id'));
    }
    
    console.log(`Found ${placeIds.size} unique place IDs and ${transitionIds.size} unique transition IDs`);
    
    // Check each arc
    const invalidArcs = [];
    arcDetails.forEach(arc => {
      const sourceExists = placeIds.has(arc.source) || transitionIds.has(arc.source);
      const targetExists = placeIds.has(arc.target) || transitionIds.has(arc.target);
      
      if (!sourceExists || !targetExists) {
        invalidArcs.push({
          ...arc,
          invalidSource: !sourceExists,
          invalidTarget: !targetExists
        });
      }
    });
    
    console.log(`Found ${invalidArcs.length} arcs with invalid references`);
    invalidArcs.forEach(a => {
      console.log(`  ${a.id}: ${a.invalidSource ? 'Invalid Source' : ''} ${a.invalidTarget ? 'Invalid Target' : ''}`);
    });
    
    // Create a comprehensive analysis result
    const analysis = {
      standardParser: {
        places: result.places.length,
        transitions: result.transitions.length,
        arcs: result.arcs.length,
        details: result
      },
      directAnalysis: {
        arcs: arcDetails.length,
        details: arcDetails
      },
      differences: {
        foundButNotParsed,
        parsedButNotFound
      },
      validation: {
        invalidArcs,
        placeCount: placeIds.size,
        transitionCount: transitionIds.size
      }
    };
    
    console.log(`\n==== END ANALYSIS SESSION #${sessionId} ====\n`);
    
    // Add to window for debugging
    window.__PNML_ANALYSIS__ = analysis;
    
    return analysis;
  } catch (error) {
    console.error(`Error in PNML analysis session #${sessionId}:`, error);
    return null;
  }
}

/**
 * Trace the flow of arc data through the application
 * @param {Object} elements - The current elements state
 * @returns {Object} - Analysis of the current state
 */
export function traceArcFlow(elements) {
  console.log("\n==== ARC FLOW ANALYSIS ====");
  
  try {
    const { places, transitions, arcs } = elements;
    
    console.log(`Current state has: ${places.length} places, ${transitions.length} transitions, ${arcs.length} arcs`);
    
    // Check if arcs have valid references
    const placeIds = new Set(places.map(p => p.id));
    const transitionIds = new Set(transitions.map(t => t.id));
    
    const invalidArcs = arcs.filter(arc => {
      const sourceExists = placeIds.has(arc.source) || transitionIds.has(arc.source);
      const targetExists = placeIds.has(arc.target) || transitionIds.has(arc.target);
      return !sourceExists || !targetExists;
    });
    
    console.log(`Found ${invalidArcs.length} arcs with invalid references in current state`);
    
    // Check arc types
    const arcTypeStats = {
      'place-to-transition': 0,
      'transition-to-place': 0,
      'unknown': 0
    };
    
    arcs.forEach(arc => {
      if (arc.type === 'place-to-transition') {
        arcTypeStats['place-to-transition']++;
      } else if (arc.type === 'transition-to-place') {
        arcTypeStats['transition-to-place']++;
      } else {
        arcTypeStats['unknown']++;
      }
    });
    
    console.log('Arc type statistics:');
    console.log(`  place-to-transition: ${arcTypeStats['place-to-transition']}`);
    console.log(`  transition-to-place: ${arcTypeStats['transition-to-place']}`);
    console.log(`  unknown: ${arcTypeStats['unknown']}`);
    
    console.log("==== END ARC FLOW ANALYSIS ====\n");
    
    return {
      counts: {
        places: places.length,
        transitions: transitions.length,
        arcs: arcs.length
      },
      invalidArcs,
      arcTypeStats
    };
  } catch (error) {
    console.error("Error in arc flow analysis:", error);
    return null;
  }
}

// Add global functions for easy access in the browser console
window.analyzePNML = function(pnmlString) {
  return analyzePNML(pnmlString);
};

window.traceArcFlow = function(elements) {
  return traceArcFlow(elements || window.__DEBUG_LOADED_STATE__);
};

// Export the utility functions
export default {
  analyzePNML,
  traceArcFlow
};
