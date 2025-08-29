/**
 * JavaScript wrapper for PNML parser/serializer
 * This module provides functions to convert between the Petri net editor's internal
 * JSON representation and standard PNML (Petri Net Markup Language) XML format.
 */
import { parsePNML, generatePNML } from '../pnml-parser';
import { parseADT, generateADT, validateADT } from '../adt-parser';

/**
 * Convert the Petri net editor's JSON representation to PNML XML string
 * @param {object} petriNetJson - The Petri net in JSON format with places, transitions, and arcs
 * @returns {Promise<string>} - PNML XML representation of the Petri net
 */
export async function exportToPNML(petriNetJson) {
  try {
    // Exporting to PNML
    
    // Use the pure JavaScript implementation
    const pnmlString = generatePNML(petriNetJson);
    
    return pnmlString;
  } catch (error) {
    console.error("Error exporting to PNML:", error);
    throw error;
  }
}

/**
 * Convert PNML XML string to the Petri net editor's JSON representation
 * @param {string} pnmlString - PNML XML representation of the Petri net
 * @returns {Promise<object>} - The Petri net in JSON format with places, transitions, and arcs
 */
export async function importFromPNML(pnmlString) {
  try {
    // Importing from PNML
    
    // Use the pure JavaScript implementation
    const result = parsePNML(pnmlString);
    
    // PNML import successful
    
    return result;
  } catch (error) {
    console.error("Error importing from PNML:", error);
    throw error;
  }
}

/**
 * Parse ADT XML string
 * @param {string} xml
 * @returns {Promise<{ types: any[] }>}
 */
export async function importADT(xml) {
  return parseADT(xml);
}

/**
 * Validate ADT structure
 * @param {{ types: any[] }} adt
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
export async function validateADTSpec(adt) {
  return validateADT(adt);
}

/**
 * Generate ADT XML from JSON
 * @param {{ types: any[] }} adt
 * @returns {Promise<string>}
 */
export async function exportADT(adt) {
  return generateADT(adt);
}
