import type { Clock } from '@effect-ts/core/Effect/Clock'
import type { ResourceAttributes } from '@opentelemetry/resources'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

import type { Has, L } from '../index.js'
import { OT, T } from '../index.js'
import { BatchProcessor } from './lib/BatchSpanProcessor.js'
import { makeOTLPTraceExporterConfigLayer, makeTracingSpanExporter } from './lib/ExporterTraceOtlpHttp.js'
import * as OTWeb from './lib/WebProvider.js'
import { makeOTLPMetricExporterConfigLayer } from './lib-metrics/ExporterMetricsOltpHttp.js'
import { LiveMeter } from './lib-metrics/Meter.js'
import { OTLPMetricsProvider } from './lib-metrics/OTLPMetricsProvider.js'

//
// TRACING
//

const makeWebTracingProvider = (serviceName: string, resourceAttributes?: ResourceAttributes) =>
  OTWeb.WebProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      ...resourceAttributes,
    }),
  })

const TraceCollectorConfig = (exporterUrl?: string) =>
  makeOTLPTraceExporterConfigLayer({
    // empty headers makes sure to use XHR instead of `navigator.sendBeacon`
    headers: {},
    url: exporterUrl,
  })

const LiveBatchHttpProcessor = BatchProcessor(makeTracingSpanExporter)

export const makeWebTracingLayer = (
  serviceName: string,
  exporterUrl?: string,
  resourceAttributes?: ResourceAttributes,
): L.Layer<Has<Clock>, never, OT.HasTracer> =>
  TraceCollectorConfig(exporterUrl)['>+>'](
    OT.LiveTracer['<<<'](makeWebTracingProvider(serviceName, resourceAttributes)['>+>'](LiveBatchHttpProcessor)),
  )

export const provideOtelTracer = (serviceName: string, exporterUrl?: string, resourceAttributes?: ResourceAttributes) =>
  T.provideSomeLayer(makeWebTracingLayer(serviceName, exporterUrl, resourceAttributes))

//
// METRICS
//

const makeWebMetricProvider = (serviceName: string, resourceAttributes?: ResourceAttributes) =>
  OTLPMetricsProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      ...resourceAttributes,
    }),
  })

const MetricCollectorConfig = (exporterUrl?: string) =>
  makeOTLPMetricExporterConfigLayer({
    // empty headers makes sure to use XHR instead of `navigator.sendBeacon`
    headers: {},
    url: exporterUrl,
  })

export const makeWebMetricLayer = (
  serviceName: string,
  exporterUrl?: string,
  resourceAttributes?: ResourceAttributes,
): L.Layer<unknown, never, OT.HasMeter> =>
  MetricCollectorConfig(exporterUrl)['>+>'](makeWebMetricProvider(serviceName, resourceAttributes))['>>>'](LiveMeter)

export const provideOtelMeter = (serviceName: string, exporterUrl?: string, resourceAttributes?: ResourceAttributes) =>
  T.provideSomeLayer(makeWebMetricLayer(serviceName, exporterUrl, resourceAttributes))
