import React from 'react';

const SettingsButton = ({ onOpenSettings, buttonStyle }) => {
  return (
    <div className="flex flex-wrap gap-2">
      <button 
        style={buttonStyle(false)}
        onClick={onOpenSettings}
        title="Simulation Settings"
        data-testid="toolbar-settings"
      >
        Settings
      </button>
    </div>
  );
};

export default SettingsButton;


