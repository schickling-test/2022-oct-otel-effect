export * from '@effect-ts/otel'
import { Effect as T, Managed as M, Option as O, pipe } from '@effect-ts/core'
import * as Tp from '@effect-ts/core/Collections/Immutable/Tuple'
import { pretty } from '@effect-ts/core/Effect/Cause/Pretty'
import type * as RM from '@effect-ts/core/Effect/Managed/ReleaseMap'
import type { Has } from '@effect-ts/core/Has'
import * as OT from '@effect-ts/otel'
import * as OTApi from '@opentelemetry/api'

export type { HasMeter } from './Tracing/lib-metrics/Meter.js'
export * from './Tracing/lib-metrics/Metric.js'
export * from './Tracing/lib-metrics/Meter.js'

export const requireParentSpan = <R, E, A>(
  effect: T.Effect<R & Has<OT.Span>, E, A>,
): T.Effect<R & Has<OT.Span>, E, A> => effect

export const activeSpanContext: T.Effect<Has<OT.Span>, never, OTApi.SpanContext> = T.accessService(OT.Span)((_) =>
  _.span.spanContext(),
)

const inProgressSpans = new Set<OTApi.Span>()

export const endInProgressSpans = T.succeedWith(() => {
  inProgressSpans.forEach((span) => span.end())
  inProgressSpans.clear()
})

export const withSpan =
  (name: string, options?: OTApi.SpanOptions, ctx?: OTApi.Context) =>
  <R, E, A>(effect: T.Effect<R & HasSpan, E, A>): T.Effect<R & OT.HasTracer, E, A> =>
    pipe(
      T.bracket_(
        T.accessServiceM(OT.Span)(({ span }) =>
          T.succeedWith(() => {
            inProgressSpans.add(span)
            return span
          }),
        ),
        () => effect,
        (span) =>
          T.succeedWith(() => {
            inProgressSpans.delete(span)
          }),
      ),
      OT.withSpan(name, options, ctx),
    )

export const withSpanEff = <R2>(name: string, optionsEff: T.Effect<R2 & HasSpan, never, OTApi.SpanOptions>) => {
  return <R, E, A>(effect: T.Effect<R & Has<OT.Span>, E, A>): T.Effect<R & R2 & Has<OT.Tracer>, E, A> => {
    return pipe(
      effect,
      T.tap(() =>
        pipe(
          optionsEff,
          T.tap((options) => (options.attributes ? addAttributes(options.attributes) : T.unit)),
        ),
      ),
      OT.withSpan(name),
    )
  }
}

export const addAttributes = (attributes: OTApi.Attributes) => {
  return T.accessServiceM(OT.Span)((_) =>
    T.succeedWith(() => {
      _.span.setAttributes(attributes)
    }),
  )
}

export type HasSpan = Has<OT.Span>

// NOTE this is the same as the commented version below, except it keeps track of `inProgressSpans`
export const withAcquireSpan =
  (name: string, options?: OTApi.SpanOptions, ctx?: OTApi.Context) =>
  <R, E, A>(managed: M.Managed<R & Has<OT.Span>, E, A>): M.Managed<R & Has<OT.Tracer>, E, A> => {
    return new M.ManagedImpl(
      T.bracketExit_(
        pipe(
          T.access(({ tuple: [r] }: Tp.Tuple<[R & Has<OT.Tracer>, RM.ReleaseMap]>) => {
            const { tracer } = OT.Tracer.read(r)
            const maybeSpan = OT.Span.readOption(r)
            if (ctx) {
              return tracer.startSpan(name, options, ctx)
            }
            if (options?.root !== true && O.isSome(maybeSpan)) {
              const ctx = OTApi.trace.setSpan(OTApi.context.active(), maybeSpan.value.span)
              return tracer.startSpan(name, options, ctx)
            }
            return tracer.startSpan(name, { ...options, root: true })
          }),
          T.tap((span) => T.succeedWith(() => inProgressSpans.add(span))),
        ),
        (span) =>
          T.provideSome_(managed.effect, ({ tuple: [rest, rm] }: Tp.Tuple<[R & Has<OT.Tracer>, RM.ReleaseMap]>) =>
            Tp.tuple({ ...rest, ...OT.Span.has(new OT.SpanImpl(span)) }, rm),
          ),
        (s, e) =>
          T.succeedWith(() => {
            if (e._tag === 'Failure') {
              s.setAttribute('error.type', 'Fiber Failure')
              s.setAttribute('error.message', 'An Effect Has A Failure')
              s.setAttribute('error.stack', pretty(e.cause))
              s.setStatus({ code: OTApi.SpanStatusCode.ERROR })
            } else {
              s.setStatus({ code: OTApi.SpanStatusCode.OK })
            }
            s.end()
            inProgressSpans.delete(s)
          }),
      ),
    )
  }

// export const withAcquireSpan =
//   (name: string, options?: OTApi.SpanOptions, ctx?: OTApi.Context) =>
//   <R, E, A>(managed: M.Managed<R & Has<OT.Span>, E, A>): M.Managed<R & Has<OT.Tracer>, E, A> => {
//     return new M.ManagedImpl(
//       T.bracketExit_(
//         T.access(({ tuple: [r] }: Tp.Tuple<[R & Has<OT.Tracer>, RM.ReleaseMap]>) => {
//           const { tracer } = OT.Tracer.read(r)
//           const maybeSpan = OT.Span.readOption(r)
//           if (ctx) {
//             return tracer.startSpan(name, options, ctx)
//           }
//           if (options?.root !== true && O.isSome(maybeSpan)) {
//             const ctx = OTApi.trace.setSpan(OTApi.context.active(), maybeSpan.value.span)
//             return tracer.startSpan(name, options, ctx)
//           }
//           return tracer.startSpan(name, { ...options, root: true })
//         }),
//         (span) =>
//           T.provideSome_(managed.effect, ({ tuple: [rest, rm] }: Tp.Tuple<[R & Has<OT.Tracer>, RM.ReleaseMap]>) =>
//             Tp.tuple({ ...rest, ...OT.Span.has(new OT.SpanImpl(span)) }, rm),
//           ),
//         (s, e) =>
//           T.succeedWith(() => {
//             if (e._tag === 'Failure') {
//               s.setAttribute('error.type', 'Fiber Failure')
//               s.setAttribute('error.message', 'An Effect Has A Failure')
//               s.setAttribute('error.stack', pretty(e.cause))
//               s.setStatus({ code: OTApi.SpanStatusCode.ERROR })
//             } else {
//               s.setStatus({ code: OTApi.SpanStatusCode.OK })
//             }
//             s.end()
//           }),
//       ),
//     )
//   }
