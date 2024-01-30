<h1 align="center">framecast</h1>

<p align="center">
TypeScript cross-frame communication library.
</p>

<p align="center">
<a href="https://npmjs.com/package/framecast">
<img alt="npm" src="https://img.shields.io/npm/v/framecast">
<img alt="npm" src="https://img.shields.io/npm/dw/framecast">
<img alt="NPM" src="https://img.shields.io/npm/l/framecast">
</a>
</p>

## Installation

Framecast is available on [npm](https://www.npmjs.com/package/framecast), you can install it with either npm or yarn:

```sh
npm install framecast
# or:
yarn install framecast
```

## Broadcasts

Broadcasts allow you to send one-way communications. The `broadcast` event is emitted when a valid broadcast is received.

You can add many listeners to the `broadcast` event.

The only argument contains an object with a deserialized message. All data sent via framecast must be valid JSON.

### Example

###### Parent

```ts
import { Framecast } from 'framecast';

const target = document.querySelector('iframe').contentWindow;
const framecast = new Framecast(target);

framecast.on('broadcast', (message: any) => {
  console.log(message);
});
```

###### Child

```ts
import { Framecast } from 'framecast';

const target = window.parent;
const framecast = new Framecast(target);

framecast.broadcast('Hello world');
```

## Functions

Framecast allows you to call functions across frames. The `function:*` event is emitted when the call is made. The returned value of the listener is passed back to the calling frame.

Note, unlike the `broadcast` event, `function:*` events can only have one listener. All data sent via framecast must be valid JSON.

### Creating a function

Create a function by adding a listener for the `function:*` event where `*` is the name of the function. So in the example below the function name is `getElementId` so we name the event `function:getElementId`.

###### Child

```ts
import { Framecast } from 'framecast';

const target = window.parent;
const framecast = new Framecast(target);

framecast.on('function:getElementId', (selector) => {
  return document.querySelector(selector).getAttribute('id');
});
```

### Calling a function

To call the function from another frame, we use `call`. Note, that all functions return a promise, even if the handler on the other end is a synchronous function.

###### Parent

```ts
import { Framecast } from 'framecast';

const target = document.querySelector('iframe').contentWindow;
const framecast = new Framecast(target);

const bodyId = await framecast.call('getElementId', 'body');
```

### Handling errors

You handle errors the exact same way as if the function was in the same frame. Wrap the function call in a try/catch.

```ts
try {
  const bodyId = await framecast.call('getElementId', 'body');
} catch (error) {
  console.log('Something went wrong', error);
}
```

By default Framecast will throw an error if the handler take more than 10 seconds to complete. You can customize this with the `config.functionTimeoutMs` option.

## Shared State

Framecast has support for shared state between the parent and child frames. This is done by using [`nanostores`](http://github.com/nanostores/nanostores).

Each state is an [`atom`](https://github.com/nanostores/nanostores#atoms) and can be subscribed to. When the state is updated in one frame it will be updated in the other frame.

### Creating shared state

You can create a shared state by calling `state` on the framecast instance. The first argument is the name of the state and the second is the initial value.

```ts
const $counter = framecast.state('counter', 0);

$counter.subscribe((value) => {
  console.log('counter', value);
});
```

On initial creation the state will be set to the initial value. If the state already exists in the other frame will be synced to the value of the other frame.

**Note: you must subscribe to the state to mount it.**

### Example

In the following example when either the parent or child frame updates the `$counter` the other frame will be updated.

The implmentation is identical in both the parent and child frames.

###### Child

```ts
import { Framecast } from 'framecast';

const framecast = new Framecast(window.parent);

const $counter = framecast.state('counter', 0);

$counter.subscribe((value) => {
  console.log('counter', value);
});

document.querySelector('button').addEventListener('click', () => {
  $counter.set($counter.get() + 1);
});
```

###### Parent

```ts
import { Framecast } from 'framecast';
import { persistentAtom, setPersistentEngine } from '@nanostores/persistent';

const framecast = new Framecast(document.querySelector('iframe').contentWindow);

$counter.subscribe((value) => {
  console.log('counter', value);
});
```

## Evaluating arbitrary code

Framecast has a built-in function named `evaluate`. This evaluates the given function in the context of the target window.

The framecast instance in the child must opt-in to this feature by setting `config.supportEvaluate` to `true`. Doing so comes with all of the security risks of `eval()` so think carefully before enabling this.

This was inspired by playwright's [evaluate](https://playwright.dev/docs/evaluating) function.

###### Child

```ts
import { Framecast } from 'framecast';

const target = window.parent;
const framecast = new Framecast(target, { supportEvaluate: true });
```

###### Parent

```ts
import { Framecast } from 'framecast';

const target = document.querySelector('iframe').contentWindow;
const framecast = new Framecast(target);

const bodyId = await framecast.evaluate(() =>
  document.querySelector('body').getAttribute('id')
);
```

### Passing arguments

You can pass arguments to the function by passing them as additional arguments to `evaluate`. Arguments can be any [Serializable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#description) values.

```ts
import { Framecast } from 'framecast';

const target = document.querySelector('iframe').contentWindow;
const framecast = new Framecast(target);

const bodyId = await framecast.evaluate(
  (selector) => document.querySelector(selector).getAttribute('id'),
  'body'
);
```

## API

```ts
constructor(target: Window, config: FramecastConfig);


// broadcasts
on(type: 'broadcast', listener: (message: any) => void);
off(type: 'broadcast', listener: (message: any) => void);
broadcast(message: any);

// functions
on(type: `function:${string}`, listener: (...args: any[]) => void);
off(type: `function:${string}`, listener: (...args: any[]) => void);
call(type: `function:${string}`, ...args: any[]) => Promise<any>;


// evaluate
evaluate<ReturnType = any>(fn: (...args: any[]) => ReturnType, ...args: any[]) => Promise<ReturnType>;


type FramecastConfig = {
  origin: string | null;
  channel: string | null;
  self: Window | null;
  functionTimeoutMs: number;
  supportEvaluate: boolean;
};
```

Inspired by [Tabcast](https://github.com/mat-sz/tabcast)
