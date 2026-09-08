// Teaches Node to resolve extensionless relative imports to the .ts file next
// to them, the way Angular code writes them:
//
//   import { TransactionsRepository } from './transactions.repository';
//
// Node's ESM resolver wants an extension. Rather than making the app code less
// idiomatic to suit the test runner, the test runner learns the convention.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/<file>.test.mjs
//
// Note that a bare "does it have a dot" check is not good enough:
// `./transactions.repository` ends in something that looks like an extension
// but is part of the file name.

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KNOWN_EXTENSIONS = /\.(ts|mts|cts|tsx|js|mjs|cjs|jsx|json|node|css|html|sql)$/i;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');

    if (isRelative && !KNOWN_EXTENSIONS.test(specifier) && context.parentURL) {
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          if (existsSync(fileURLToPath(new URL(candidate, context.parentURL)))) {
            return nextResolve(candidate, context);
          }
        } catch {
          // A specifier that will not form a URL is not ours to fix.
        }
      }
    }

    return nextResolve(specifier, context);
  },
});
