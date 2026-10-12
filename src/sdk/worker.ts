import type { HostToWorker, WorkerToHost } from './protocol'
/// <reference lib="webworker" />
import { CFG } from '../config'
import { SdkError } from './sdkError'
import { createSdk } from './workerSdk'

const workerScope = globalThis as unknown as Worker

let sandbox: ReturnType<typeof createSdk> | null = null

/** 把沙箱内的 console.* 路由到编辑器控制台面板：玩家代码里 console.log 与 sdk.log 等效（限流防刷屏） */
function installConsoleBridge(): void {
  const consoleScope = globalThis as { console: Console }
  const native = {
    log: consoleScope.console.log.bind(consoleScope.console),
    warn: consoleScope.console.warn.bind(consoleScope.console),
    error: consoleScope.console.error.bind(consoleScope.console),
  }
  let windowStart = 0
  let count = 0
  const fmt = (a: unknown): string => {
    if (typeof a === 'string')
      return a
    try {
      return JSON.stringify(a)
    }
    catch {
      return String(a)
    }
  }
  const route = (level: 'info' | 'warn' | 'error', sink: (...a: unknown[]) => void) =>
    (...args: unknown[]): void => {
      sink(...args)
      const now = Date.now()
      if (now - windowStart >= 1000) {
        windowStart = now
        count = 0
      }
      if (count >= CFG.maxLogsPerSecond)
        return
      count++
      workerScope.postMessage({ type: 'log', text: args.map(fmt).join(' '), level } satisfies WorkerToHost)
    }
  consoleScope.console = {
    ...consoleScope.console,
    debug: route('info', native.log),
    info: route('info', native.log),
    log: route('info', native.log),
    warn: route('warn', native.warn),
    error: route('error', native.error),
  } as Console
}

workerScope.onmessage = (ev: MessageEvent<HostToWorker>) => {
  const msg = ev.data
  try {
    switch (msg.type) {
      case 'init': {
        sandbox = createSdk(m => workerScope.postMessage(m))
        installConsoleBridge()
        // 在沙箱中执行玩家代码：只有 sdk 一个入参，无 DOM/window
        // eslint-disable-next-line no-new-func
        const fn = new Function('sdk', `"use strict";\n${msg.code}`)
        fn(sandbox.sdk)
        sandbox.fireInit()
        workerScope.postMessage({ type: 'ready' } satisfies WorkerToHost)
        break
      }
      case 'tick': {
        sandbox?.handleTick(msg.dt, msg.snapshot)
        break
      }
      case 'inputEvents': {
        sandbox?.handleEvents(msg.events)
        break
      }
      case 'sdkEvents': {
        for (const e of msg.events) sandbox?.fireSdkEvent(e)
        break
      }
      case 'destroy': {
        sandbox?.fireDestroy()
        sandbox = null
        break
      }
    }
  }
  catch (err) {
    // init 阶段错误为致命（代码没有跑起来）；运行时错误交给宿主计数处理
    // SdkError 只上报错误码 + 参数（文案由宿主按当前语言渲染）；
    // 玩家代码自己抛的异常仍按原文 + 堆栈上报，那是有用的调试信息
    const sdkErr = err instanceof SdkError ? err : null
    workerScope.postMessage({
      type: 'error',
      message: sdkErr ? sdkErr.message : err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err),
      key: sdkErr?.key,
      args: sdkErr?.args,
      fatal: !sandbox,
    } satisfies WorkerToHost)
  }
}
