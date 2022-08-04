const debug = require('debug')('framecast');

/**
 * Config for the framecast
 */
export type FramecastConfig = {
  origin: string | null;
  channel: string | null;
  self: Window | null;
  functionTimeoutMs: number;
};

/**
 * Listener for broadcasts
 */
export type BroadcastEventListener = (this: Framecast, message: any) => void;

/**
 * Listener for function calls
 */
export type FunctionEventListener = (
  this: Framecast,
  ...args: any[]
) => Promise<any>;

/**
 * Map of the event keys and their listeners in a Set
 */
type ListenerMap = {
  broadcast: Set<BroadcastEventListener>;
  [event: `function:${string}`]: Set<FunctionEventListener>;
};

export class Framecast {
  /**
   * The element we are communicating with.
   */
  private target: Window;

  /**
   * Config for the framecast.
   */
  private config: FramecastConfig = {
    origin: null,
    channel: null,
    self: null,
    functionTimeoutMs: 10000,
  };

  /**
   * Listeners for messages and function calls
   */
  private listeners: ListenerMap = { broadcast: new Set() };

  /**
   * Map of pending function calls
   */
  private pendingFunctionCalls: Map<
    number,
    { timeout: number; resolve: Function; reject: Function }
  > = new Map();

  constructor(target: Window, config?: Partial<FramecastConfig>) {
    if (!target) {
      throw new Error(`Framecast must be initialized with a window object`);
    }

    this.target = target;
    this.config = { ...this.config, ...config };
    this.self.removeEventListener(
      'message',
      this.handlePostedMessage.bind(this)
    );
    this.self.addEventListener('message', this.handlePostedMessage.bind(this));
    debug('Created framecast');
  }

  /**
   * Get the origin of the target
   */
  get origin(): string {
    return this.config.origin ?? '*';
  }

  /**
   * Get the channel identifier
   */
  get channel(): string {
    return `__framecast${this.config.channel ? `_${this.config.channel}` : ''}`;
  }

  /**
   * Get the current window
   */
  get self(): Window {
    return this.config.self ?? window;
  }

  private postMessage(type: string, message: any) {
    debug('Sending message', type, { ...message, type, channel: this.channel });
    this.target.postMessage(
      JSON.parse(JSON.stringify({ ...message, type, channel: this.channel })),
      this.origin
    );
  }

  /**
   * Adds a listener for a given event.
   * @param eventType Event type.
   * @param listener Listener function.
   */
  on(eventType: keyof ListenerMap, listener: Function): void {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = new Set() as any;
    }

    // only allow one listener per function
    if (
      eventType.startsWith('function:') &&
      this.listeners[eventType].size !== 0
    ) {
      throw new Error(`Listener already exists for ${eventType}`);
    }

    debug(`Added listener for ${eventType}`);

    this.listeners[eventType].add(listener as any);
  }

  /**
   * Removes a listener for a given event.
   * @param eventType Event type.
   * @param listener Listener function.
   */
  off(eventType: keyof ListenerMap, listener: Function): void {
    if (this.listeners[eventType]) {
      debug(`Removed listener for ${eventType}`);
      this.listeners[eventType].delete(listener as any);
    }
  }

  /**
   * Sends an message
   *
   * Lifecycle
   * -----
   * self: broadcast() --->
   * target: handlePostedMessage() -> handleBroadcast()
   * @param data Message to send.
   */
  broadcast(data: any): void {
    this.postMessage('broadcast', { data });
  }

  /**
   * Calls a remote function and returns the result
   *
   * If we don't have a response within {this.config.functionTimeoutMs} seconds, we'll throw an error.
   *
   * Lifecycle
   * -----
   * self: call(): Promise --->
   * target: handlePostedMessage() -> handleFunctionCall() --->
   * self: handleFunctionResult() -> resolve/reject the original promise -> clearPendingFunctionCall()
   *
   * @param functionName The name of the function to call.
   * @param args Arguments to pass to the function.
   * @returns The result of the function.
   */
  async call<ReturnValue = any>(
    functionName: string,
    ...args: any[]
  ): Promise<ReturnValue> {
    const id = Date.now();

    if (!this.config.functionTimeoutMs) {
      throw new Error(
        `Framecast.call() requires a config.functionTimeoutMs to be set`
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.clearPendingFunctionCall(id);
        reject(
          new Error(
            `${functionName} timed out after ${this.config.functionTimeoutMs}ms`
          )
        );
      }, this.config.functionTimeoutMs);
      this.pendingFunctionCalls.set(id, { timeout, resolve, reject });
      this.postMessage(`function:${functionName}`, { id, args });
    });
  }

  /**
   * Handles the raw messages posted to the window
   * @param event The event that was posted to the window
   */
  private async handlePostedMessage(event: MessageEvent) {
    try {
      const data = event.data;
      if (this.origin !== '*' && event.origin !== this.origin) {
        debug('Origin did not match target', {
          origin: event.origin,
          target: this.config.origin,
        });
        return;
      }

      if (this.channel !== data.channel) {
        debug('Channel did not match target', {
          channel: data.channel,
          target: this.channel,
        });
        return;
      }

      debug('Received data', data);

      if (data.type === 'broadcast') {
        this.handleBroadcast(data.data);
      } else if (data.type === 'functionResult') {
        this.handleFunctionResult(data);
      } else if (data.type.startsWith('function:')) {
        this.handleFunctionCall(data.type, data.id, data.args);
      } else {
        debug('Unknown message type', data.type);
      }
    } catch (error) {
      debug('Could not handle message', event.data);
      debug(error);
    }
  }

  /**
   * Emit a broadcast to the listeners
   * @param data
   */
  private async handleBroadcast(data: any) {
    debug(`Emitting broadcast`);

    for (const listener of this.listeners['broadcast'] ?? []) {
      (listener as Function).apply(this, [data]);
    }
  }

  /**
   * Emit a function call to the listeners and return the result or error
   * @param eventType Event type.
   * @param args Arguments to pass to the listener.
   */
  private async handleFunctionCall(
    eventType: keyof ListenerMap,
    id: number,
    args: any[]
  ) {
    debug(`Calling ${eventType} with ${args?.length} arguments`);

    if (!this.listeners[eventType] || this.listeners[eventType].size === 0) {
      debug(`No listeners for ${eventType}, sending back error`);
      this.postMessage('functionResult', {
        id,
        error: new Error(`No listeners for ${eventType}`),
      });
      return;
    }

    try {
      let result;
      for (const listener of this.listeners[eventType] ?? []) {
        result = await (listener as Function).apply(this, args);
      }
      debug(`Sending back result for id: ${id}`, result);
      this.postMessage('functionResult', { id, result });
    } catch (error) {
      debug(`Error calling ${eventType}, sending back error`, error);
      this.postMessage('functionResult', { id, error });
      return;
    }
  }

  /**
   * Recieve a function result and resolve or reject the pending function call
   */
  private async handleFunctionResult(data: {
    type: 'functionResult';
    id: number;
    result?: any;
    error?: Error;
  }) {
    const pendingCall = this.pendingFunctionCalls.get(data.id);
    if (pendingCall) {
      debug('Received function result', data);
      this.clearPendingFunctionCall(data.id);
      if (data.error) {
        pendingCall.reject(data.error);
      } else {
        pendingCall.resolve(data.result);
      }
    } else {
      debug('Received function result for unknown id', data);
    }
  }

  /**
   * Clears a pending function call
   * @param id The id of the pending function call
   */
  private clearPendingFunctionCall(id: number) {
    const pendingCall = this.pendingFunctionCalls.get(id);
    if (pendingCall) {
      this.pendingFunctionCalls.delete(id);
      clearTimeout(pendingCall.timeout);
    }
  }
}
