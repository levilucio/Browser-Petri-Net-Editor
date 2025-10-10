import React from 'react';

const SettingsButton = ({ onOpenSettings, buttonStyle }) => {
  return (
    <div className="flex justify-between">
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


