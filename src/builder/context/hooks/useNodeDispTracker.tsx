// hooks/useNodeDispTracker.ts
export function createTrackedNodeDispatcher(
  dispatcher: any,
  onOperation: (op: Operation) => void,
  shouldTrack = true
) {
  if (!shouldTrack) return dispatcher;

  const tracked = {} as any;

  // Get ALL methods, including the ones from prototype chain
  const getAllMethods = (obj: any): string[] => {
    let methods: string[] = [];
    let currentObj = obj;

    while (currentObj && currentObj !== Object.prototype) {
      methods = methods.concat(
        Object.getOwnPropertyNames(currentObj).filter(
          (name) =>
            name !== "constructor" && typeof currentObj[name] === "function"
        )
      );
      currentObj = Object.getPrototypeOf(currentObj);
    }

    return [...new Set(methods)]; // Remove duplicates
  };

  const methods = getAllMethods(dispatcher);

  // Copy original methods and properties
  methods.forEach((method) => {
    const originalMethod = dispatcher[method];
    tracked[method] = function (...args: any[]) {
      // Get the result first
      const result = originalMethod.apply(dispatcher, args);

      // Skip tracking for certain repetitive methods
      const skipTrackingFor = [""];
      if (skipTrackingFor.includes(method)) {
        return result;
      }

      // Extract options if present
      const lastArg = args[args.length - 1];
      const options =
        typeof lastArg === "object" && !Array.isArray(lastArg)
          ? lastArg
          : undefined;

      // Track the operation
      requestAnimationFrame(() => {
        onOperation({
          method,
          timestamp: Date.now(),
          args: args.map((arg) =>
            typeof arg === "object"
              ? { id: arg.id, type: arg.type } // Only track essential properties
              : arg
          ),
          options,
        });
      });

      return result;
    };
  });

  // Add any properties that aren't functions
  Object.getOwnPropertyNames(dispatcher).forEach((prop) => {
    if (typeof dispatcher[prop] !== "function") {
      tracked[prop] = dispatcher[prop];
    }
  });

  return tracked;
}
