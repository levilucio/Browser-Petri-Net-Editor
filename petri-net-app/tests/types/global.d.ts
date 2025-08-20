declare global {
  interface Window {
    __PETRI_NET_STATE__?: {
      places: any[];
      transitions: any[];
      arcs: any[];
    };
  }
}

export {};


