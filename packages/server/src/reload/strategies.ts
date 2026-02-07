export type ReloadStrategy = 'hmr' | 'full' | 'none';

export interface FrameworkInfo {
  name: string;
  reloadStrategy: ReloadStrategy;
}

export const FRAMEWORK_STRATEGIES: Record<string, FrameworkInfo> = {
  next: {
    name: 'Next.js',
    reloadStrategy: 'hmr',
  },
  vite: {
    name: 'Vite',
    reloadStrategy: 'hmr',
  },
  'create-react-app': {
    name: 'Create React App',
    reloadStrategy: 'hmr',
  },
  astro: {
    name: 'Astro',
    reloadStrategy: 'hmr',
  },
  remix: {
    name: 'Remix',
    reloadStrategy: 'hmr',
  },
  svelte: {
    name: 'SvelteKit',
    reloadStrategy: 'hmr',
  },
  vue: {
    name: 'Vue',
    reloadStrategy: 'hmr',
  },
};
