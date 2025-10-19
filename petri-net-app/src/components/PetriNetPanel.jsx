import React, { useState } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';
import EnabledTransitionsPanel from './EnabledTransitionsPanel';
import { formatTokensList } from '../utils/token-format';

const PetriNetPanel = ({ elements, enabledTransitionIds }) => {
	const { handleFireTransition, netMode } = usePetriNet();
	const [isMarkingsPanelOpen, setIsMarkingsPanelOpen] = useState(false);
	const [isEnabledPanelOpen, setIsEnabledPanelOpen] = useState(false);

	return (
		<div className="pt-4 mt-4 px-4">
			<h3 className="text-lg font-semibold text-gray-700 mb-3">Petri Net</h3>
			{/* Current Markings */}
			<div className="mb-4 pl-1">
				<div className="flex justify-between items-center mb-2">
					<h4 className="text-sm font-semibold text-gray-700">Current Markings</h4>
					<button
						data-testid="toggle-markings"
						className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm flex items-center space-x-1 transition-colors"
						onClick={() => setIsMarkingsPanelOpen(!isMarkingsPanelOpen)}
					>
						<span>{isMarkingsPanelOpen ? 'Hide' : 'Show'}</span>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
					</button>
				</div>
				{isMarkingsPanelOpen && (
					<div data-testid="current-marking" className="markings-panel p-3 bg-gray-50 border border-gray-200 rounded-md">
						{(elements.places || []).length === 0 ? (
							<p className="text-gray-500 text-sm">No places defined</p>
						) : (
							<div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
					{((elements.places || []).filter(p => {
						if (netMode === 'algebraic-int') {
							const vt = Array.isArray(p.valueTokens) ? p.valueTokens : [];
							return vt.length > 0; // show only non-empty places in algebraic mode
						}
						return true;
					})).map(place => {
						const label = place.label || place.name || place.id.substring(6, 12);
						const tokens = place.tokens || 0;
						const valueTokens = Array.isArray(place.valueTokens) ? place.valueTokens : [];
						const isAlgebraic = (netMode === 'algebraic-int') && Array.isArray(place.valueTokens);
							const algebraicText = isAlgebraic ? formatTokensList(valueTokens) : '';
						return (
							<div key={place.id} className="flex items-start text-sm">
								<span className="font-medium text-gray-800 mr-2 truncate" title={label}>{label}</span>
								{isAlgebraic ? (
									<div className="flex-1 text-gray-800 bg-purple-50 border border-purple-200 rounded px-2 py-1 whitespace-pre-wrap break-words overflow-visible" title={algebraicText}>
										{algebraicText || '[]'}
									</div>
								) : (
									<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-semibold min-w-[2rem] justify-center">
										{tokens}
									</span>
								)}
							</div>
						);
					})}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Enabled Transitions */}
			<div className="mb-2 pl-1">
				<div className="flex justify-between items-center mb-2">
					<h4 className="text-sm font-semibold text-gray-700">Enabled Transitions</h4>
					<button
						data-testid="show-enabled-transitions"
						className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm flex items-center space-x-1 transition-colors"
						onClick={() => setIsEnabledPanelOpen(!isEnabledPanelOpen)}
					>
						<span>{isEnabledPanelOpen ? 'Hide' : 'Show'}</span>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
					</button>
				</div>
				{isEnabledPanelOpen && (
					<EnabledTransitionsPanel
						isOpen={true}
						enabledTransitions={(enabledTransitionIds || []).map((id) => {
							const t = (elements.transitions || []).find(tr => tr.id === id);
							return { id, label: (t && (t.label || t.name)) || id };
						})}
						isLoading={false}
						onClose={() => setIsEnabledPanelOpen(false)}
						onFire={(id) => handleFireTransition && handleFireTransition(id)}
					/>
				)}
			</div>
		</div>
	);
};

export default PetriNetPanel;


