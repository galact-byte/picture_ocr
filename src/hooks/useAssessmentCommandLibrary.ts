import { useCallback, useEffect, useState } from 'react';
import { COMMAND_STORAGE_KEY, readCommandChanges, resolveCommandProfiles } from '../utils/assessmentCommandStore';
import { COMMAND_BINDINGS_KEY, readCommandBindings } from '../utils/assessmentCommandBindings';
import { COMMAND_DEFAULTS_KEY, readCommandDefaults } from '../utils/assessmentCommandDefaults';
import type { CommandDefaults } from '../utils/assessmentCommandDefaults';
import type { CommandBindings } from '../utils/assessmentCommandBindings';

function load() {
  let libraryError = '', bindingsError = '', bindings: CommandBindings = {};
  let defaults: CommandDefaults = { categories: {}, assets: {} }, defaultsError = '';
  let profiles = resolveCommandProfiles([]);
  try { profiles = resolveCommandProfiles(readCommandChanges()); }
  catch { libraryError = '自定义命令库读取失败，已关联命令暂不显示，请打开命令库检查。'; }
  try { bindings = readCommandBindings(); }
  catch { bindingsError = '检查项命令关联读取失败，原内容已保留，暂时无法修改关联。'; }
  try { defaults = readCommandDefaults(); }
  catch { defaultsError = '默认命令平台读取失败，原配置已保留，暂时无法使用或修改默认平台。'; }
  return { profiles, libraryError, bindings, bindingsError, defaults, defaultsError };
}
export function useAssessmentCommandLibrary() {
  const [state, setState] = useState(load);
  const refresh = useCallback(() => setState(load()), []);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === null || event.key === COMMAND_STORAGE_KEY || event.key === COMMAND_BINDINGS_KEY || event.key === COMMAND_DEFAULTS_KEY) refresh(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [refresh]);
  return { ...state, refresh };
}
