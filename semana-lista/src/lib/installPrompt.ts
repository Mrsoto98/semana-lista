// Almacena el beforeinstallprompt globalmente sin circular deps
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prompt: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setInstallPrompt(p: any) { _prompt = p }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getInstallPrompt(): any { return _prompt }
export function clearInstallPrompt() { _prompt = null }
