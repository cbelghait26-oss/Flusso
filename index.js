import { registerRootComponent } from 'expo';
import { TurboModuleRegistry } from 'react-native';

// Firebase JS SDK v12 calls NativeJSLogger.addListener() at module-init time.
// On Legacy Architecture the native stub may not expose addListener, crashing
// before AppRegistry.registerComponent runs. Guard it here via the public API.
try {
  const jsLogger = TurboModuleRegistry.get('JSLogger');
  if (jsLogger && typeof jsLogger.addListener !== 'function') {
    jsLogger.addListener = () => {};
    jsLogger.removeListeners = () => {};
  }
} catch (_) {}

// Must use require (not import) so this executes AFTER the polyfill above.
// ES module `import` statements are hoisted and would load Firebase before the patch.
const App = require('./App').default;

registerRootComponent(App);
