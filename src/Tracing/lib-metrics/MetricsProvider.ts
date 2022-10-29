// ets_tracing: off

import { tag } from '@effect-ts/core/Has'
// import { metrics } from '@opentelemetry/api-metrics'
import type { MeterProvider } from '@opentelemetry/sdk-metrics'

//
// ets_tracing Provider
//

export const MeterProviderSymbol = Symbol()
export type MeterProviderSymbol = typeof MeterProviderSymbol

export interface MetricsProvider {
  readonly [MeterProviderSymbol]: MeterProviderSymbol
  readonly metricsProvider: MeterProvider
}

export const MetricsProvider = tag<MetricsProvider>()
