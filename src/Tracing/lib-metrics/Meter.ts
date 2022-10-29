// ets_tracing: off

import * as T from '@effect-ts/core/Effect'
import * as L from '@effect-ts/core/Effect/Layer'
import * as M from '@effect-ts/core/Effect/Managed'
import { identity } from '@effect-ts/core/Function'
import type { Has } from '@effect-ts/core/Has'
import { tag } from '@effect-ts/core/Has'
import type * as OTMetrics from '@opentelemetry/api-metrics'

import { MetricsProvider } from './MetricsProvider.js'

export const MeterSymbol = Symbol()
export type MeterSymbol = typeof MeterSymbol

export interface Meter {
  readonly [MeterSymbol]: MeterSymbol
  readonly meter: OTMetrics.Meter
}

export type HasMeter = Has<Meter>

export const Meter = tag<Meter>()

export const makeMeter = (name: string) =>
  M.gen(function* (_) {
    const { metricsProvider } = yield* _(MetricsProvider)

    const meter = yield* _(T.succeedWith(() => metricsProvider.getMeter(name)))

    return identity<Meter>({
      [MeterSymbol]: MeterSymbol,
      meter,
    })
  })

export const LiveMeter = L.fromManaged(Meter)(makeMeter('@effect-ts/otel/Meter'))

export const { meter: withMeterM } = T.deriveAccessM(Meter)(['meter'])
export const { meter: withMeter } = T.deriveAccess(Meter)(['meter'])
