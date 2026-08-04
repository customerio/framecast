import { Framecast } from '../src';

type MessageListener = (event: MessageEvent) => void;

type StubWindow = Window & { messageListeners: Set<MessageListener> };

function createStubWindow(): StubWindow {
  const messageListeners = new Set<MessageListener>();

  return {
    messageListeners,
    addEventListener(type: string, listener: MessageListener) {
      if (type === 'message') {
        messageListeners.add(listener);
      }
    },
    removeEventListener(type: string, listener: MessageListener) {
      if (type === 'message') {
        messageListeners.delete(listener);
      }
    },
    postMessage: jest.fn(),
  } as unknown as StubWindow;
}

beforeAll(() => {
  // `call()` schedules its timeout via `window.setTimeout`; provide a window
  // global since the tests run in a node environment.
  (globalThis as any).window = globalThis;
});

afterAll(() => {
  delete (globalThis as any).window;
});

describe('Framecast', () => {
  describe('destroy', () => {
    it('adds a single message listener to self on construction', () => {
      const self = createStubWindow();
      const target = createStubWindow();

      new Framecast(target, { self });

      expect(self.messageListeners.size).toBe(1);
    });

    it('removes the message listener added on construction', () => {
      const self = createStubWindow();
      const target = createStubWindow();

      const framecast = new Framecast(target, { self });
      framecast.destroy();

      expect(self.messageListeners.size).toBe(0);
    });

    it('does not accumulate window listeners across create/destroy cycles', () => {
      const self = createStubWindow();

      for (let i = 0; i < 5; i++) {
        const framecast = new Framecast(createStubWindow(), { self });
        framecast.destroy();
      }

      expect(self.messageListeners.size).toBe(0);
    });

    it('rejects pending function calls and clears their timeouts', async () => {
      const self = createStubWindow();
      const target = createStubWindow();
      const framecast = new Framecast(target, {
        self,
        functionTimeoutMs: 20,
      });

      const rejected = jest.fn();
      framecast.call('anything').catch(rejected);

      framecast.destroy();
      await new Promise((resolve) => setTimeout(resolve, 60));

      // rejected once by destroy, not a second time by the call timeout
      expect(rejected).toHaveBeenCalledTimes(1);
      expect(rejected).toHaveBeenCalledWith(new Error('Framecast destroyed'));
    });

    it('releases the target window and makes postMessage a no-op', () => {
      const self = createStubWindow();
      const target = createStubWindow();
      const framecast = new Framecast(target, { self });

      framecast.destroy();
      framecast.broadcast({ hello: 'world' });

      expect(target.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('messages', () => {
    it('parent-> child: broadcast and recieve messages', () => {});

    it('child -> parent: broadcast and recieve messages', () => {});

    it('broadcast and recieve messages supports multiple listeners', () => {});

    it('can turn off listeners', () => {});
  });

  describe('security', () => {
    it('prevents messages being sent to the wrong origin', () => {});

    it('prevents messages being received from the wrong origin', () => {});

    it('prevents messages being received from the wrong channel', () => {});
  });

  describe('functions', () => {
    it('parent-> child: call a function', () => {});

    it('parent-> child: call a function with arguments', () => {});

    it('child -> parent: call a function', () => {});

    it('child -> parent: call a function with arguments', () => {});

    it('only support one function handler', () => {});

    it('can turn off function handler', () => {});

    it('times out after 10 seconds', () => {});

    it('times out after 20 seconds', () => {});
  });
});
