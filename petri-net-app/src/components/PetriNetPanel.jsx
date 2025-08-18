import React, { useState } from 'react';

const PetriNetPanel = ({ elements, enabledTransitionIds }) => {
	const [isMarkingsPanelOpen, setIsMarkingsPanelOpen] = useState(false);
	const [isEnabledPanelOpen, setIsEnabledPanelOpen] = useState(false);

	return (
		<div className="border-t border-gray-200 pt-4 mt-4 px-4">
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
							<div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
								{(elements.places || []).map(place => {
									const label = place.label || place.name || place.id.substring(6, 12);
									const tokens = place.tokens || 0;
									return (
										<div key={place.id} className="flex items-center text-sm">
											<span className="font-medium text-gray-800 mr-2 truncate" title={label}>{label}</span>
											<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-semibold min-w-[2rem] justify-center">
												{tokens}
											</span>
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
					<div data-testid="enabled-transitions" className="markings-panel p-3 bg-gray-50 border border-gray-200 rounded-md">
						{(() => {
							const items = (enabledTransitionIds || []).map((id) => {
								const t = (elements.transitions || []).find(tr => tr.id === id);
								const label = (t && (t.label || t.name)) || id;
								return { id, label };
							});
							if (items.length === 0) {
								return (
									<div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1"></div>
								);
							}
							return (
								<div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
									{items.map(({ id, label }) => (
										<button key={id} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium border border-yellow-200">
											{label}
										</button>
									))}
								</div>
							);
						})()}
					</div>
				)}
			</div>
		</div>
	);
};

export default PetriNetPanel;


