let listeners = [];

export function subscribe(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function showDialog(opts) {
  return new Promise((resolve) => {
    const dispatch = listeners[0];
    if (!dispatch) {
      console.warn('[dialog] no host mounted; falling back', opts);
      resolve(false);
      return;
    }
    dispatch({ opts, resolve });
  });
}
