/// <reference types="vite/client" />
declare const __PROTOTYPE__: boolean;
declare const __BUILD_DATE__: string;
declare module 'virtual:seed' {
  import type { SeedFile } from './model/types';
  const seed: SeedFile | null;
  export default seed;
}
