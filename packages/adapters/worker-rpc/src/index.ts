/**
 * Proxy genérico de servicios sobre postMessage (ARCHITECTURE §5).
 * La interfaz llama a `services.modulo.metodo(...)` y el Worker ejecuta el mismo
 * método en su implementación local. Añadir un método no exige código nuevo aquí.
 */

export interface RpcPort {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

interface RpcRequest {
  id: number;
  method: string;
  args: unknown[];
}

type RpcResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

type Method = (...args: never[]) => Promise<unknown>;
export type Handlers = Record<string, Record<string, Method>>;

/** Lado del Worker: atiende las peticiones con los servicios locales. */
export function serve(port: RpcPort, handlers: Handlers): void {
  port.addEventListener('message', (event) => {
    const req = event.data as RpcRequest;
    const [group, name] = req.method.split('.');
    const fn = group && name ? handlers[group]?.[name] : undefined;
    const reply = (res: RpcResponse) => port.postMessage(res);
    if (!fn) {
      reply({ id: req.id, ok: false, error: `Método desconocido: ${req.method}` });
      return;
    }
    (fn as (...args: unknown[]) => Promise<unknown>)(...req.args).then(
      (value) => reply({ id: req.id, ok: true, value }),
      (err: unknown) => reply({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
  });
}

/** Lado de la interfaz: devuelve un objeto con la forma de `Services`. */
export function connect<T extends object>(port: RpcPort): T {
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  port.addEventListener('message', (event) => {
    const res = event.data as RpcResponse;
    const call = pending.get(res.id);
    if (!call) return;
    pending.delete(res.id);
    if (res.ok) call.resolve(res.value);
    else call.reject(new Error(res.error));
  });

  const call = (method: string, args: unknown[]) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      port.postMessage({ id, method, args } satisfies RpcRequest);
    });

  // Siempre el mismo objeto para cada servicio y método: la interfaz los usa como dependencias
  // de React, y uno nuevo en cada acceso repetiría las peticiones en cada pintado.
  const groups = new Map<PropertyKey, object>();
  const group = (key: PropertyKey) => {
    const methods = new Map<PropertyKey, (...args: unknown[]) => Promise<unknown>>();
    return new Proxy({}, {
      get: (_t, name) => {
        let method = methods.get(name);
        if (!method) {
          method = (...args: unknown[]) => call(`${String(key)}.${String(name)}`, args);
          methods.set(name, method);
        }
        return method;
      },
    });
  };
  return new Proxy({} as T, {
    get: (_target, key) => {
      let g = groups.get(key);
      if (!g) {
        g = group(key);
        groups.set(key, g);
      }
      return g;
    },
  });
}
