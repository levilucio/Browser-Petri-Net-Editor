declare global {
  interface Window {
    __PETRI_NET_STATE__?: {
      places: any[];
      transitions: any[];
      arcs: any[];
    };
    __PETRI_NET_MODE__?: 'select' | 'place' | 'transition' | 'arc' | string;
    __LAST_FIRED_TRANSITION_ID__?: string;
    __FIRED_TRANSITIONS__?: string[];
    __PETRI_NET_SIM_CORE__?: any;
    simulatorCore?: any;
  }
}

export {};


