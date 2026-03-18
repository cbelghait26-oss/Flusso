import { registerRootComponent } from 'expo';
import { TurboModuleRegistry } from 'react-native';

// Firebase JS SDK calls NativeJSLogger.addListener() / NativeJSLogger.default.addListener()
// at module-init time before AppRegistry.registerComponent runs.
// On New Architecture the native module object is a Proxy/frozen object — we cannot mutate
// it in place, so we return a completely synthetic JS stub instead of the native module.
try {
  const _noop = () => {};
  const _stub = {
    addListener: _noop,
    removeListeners: _noop,
    // Firebase v12 accesses .default on the module reference
    get default() { return _stub; },
  };

  const _origGet = TurboModuleRegistry.get.bind(TurboModuleRegistry);
  const _origGetEnforcing = TurboModuleRegistry.getEnforcing.bind(TurboModuleRegistry);

  TurboModuleRegistry.get = function (name) {
    if (name === 'JSLogger') return _stub;
    return _origGet(name);
  };

  TurboModuleRegistry.getEnforcing = function (name) {
    if (name === 'JSLogger') return _stub;
    return _origGetEnforcing(name);
  };
} catch (_) {}

// Must use require (not import) so this executes AFTER the polyfill above.
// ES module `import` statements are hoisted and would load Firebase before the patch.
const App = require('./App').default;

registerRootComponent(App);
