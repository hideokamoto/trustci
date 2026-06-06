import { spawnSync } from "node:child_process";

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a command capturing its output. Uses an argument array (never a shell
 * string) so values are passed safely without quoting concerns.
 */
export function run(cmd: string, args: string[]): RunResult {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  return {
    status: res.status ?? (res.error ? 1 : 0),
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

/**
 * Run a command inheriting stdio so the user sees live output. Returns the
 * exit status.
 */
export function runInherit(cmd: string, args: string[]): number {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  return res.status ?? (res.error ? 1 : 0);
}
