import { afterEach, describe, expect, it } from 'vitest';
import { connect, serve } from './index';

interface TestServices {
  math: { add(a: number, b: number): Promise<number>; fail(): Promise<never> };
}

const channels: MessageChannel[] = [];
afterEach(() => channels.splice(0).forEach((c) => (c.port1.close(), c.port2.close())));

function pair() {
  const channel = new MessageChannel();
  channels.push(channel);
  channel.port1.start();
  channel.port2.start();
  return channel;
}

describe('worker-rpc', () => {
  it('llama a un método remoto y devuelve su resultado', async () => {
    const { port1, port2 } = pair();
    serve(port2, { math: { add: async (a: number, b: number) => a + b, fail: async () => { throw new Error('no'); } } });
    const services = connect<TestServices>(port1);
    await expect(services.math.add(2, 3)).resolves.toBe(5);
  });

  it('propaga los errores con su mensaje', async () => {
    const { port1, port2 } = pair();
    serve(port2, { math: { add: async () => 0, fail: async () => { throw new Error('Falta el NIF'); } } });
    const services = connect<TestServices>(port1);
    await expect(services.math.fail()).rejects.toThrow('Falta el NIF');
  });

  it('rechaza métodos que no existen', async () => {
    const { port1, port2 } = pair();
    serve(port2, {});
    const services = connect<TestServices>(port1);
    await expect(services.math.add(1, 1)).rejects.toThrow('Método desconocido: math.add');
  });

  it('devuelve siempre el mismo objeto por servicio y método (dependencias estables en React)', () => {
    const { port1 } = pair();
    const services = connect<TestServices>(port1);
    expect(services.math).toBe(services.math);
    expect(services.math.add).toBe(services.math.add);
  });
});
