// ets_tracing: off

import { pipe } from '@effect-ts/core'
import * as T from '@effect-ts/core/Effect'
import * as L from '@effect-ts/core/Effect/Layer'
import * as M from '@effect-ts/core/Effect/Managed'
import { identity } from '@effect-ts/core/Function'
import { tag } from '@effect-ts/core/Has'
import * as O from '@effect-ts/core/Option'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import type { MeterProviderOptions } from '@opentelemetry/sdk-metrics'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

import { OTLPMetricExporterConfigTag } from './ExporterMetricsOltpHttp.js'
import { MeterProviderSymbol, MetricsProvider } from './MetricsProvider.js'

const OTLPMetricsProviderConfigSymbol = Symbol()

export interface OTLPMetricsProviderConfig {
  readonly options: MeterProviderOptions
}

export const OTLPMetricsProviderConfig = tag<OTLPMetricsProviderConfig>(OTLPMetricsProviderConfigSymbol)

export const LiveOTLPMetricsProviderConfig = (options: MeterProviderOptions) =>
  L.fromValue(OTLPMetricsProviderConfig)({ options })

export const makeOTLPMetricsProvider = M.gen(function* (_) {
  const env = yield* _(T.environment())
  const options = pipe(
    OTLPMetricsProviderConfig.readOption(env),
    O.map((_) => _.options),
    O.toUndefined,
  )
  const metricsProvider = yield* _(T.succeedWith(() => new MeterProvider(options)))

  // TODO remove below

  // const metricsExporter = yield* _(exporter)
  const { config } = yield* _(OTLPMetricExporterConfigTag)

  const metricExporter = yield* _(
    pipe(
      T.succeedWith(() => new OTLPMetricExporter(config)),
      // TODO re-enable
      M.make((_p) =>
        pipe(
          // T.tryPromise(() => p.shutdown()),
          T.unit, // TODO without this I'm seeing a "`config` of undefined" bug
          T.orDie,
        ),
      ),
    ),
  )

  const metricReader = yield* _(
    T.succeedWith(
      () =>
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 1000, // TODO make configurable
        }),
    ),
  )

  yield* _(T.succeedWith(() => metricsProvider.addMetricReader(metricReader)))

  // TODO remove above

  return identity<MetricsProvider>({
    [MeterProviderSymbol]: MeterProviderSymbol,
    metricsProvider,
  })
})

export const OTLPMetricsProviderLayer = L.fromManaged(MetricsProvider)(makeOTLPMetricsProvider)

export const OTLPMetricsProvider = (config?: MeterProviderOptions) =>
  config ? OTLPMetricsProviderLayer['<<<'](LiveOTLPMetricsProviderConfig(config)) : OTLPMetricsProviderLayer
