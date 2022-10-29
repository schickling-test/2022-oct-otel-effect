// ets_tracing: off

import * as T from '@effect-ts/core/Effect'
import * as L from '@effect-ts/core/Effect/Layer'
import * as M from '@effect-ts/core/Effect/Managed'
import { identity } from '@effect-ts/core/Function'
import { tag } from '@effect-ts/core/Has'
import * as OT from '@effect-ts/otel'
import type { SpanExporter } from '@opentelemetry/sdk-trace-base'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'

//
// Span Processor
//

export const BatchProcessorSymbol = Symbol()
export type BatchProcessorSymbol = typeof BatchProcessorSymbol

export interface BatchProcessor {
  readonly [BatchProcessorSymbol]: BatchProcessorSymbol
  readonly spanExporter: SpanExporter
  readonly spanProcessor: BatchSpanProcessor
}

export const makeBatchProcessor = <R, E, A extends SpanExporter>(exporter: M.Managed<R, E, A>) =>
  M.gen(function* ($) {
    const { tracerProvider } = yield* $(OT.TracerProvider)

    const spanExporter = yield* $(exporter)

    const spanProcessor = yield* $(
      T.succeedWith(
        () =>
          new BatchSpanProcessor(
            spanExporter,
            // TODO make this configurable
            {
              scheduledDelayMillis: 500,
              maxExportBatchSize: 5000,
              maxQueueSize: 10_000_000,
              exportTimeoutMillis: 1000 * 60 * 3, // 3 minutes
            },
          ),
      ),
    )

    yield* $(T.succeedWith(() => tracerProvider.addSpanProcessor(spanProcessor)))

    return identity<BatchProcessor>({
      [BatchProcessorSymbol]: BatchProcessorSymbol,
      spanExporter,
      spanProcessor,
    })
  })

export const BatchProcessorTag = tag<BatchProcessor>(BatchProcessorSymbol)

export const BatchProcessor = <R, E, A extends SpanExporter>(exporter: M.Managed<R, E, A>) =>
  L.fromManaged(BatchProcessorTag)(makeBatchProcessor(exporter))
