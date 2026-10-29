export type Reading = {
  folder: string
  model: string
  effort: string | null
  contextPercent: number | null
  contextTokens: number | null
  contextWindow: number
  fiveHour: number | null
  sevenDay: number | null
  lastResponseAt: number | null
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    'quota-band': { reading: Reading | null }
  }
}
