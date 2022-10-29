// ets_tracing: off

import * as T from '@effect-ts/core/Effect'
import * as L from '@effect-ts/core/Effect/Layer'
import * as M from '@effect-ts/core/Effect/Managed'
import { identity } from '@effect-ts/core/Function'
import { tag } from '@effect-ts/core/Has'
import type { MetricReader, PushMetricExporter } from '@opentelemetry/sdk-metrics'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

import { MetricsProvider } from './MetricsProvider.js'

//
// Span Processor
//

export const PeriodicMetricsProviderSymbol = Symbol()
export type PeriodicMetricsProviderSymbol = typeof PeriodicMetricsProviderSymbol

export interface PeriodicMetricsProvider {
  readonly [PeriodicMetricsProviderSymbol]: PeriodicMetricsProviderSymbol
  readonly metricsExporter: PushMetricExporter
  readonly metricReader: MetricReader
}

export const makePeriodicMetricsProvider = <R, E, A extends PushMetricExporter>(exporter: M.Managed<R, E, A>) =>
  M.gen(function* (_) {
    const { metricsProvider } = yield* _(MetricsProvider)

    const metricsExporter = yield* _(exporter)

    const metricReader = yield* _(
      T.succeedWith(
        () =>
          new PeriodicExportingMetricReader({
            exporter: metricsExporter,
            exportIntervalMillis: 1000, // TODO make configurable
          }),
      ),
    )

    yield* _(T.succeedWith(() => metricsProvider.addMetricReader(metricReader)))

    return identity<PeriodicMetricsProvider>({
      [PeriodicMetricsProviderSymbol]: PeriodicMetricsProviderSymbol,
      metricsExporter,
      metricReader,
    })
  })

export const PeriodicMetricsProviderTag = tag<PeriodicMetricsProvider>(PeriodicMetricsProviderSymbol)

export const PeriodicMetricsProvider = <R, E, A extends PushMetricExporter>(exporter: M.Managed<R, E, A>) =>
  L.fromManaged(PeriodicMetricsProviderTag)(makePeriodicMetricsProvider(exporter))
