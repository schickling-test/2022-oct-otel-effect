// ets_tracing: off

// NOTE this file is currently not used by should be

import * as T from '@effect-ts/core/Effect'
import * as L from '@effect-ts/core/Effect/Layer'
import * as M from '@effect-ts/core/Effect/Managed'
import { pipe } from '@effect-ts/core/Function'
import { tag } from '@effect-ts/core/Has'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import type { OTLPExporterNodeConfigBase } from '@opentelemetry/otlp-exporter-base'

import { PeriodicMetricsProvider } from './PeriodicMetricsProvider.js'

export const OTLPMetricExporterConfigSymbol = Symbol()

export class OTLPMetricExporterConfig {
  readonly [OTLPMetricExporterConfigSymbol] = OTLPMetricExporterConfigSymbol
  constructor(readonly config: OTLPExporterNodeConfigBase) {}
}

export const OTLPMetricExporterConfigTag = tag<OTLPMetricExporterConfig>(OTLPMetricExporterConfigSymbol)

export const makeOTLPMetricExporterConfigLayer = (config: OTLPExporterNodeConfigBase) =>
  L.fromEffect(OTLPMetricExporterConfigTag)(T.succeedWith(() => new OTLPMetricExporterConfig(config))).setKey(
    OTLPMetricExporterConfigTag.key,
  )

export const makeOTLPMetricExporterConfigLayerM = <R, E>(config: T.Effect<R, E, OTLPExporterNodeConfigBase>) =>
  L.fromEffect(OTLPMetricExporterConfigTag)(T.map_(config, (_) => new OTLPMetricExporterConfig(_))).setKey(
    OTLPMetricExporterConfigTag.key,
  )

export const makeMetricExporter = M.gen(function* (_) {
  const { config } = yield* _(OTLPMetricExporterConfigTag)

  const metricExporter = yield* _(
    pipe(
      T.succeedWith(() => new OTLPMetricExporter(config)),
      M.make((p) =>
        pipe(
          T.tryPromise(() => p.shutdown()),
          T.orDie,
        ),
      ),
    ),
  )

  return metricExporter
})

export const LivePeriodicMetricsProvider = PeriodicMetricsProvider(makeMetricExporter)
