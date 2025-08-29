import React, { useState, useEffect } from 'react';
import { exportToPNML, importFromPNML, importADT, validateADTSpec, exportADT } from '../utils/python/index';
import { useAdtRegistry } from '../contexts/AdtContext';

/**
 * Component for importing and exporting Petri nets in PNML format
 */
function ImportExportPanel({ elements, setElements, updateHistory }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [adtError, setAdtError] = useState(null);
  const [adtSuccess, setAdtSuccess] = useState(null);
  const adtRegistry = useAdtRegistry();
  
  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (!success) return;
    const timeoutId = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(timeoutId);
  }, [success]);

  /**
   * Export the current Petri net to PNML format and download it
   */
  const handleExport = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      // Convert the Petri net to PNML
      const pnmlString = await exportToPNML(elements);
      
      // Create a blob and download link
      const blob = new Blob([pnmlString], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and trigger it
      const a = document.createElement('a');
      a.href = url;
      a.download = 'petri-net.pnml';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess('Petri net exported successfully!');
    } catch (error) {
      console.error('Error exporting Petri net:', error);
      setError(`Error exporting Petri net: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Import a Petri net from a PNML file
   * @param {Event} event - File input change event
   */
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      // Read the file
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });
      
      // Convert the PNML to JSON
      const petriNetJson = await importFromPNML(fileContent);
      
      // Update the Petri net state
      setElements(petriNetJson);
      
      // Add to history
      if (updateHistory) {
        updateHistory(petriNetJson);
      }
      
      setSuccess('Petri net imported successfully!');
    } catch (error) {
      console.error('Error importing Petri net:', error);
      setError(`Error importing Petri net: ${error.message}`);
    } finally {
      setIsLoading(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  // Import ADT XML file and validate
  const handleImportADT = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const txt = await file.text();
        const adt = await importADT(txt);
        const res = await validateADTSpec(adt);
        if (!res.valid) {
          setAdtError(`ADT validation failed: ${res.errors.join('; ')}`);
          setAdtSuccess(null);
        } else {
          const regRes = adtRegistry.registerCustomADTXml(txt);
          if (!regRes.ok) {
            setAdtError(`ADT registration failed: ${(regRes.errors || []).join('; ')}`);
            setAdtSuccess(null);
            return;
          }
          setAdtSuccess('ADT file loaded, validated, and registered successfully.');
          setAdtError(null);
        }
      } catch (err) {
        setAdtError(`Error importing ADT: ${err.message || String(err)}`);
        setAdtSuccess(null);
      }
    };
    input.click();
  };

  // Export empty ADT scaffold
  const handleExportADT = async () => {
    try {
      const xml = await exportADT({ types: [] });
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'adt.xml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setAdtSuccess('Exported ADT scaffold to adt.xml');
      setAdtError(null);
    } catch (err) {
      setAdtError(`Error exporting ADT: ${err.message || String(err)}`);
      setAdtSuccess(null);
    }
  };

  return (
    <div className="p-4 border-t border-gray-300">
      <h3 className="text-lg font-medium mb-3">Import/Export</h3>
      
      {/* Export buttons */}
      <button
        className="w-full mb-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
        onClick={handleExport}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Export as PNML'}
      </button>
      <button
        className="w-full mb-2 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-indigo-300"
        onClick={handleExportADT}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Export ADT XML'}
      </button>
      
      {/* Import PNML file input */}
      <div className="mb-2">
        <label className="block w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300 text-center cursor-pointer">
          {isLoading ? 'Processing...' : 'Import PNML File'}
          <input
            type="file"
            accept=".pnml,.xml"
            onChange={handleImport}
            disabled={isLoading}
            className="hidden"
          />
        </label>
      </div>

      {/* Import ADT file */}
      <button
        className="w-full mb-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-purple-300"
        onClick={handleImportADT}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Import ADT XML'}
      </button>
      
      {/* Status messages */}
      {error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mt-2 p-2 bg-green-100 border border-green-300 text-green-700 rounded">
          {success}
        </div>
      )}
      {adtError && (
        <div className="mt-2 p-2 bg-red-100 border border-red-300 text-red-700 rounded">
          {adtError}
        </div>
      )}
      {adtSuccess && (
        <div className="mt-2 p-2 bg-green-100 border border-green-300 text-green-700 rounded">
          {adtSuccess}
        </div>
      )}
      
      {/* Information about PNML format */}
      <div className="mt-4 text-sm text-gray-600">
        <p>PNML (Petri Net Markup Language) is a standard XML-based interchange format for Petri nets.</p>
      </div>
    </div>
  );
}

export default ImportExportPanel;
