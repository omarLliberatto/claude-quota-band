import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit } from 'claude-code'

import type { Reading } from '../types'

const reading = atom({ plugin: 'quota-band', key: 'reading' } as const, null)

const EMPTY: Reading = {
  folder: '',
  model: '',
  effort: null,
  contextPercent: null,
  contextTokens: null,
  contextWindow: 0,
  fiveHour: null,
  sevenDay: null,
  lastResponseAt: null,
  now: 0
}

const CACHE_TTL_MIN = 60

const colorFor = (percent: number) =>
  percent >= 80 ? 'red' : percent >= 60 ? 'yellow' : 'green'

const colorForTokens = (tokens: number) =>
  tokens >= 400000 ? 'red' : tokens >= 200000 ? 'yellow' : 'green'

const colorForCache = (minutes: number) =>
  minutes <= 5 ? 'red' : minutes <= 15 ? 'yellow' : 'green'

const kilo = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)}K` : `${n}`)

const prettyModel = (id: string) => {
  const m = id.replace(/^claude-/, '').match(/^([a-z]+)-(\d+)(?:-(\d+))?/)

  if (!m) {
    return id
  }

  const [, family = '', major = '', minor] = m
  const name = family.charAt(0).toUpperCase() + family.slice(1)

  return minor ? `${name} ${major}.${minor}` : `${name} ${major}`
}

const folderOf = (path: string) => path.split('/').filter(Boolean).pop() ?? path

const percentOf = (limits: SessionRateLimit[], kind: string) => {
  const found = limits.find(l => l.kind === kind)

  return found ? Math.floor(found.percentUsed) : null
}

async function patch(
  $: Parameters<typeof update>[0],
  changes: Partial<Reading>
) {
  await update($, reading, current => ({
    ...EMPTY,
    ...(current ?? {}),
    ...changes
  }))
}

async function capture(
  $: Parameters<typeof update>[0],
  model: string,
  context: { tokens?: number; window: number; percent?: number },
  rateLimits: SessionRateLimit[]
) {
  await patch($, {
    model: prettyModel(model),
    contextPercent: context.percent ?? null,
    contextTokens: context.tokens ?? null,
    contextWindow: context.window,
    fiveHour: percentOf(rateLimits, 'five_hour'),
    sevenDay: percentOf(rateLimits, 'seven_day')
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const usage = await $.session.usage()
    const model = await $.session.model()
    await capture($, model, usage.context, usage.rateLimits)
    const now = await $.clock.now()
    const current = await read($, reading)
    const isWarm = (await $.session.turns()) > 0 && current?.lastResponseAt == null
    await patch($, {
      folder: folderOf(e.cwd),
      now,
      ...(isWarm ? { lastResponseAt: now } : {})
    })
    $.clock.every(30000, async () => {
      await patch($, { now: await $.clock.now() })
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await capture($, await $.session.model(), e.context, e.rateLimits)

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await patch($, {
        effort: e.effort === undefined ? null : String(e.effort),
        lastResponseAt: now,
        now
      })
    }

    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    await patch($, { lastResponseAt: now, now })

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, reading)

    if (e.props.hasSurvey || r === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const tokens = r.contextTokens ?? 0
    const cacheLeft =
      r.lastResponseAt === null
        ? null
        : Math.max(
            0,
            Math.floor(CACHE_TTL_MIN - (r.now - r.lastResponseAt) / 60000)
          )
    const sep = <Text dimColor> | </Text>

    return (
      <Box>
        <Text dimColor>{r.folder}</Text>
        {sep}
        <Text color="cyan">
          {r.model}
          {r.effort ? ` ${r.effort}` : ''}
        </Text>
        {sep}
        <Text color={colorForTokens(tokens)}>
          ctx {r.contextPercent ?? 0}% {kilo(tokens)}/{kilo(r.contextWindow)}
        </Text>
        {tokens >= 200000 && (
          <Text color="magenta">{tokens >= 400000 ? ' WRAPUP' : ' wrapup?'}</Text>
        )}
        {cacheLeft !== null && (
          <Text>
            {sep}
            <Text color={cacheLeft === 0 ? 'red' : colorForCache(cacheLeft)}>
              {cacheLeft === 0 ? 'caché vencida' : `caché ${cacheLeft}m`}
            </Text>
          </Text>
        )}
        {r.fiveHour !== null && (
          <Text>
            {sep}
            <Text color={colorFor(r.fiveHour)}>5h {r.fiveHour}%</Text>
          </Text>
        )}
        {r.sevenDay !== null && (
          <Text>
            {sep}
            <Text color={colorFor(r.sevenDay)}>7d {r.sevenDay}%</Text>
          </Text>
        )}
      </Box>
    )
  })
}
