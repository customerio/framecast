import { Framecast } from '../src';

describe('Framecast', () => {
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
