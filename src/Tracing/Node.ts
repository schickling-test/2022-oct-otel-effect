import type { Clock } from '@effect-ts/core/Effect/Clock'
import { LiveSimpleProcessor, makeOTLPTraceExporterConfigLayer } from '@effect-ts/otel-exporter-trace-otlp-grpc'
import * as OTNode from '@effect-ts/otel-sdk-trace-node'
import type { ResourceAttributes } from '@opentelemetry/resources'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

import type { Has, L } from '../index.js'
import { OT, T } from '../index.js'
import { makeOTLPMetricExporterConfigLayer } from './lib-metrics/ExporterMetricsOltpHttp.js'
import { LiveMeter } from './lib-metrics/Meter.js'
import { OTLPMetricsProvider } from './lib-metrics/OTLPMetricsProvider.js'

export { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
export { Resource } from '@opentelemetry/resources'
export { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

const makeNodeTracingProvider = (serviceName: string, resourceAttributes?: ResourceAttributes) =>
  OTNode.NodeProvider({
    resource: new Resource({ [SemanticResourceAttributes.SERVICE_NAME]: serviceName, ...resourceAttributes }),
  })

const TraceCollectorConfig = makeOTLPTraceExporterConfigLayer({})

const makeNodeTracingLayer = (
  serviceName: string,
  resourceAttributes?: ResourceAttributes,
): L.Layer<Has<Clock>, never, OT.HasTracer> =>
  TraceCollectorConfig['>+>'](
    OT.LiveTracer['<<<'](makeNodeTracingProvider(serviceName, resourceAttributes)['>+>'](LiveSimpleProcessor)),
  )

export const provideOtelTracer = (serviceName: string, resourceAttributes?: ResourceAttributes) =>
  T.provideSomeLayer(makeNodeTracingLayer(serviceName, resourceAttributes))

const makeNodeMetricProvider = (serviceName: string, resourceAttributes?: ResourceAttributes) =>
  OTLPMetricsProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      ...resourceAttributes,
    }),
  })

const MetricCollectorConfig = makeOTLPMetricExporterConfigLayer({})

const makeNodeMetricLayer = (
  serviceName: string,
  resourceAttributes?: ResourceAttributes,
): L.Layer<unknown, never, OT.HasMeter> =>
  MetricCollectorConfig['>+>'](makeNodeMetricProvider(serviceName, resourceAttributes))['>>>'](LiveMeter)

export const provideOtelMeter = (serviceName: string, resourceAttributes?: ResourceAttributes) =>
  T.provideSomeLayer(makeNodeMetricLayer(serviceName, resourceAttributes))
