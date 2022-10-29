import { pipe } from '@effect-ts/core'
import * as T from '@effect-ts/core/Effect'
import type * as OTMetrics from '@opentelemetry/api-metrics'

import { withMeter } from './Meter.js'

type MetricCache = {
  histograms: Map<string, OTMetrics.Histogram>
  gauges: Map<string, { counter: OTMetrics.Counter; prevValue: number }>
  // gauges: Map<string, { observable: OTMetrics.ObservableGauge; currentCallback: OTMetrics.ObservableCallback }>
  upDownCounters: Map<string, OTMetrics.Counter>
}

const metricCache: MetricCache = {
  histograms: new Map(),
  gauges: new Map(),
  upDownCounters: new Map(),
}

export const histogram =
  (metricName: string, value: number, attributes?: OTMetrics.MetricAttributes) =>
  <R, E, A>(effect: T.Effect<R, E, A>) =>
    pipe(
      effect,
      T.tap(() =>
        pipe(
          withMeter((meter) =>
            getOrCreate(metricCache.histograms, metricName, () => meter.createHistogram(metricName)),
          ),
          T.tap((histogram) => T.succeedWith(() => histogram.record(value, attributes))),
        ),
      ),
    )

export const histogramEff =
  <R2>(metricName: string, valueEff: T.Effect<R2, never, number>) =>
  <R, E, A>(effect: T.Effect<R, E, A>) =>
    pipe(
      effect,
      T.tap(() =>
        pipe(
          withMeter((meter) =>
            getOrCreate(metricCache.histograms, metricName, () => meter.createHistogram(metricName)),
          ),
          T.tap((histogram) =>
            pipe(
              valueEff,
              T.map((value) => histogram.record(value)),
            ),
          ),
        ),
      ),
    )

export const upDownCounter =
  (metricName: string, delta: number, attributes?: OTMetrics.MetricAttributes) =>
  <R, E, A>(effect: T.Effect<R, E, A>) =>
    pipe(
      effect,
      T.tap(() =>
        pipe(
          withMeter((meter) =>
            getOrCreate(metricCache.upDownCounters, metricName, () => meter.createUpDownCounter(metricName)),
          ),
          T.tap((counter) => T.succeedWith(() => counter.add(delta, attributes))),
        ),
      ),
    )

/** NOTE we're using an up-down-counter here (which is push based) instead of an observable gauge (which is pull based) */
export const gauge =
  (metricName: string, value: number, attributes?: OTMetrics.MetricAttributes) =>
  <R, E, A>(effect: T.Effect<R, E, A>) => {
    // NOTE this is currently used to keep separate gauges for each attribute value
    const metricCacheName = metricName + '_' + JSON.stringify(attributes)
    return pipe(
      effect,
      T.tap(() =>
        pipe(
          withMeter((meter) =>
            getOrCreate(metricCache.gauges, metricCacheName, () => ({
              counter: meter.createUpDownCounter(metricName),
              prevValue: 0,
            })),
          ),
          T.tap(({ counter, prevValue }) =>
            T.succeedWith(() => {
              const delta = value - prevValue
              counter.add(delta, attributes)
              metricCache.gauges.set(metricCacheName, { counter, prevValue: value })
            }),
          ),
        ),
      ),
    )
  }

// export const gauge =
//   (metricName: string, value: number, attributes?: OTMetrics.MetricAttributes) =>
//   <R, E, A>(effect: T.Effect<R, E, A>) => {
//     // NOTE this is currently used to keep separate gauges for each attribute value
//     const metricCacheName = metricName + '_' + JSON.stringify(attributes)
//     return pipe(
//       effect,
//       T.tap(() =>
//         pipe(
//           withMeter((meter) =>
//             getOrCreate(metricCache.gauges, metricCacheName, () => ({
//               observable: meter.createObservableGauge(metricName),
//               currentCallback: () => {},
//             })),
//           ),
//           T.tap(({ observable, currentCallback }) =>
//             T.succeedWith(() => {
//               observable.removeCallback(currentCallback)
//               const newCallback: OTMetrics.ObservableCallback = (observableResult) => {
//                 observableResult.observe(value, attributes)
//               }
//               observable.addCallback(newCallback)
//               metricCache.gauges.set(metricCacheName, { observable, currentCallback: newCallback })
//             }),
//           ),
//         ),
//       ),
//     )
//   }

const getOrCreate = <T>(map: Map<string, T>, name: string, create: () => T) => {
  const cached = map.get(name)
  if (cached) {
    return cached
  }
  const created = create()
  map.set(name, created)
  return created
}
