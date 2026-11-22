const key = 'linked-assets-session';
export function readSession() { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } }
export function writeSession(session) { if (session) sessionStorage.setItem(key, JSON.stringify(session)); else sessionStorage.removeItem(key); }
export function formatTime(iso) { return new Intl.DateTimeFormat(undefined, {dateStyle:'medium', timeStyle:'long'}).format(new Date(iso)); }
let returnFocus=null;
export function rememberFocus(){returnFocus=document.activeElement;}
export function restoreFocus(){if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
const visibilityListeners=new Map();let nextListener=0;
export function watchVisibility(callbacks){const id=++nextListener;const listener=()=>{if(document.visibilityState==='visible')callbacks.invokeMethodAsync('BecameVisible').catch(()=>{});};document.addEventListener('visibilitychange',listener);visibilityListeners.set(id,listener);return id;}
export function unwatchVisibility(id){const listener=visibilityListeners.get(id);if(listener)document.removeEventListener('visibilitychange',listener);visibilityListeners.delete(id);returnFocus=null;}
