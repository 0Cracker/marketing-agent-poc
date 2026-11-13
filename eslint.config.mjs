import {defineConfig,globalIgnores} from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
export default defineConfig([
 globalIgnores(['dist/**','node_modules/**','.next/**','.vinext/**','work/**','archive/**','.tools/**','outputs/**','.sites-runtime/**','.wrangler/**','coverage/**','.agent-state/**']),
 {files:['**/*.{js,cjs,mjs}'],...js.configs.recommended,languageOptions:{globals:{...globals.node,...globals.browser}},rules:{'no-unused-vars':['warn',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},
 ...tseslint.configs.recommended,
 {files:['**/*.{js,cjs,mjs}'],rules:{'@typescript-eslint/no-unused-vars':['warn',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},
 {files:['**/*.{ts,tsx,mts}'],languageOptions:{globals:{...globals.node,...globals.browser}},rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['warn',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},
 {files:['frontend/**/*.{ts,tsx}'],plugins:{'react-hooks':hooks},rules:{'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'warn'}}
]);
