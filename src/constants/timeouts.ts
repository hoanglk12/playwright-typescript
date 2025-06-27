const isCI = process.env.CI === 'true';
const isDev = process.env.NODE_ENV === 'testing';

export const TIMEOUTS = {
  // Page load timeouts
  PAGE_LOAD: isCI ? 60000 : isDev ? 15000 : 30000,
  PAGE_LOAD_SLOW: 60000,
  PAGE_LOAD_FAST: 15000,
  
  // Network timeouts
  NETWORK_IDLE: isCI ? 45000 : 30000,
  NETWORK_IDLE_SLOW: 45000,
  
  // Element interaction timeouts
  ELEMENT_VISIBLE: isCI ? 20000 : 10000,
  ELEMENT_CLICKABLE: 5000,
  
  // Dialog timeouts
  DIALOG_APPEAR: 10000,
  DIALOG_DISMISS: 5000,
  
  // Drag and drop timeouts
  DRAG_DROP_OPERATION: 15000,
  
  // API timeouts
  API_RESPONSE: 20000,
  API_RESPONSE_SLOW: 40000,
} as const;