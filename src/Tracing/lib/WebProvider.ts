// ets_tracing: off

import { pipe } from '@effect-ts/core'
import * as T from '@effect-ts/core/Effect'
import * as L from '@effect-ts/core/Effect/Layer'
import * as M from '@effect-ts/core/Effect/Managed'
import { identity } from '@effect-ts/core/Function'
import { tag } from '@effect-ts/core/Has'
import * as O from '@effect-ts/core/Option'
import * as OT from '@effect-ts/otel'
import type { WebTracerConfig } from '@opentelemetry/sdk-trace-web'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'

const WebTracerProviderConfigSymbol = Symbol()

export interface WebTracerProviderConfig {
  readonly config: WebTracerConfig
}

export const WebTracerProviderConfig = tag<WebTracerProviderConfig>(WebTracerProviderConfigSymbol)

export const LiveWebTracerProviderConfig = (config: WebTracerConfig) => L.fromValue(WebTracerProviderConfig)({ config })

export const makeWebTracingProvider = M.gen(function* (_) {
  const env = yield* _(T.environment())
  const config = pipe(
    WebTracerProviderConfig.readOption(env),
    O.map((_) => _.config),
    O.toUndefined,
  )
  const tracerProvider = yield* _(T.succeedWith(() => new WebTracerProvider(config)))

  return identity<OT.TracerProvider>({
    [OT.TracerProviderSymbol]: OT.TracerProviderSymbol,
    tracerProvider,
  })
})

export const WebProviderLayer = L.fromManaged(OT.TracerProvider)(makeWebTracingProvider)

export const WebProvider = (config?: WebTracerConfig) =>
  config ? WebProviderLayer['<<<'](LiveWebTracerProviderConfig(config)) : WebProviderLayer
