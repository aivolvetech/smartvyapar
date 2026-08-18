// Mock electron require calls for CLI testing runner
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'electron') {
    return {
      app: {
        isPackaged: false,
        getVersion: () => '0.1.0',
        getPath: (name: string) => {
          const path = require('path');
          if (name === 'userData') {
            return path.join(process.cwd(), 'test-data', 'userData');
          }
          return process.cwd();
        }
      }
    };
  }
  return originalRequire.apply(this, arguments);
};
