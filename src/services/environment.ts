export interface TextualFeatureState {
  features: ReadonlySet<string>;
  devtools: { enabled: true } | null;
  debug: boolean;
}

export type EnvironmentMap = Record<string, string | undefined>;

export function parseTextualFeatures(value = ""): TextualFeatureState {
  const features = new Set(
    value
      .split(",")
      .map((feature) => feature.trim())
      .filter((feature) => feature.length > 0),
  );
  const devtools = features.has("devtools") ? { enabled: true as const } : null;

  return {
    features,
    devtools,
    debug: devtools !== null && features.has("debug"),
  };
}

export function getEnvironInt(
  env: EnvironmentMap,
  name: string,
  defaultValue: number,
  options: { minimum?: number } = {},
): number {
  const parsed = Number.parseInt(env[name] ?? "", 10);
  const value = Number.isFinite(parsed) ? parsed : defaultValue;
  return options.minimum === undefined ? value : Math.max(options.minimum, value);
}

export function getEnvironBool(env: EnvironmentMap, name: string): boolean {
  return env[name] === "1";
}

export function getEnvironPort(env: EnvironmentMap, name: string, defaultValue: number): number {
  const parsed = getEnvironInt(env, name, defaultValue);
  return parsed >= 0 && parsed <= 65535 ? parsed : defaultValue;
}

export function _get_environ_int(
  name: string,
  defaultValue: number,
  minimum?: number,
  env: EnvironmentMap = process.env,
): number {
  // [LAW:single-enforcer] Environment parsing lives in this module; compatibility
  // helpers delegate here so process.env interpretation cannot diverge.
  return getEnvironInt(env, name, defaultValue, { minimum });
}

export function _get_environ_bool(name: string, env: EnvironmentMap = process.env): boolean {
  return getEnvironBool(env, name);
}

export function _get_environ_port(name: string, defaultValue: number, env: EnvironmentMap = process.env): number {
  return getEnvironPort(env, name, defaultValue);
}
