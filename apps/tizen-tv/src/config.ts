export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function getAppConfig(): AppConfig {
  const raw = window.APP_CONFIG ?? {};
  return {
    supabaseUrl: (raw.supabaseUrl ?? "").trim(),
    supabaseAnonKey: (raw.supabaseAnonKey ?? "").trim(),
  };
}

export function isSupabaseConfigured(config: AppConfig = getAppConfig()): boolean {
  return config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;
}
