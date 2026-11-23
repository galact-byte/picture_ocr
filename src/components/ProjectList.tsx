import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ProjectDocument, ProjectGroup, ProjectGroupSummary, ProjectMeta, ProjectPreset, ProjectSummary } from '../types';
import {
  createProjectGroupWithSystems,
  convertIndependentSystemToGroup,
  createSystemForGroup,
  createProjectDocument,
  splitSystemNames,
  deleteProject,
  deleteProjectGroup,
  getLastSummaryRepairReport,
  migrateInlineImages,
  listProjectGroups,
  loadProject,
  saveProject,
  saveProjectWithImages,
  hydrateProjectImages,
  updateProjectGroupAndSystems,
  getDefaultPreset,
  getLegacyPresetCandidate,
  completeLegacyPresetOnboarding,
} from '../utils/db';
import { exportBatchDataPackage, exportDataPackage, importDataPackage, importEncryptedDataPackage } from '../utils/exportImport';
import { isEvidencePackageFile } from '../utils/evidencePackage';
import { compressProjectImages } from '../utils/imageCompression';
import { claimSummaryRepairNotice } from '../utils/summaryRepair';
import { formatBytes } from '../utils/storageEstimate';
import ImportDialog from './ImportDialog';
import StorageSettingsDialog from './StorageSettingsDialog';
import ArchiveDialog from './archive/ArchiveDialog';
import StorageReminderBanner from './archive/StorageReminderBanner';
import { useStorageReminder } from './archive/useStorageReminder';
import { restoreProject } from '../utils/archive';
import ProjectListHeader from './project-list/ProjectListHeader';
import ProjectActions, { type ProjectListAction } from './project-list/ProjectActions';
import { SYSTEM_CARD_GRID, LIST_ACTION_CLASS as actionButton, CARD_ACTION_CLASS as cardActionButton } from './project-list/projectListUi';
import { splitProjectViews, filterGroups, filterSystems, filterGroupSystems, syncExpandedGroups, selectedVisibleSystems, listLocationKey, groupUpdatedAt, getSystemDisplayName, getGroupDisplayName, formatTime, type ProjectListLocation, type ProjectListViewState } from './project-list/projectListViews';
import ProjectGroupDialog, { type ProjectGroupDialogMode, type ProjectGroupDialogValues, type ProjectCreationType } from './project-list/ProjectGroupDialog';
import { useConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';
import { DEFAULT_PRESET, normalizeProfile } from '../utils/preset';
import PresetDialog from './project-list/PresetDialog';
interface ProjectListProps {
  viewState: ProjectListViewState;
  onViewStateChange: React.Dispatch<React.SetStateAction<ProjectListViewState>>;
  onOpenProject: (projectId: string, isNewProject?: boolean) => void;
  onProjectMetadataSaved?: () => void;
  /** 启动项目组级手机局域网采集（仅在桌面/Web ZIP 存在桥时由 App 传入）。 */
  onStartLanCollector?: (groupId: string | null, groupTitle: string, systemIds: string[]) => void;
}

interface DialogState {
  mode: ProjectGroupDialogMode;
  creationType?: ProjectCreationType;
  group: ProjectGroup | null;
  system: ProjectSummary | null;
}



const ProjectList: React.FC<ProjectListProps> = ({ viewState, onViewStateChange, onOpenProject, onStartLanCollector, onProjectMetadataSaved }) => {
  const [groups, setGroups] = useState<ProjectGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoredLocationRef = useRef<string | null>(null);
  const { projects, independent } = useMemo(() => splitProjectViews(groups), [groups]);
  const location = viewState.location ?? (projects.length === 0 && independent.length > 0 ? { kind: 'independent' as const } : { kind: 'groups' as const });
  const locationKey = listLocationKey(location);
  const search = viewState.positions[locationKey]?.search ?? '';
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => new Set());
  const [selectionGroupId, setSelectionGroupId] = useState<string | null>(null);
  const [pendingReveal, setPendingReveal] = useState<{ groupId: string | null; systemId: string } | null>(null);
  const [importTargetId, setImportTargetId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [presetLoading, setPresetLoading] = useState(true);
  const [presetError, setPresetError] = useState('');
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [legacyCandidate, setLegacyCandidate] = useState<ProjectPreset | null>(null);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const onboardingBusyRef = useRef(false);
  const presetGenerationRef = useRef(0);
  const presetRequestRef = useRef<{ controller: AbortController; promise: Promise<void> } | null>(null);
  const backgroundCheckStartedRef = useRef(false);
  const [legacyPromptAllowed, setLegacyPromptAllowed] = useState(true);
  const [otherModalOpen, setOtherModalOpen] = useState(false);
  useEffect(() => () => {
    presetGenerationRef.current += 1;
    presetRequestRef.current?.controller.abort();
    presetRequestRef.current = null;
  }, []);
  const [saving, setSaving] = useState(false);
  const [storageSettingsOpen, setStorageSettingsOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const batchControllerRef = useRef<AbortController | null>(null);
  const batchExporting = batchProgress !== null;
  useEffect(() => () => batchControllerRef.current?.abort(), []);
  const [compressingSystemId, setCompressingSystemId] = useState<string | null>(null);
  const [archiveDialog, setArchiveDialog] = useState<{ initialSelectedIds?: string[] } | null>(null);
  const [restoringSystem, setRestoringSystem] = useState<ProjectSummary | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirmDialog();
  const showToast = useToast();
  const reminder = useStorageReminder(groups, loaded && !loading && !loadError);
  const needsPreset = dialogState?.mode === 'create-group' || dialogState?.mode === 'add-system' || (dialogState?.mode === 'edit-system' && !dialogState.group);
  const dialogProfile = dialogState?.mode === 'create-group' ? preset.profile
    : normalizeProfile(dialogState?.system?.profile ?? dialogState?.group?.profile);
  const groupMembersRequired = dialogState?.mode === 'edit-group' && groups
    .find((summary) => summary.id === dialogState.group?.id)?.systems.some((system) => normalizeProfile(system.profile).unitFieldRequired);

  // 桌面版：启动时若自定义数据目录不可用已回退默认，提示一次。
  useEffect(() => {
    if (!window.evidenceData) return;
    void window.evidenceData.getLocation()
      .then((location) => { if (location.startupWarning) showToast(location.startupWarning, 'error'); })
      .catch(() => { /* 忽略 */ });
  }, [showToast]);

  const refreshProjects = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const nextGroups = await listProjectGroups();
      setGroups(nextGroups);
      setLoaded(true);
      const nextProjects = splitProjectViews(nextGroups).projects;
      onViewStateChange(current => ({ ...current,
        expandedGroupIds: syncExpandedGroups(current.expandedGroupIds, nextProjects),
        searchExpandedGroupIds: current.searchExpandedGroupIds === null ? null : syncExpandedGroups(current.searchExpandedGroupIds, nextProjects),
      }));
      const availableIds = new Set(nextGroups.flatMap(summary => summary.systems.map(system => system.id)));
      setSelectedProjectIds(current => new Set([...current].filter(id => availableIds.has(id))));
      // 存储自检的结果必须让用户知道：被找回的项目、以及读不出来的坏记录都不能静默处理。
      const repair = getLastSummaryRepairReport();
      if (repair && claimSummaryRepairNotice(repair)) {
        if (repair.repaired > 0) {
          showToast(`存储自检：已找回 ${repair.repaired} 个未显示的项目。`, 'success');
        }
        if (repair.damagedIds.length > 0) {
          showToast(`存储自检：有 ${repair.damagedIds.length} 条项目记录读不出内容，请到「存储设置→导出诊断包」发给技术支持。`, 'error');
        }
      }
    } catch (err) {
      const message = `加载项目列表失败：${err instanceof Error ? err.message : '未知错误'}`;
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshPreset = useCallback((): Promise<void> => {
    if (presetRequestRef.current) return presetRequestRef.current.promise;
    backgroundCheckStartedRef.current = true;
    const controller = new AbortController();
    const generation = ++presetGenerationRef.current;
    setPresetLoading(true);
    setPresetError('');
    setOnboardingError('');
    const promise = (async () => {
      try {
        const nextPreset = await getDefaultPreset();
        if (controller.signal.aborted) return;
        const candidate = await getLegacyPresetCandidate(controller.signal);
        if (generation !== presetGenerationRef.current) return;
        setPreset(nextPreset);
        setLegacyCandidate(candidate);
      } catch (error) {
        if (generation !== presetGenerationRef.current || controller.signal.aborted) return;
        const message = `读取模板预设失败：${error instanceof Error ? error.message : '未知错误'}`;
        setPresetError(message);
        showToast(message, 'error');
      } finally {
        if (generation === presetGenerationRef.current) {
          presetRequestRef.current = null;
          setPresetLoading(false);
        }
      }
    })();
    presetRequestRef.current = { controller, promise };
    return promise;
  }, [showToast]);

  useEffect(() => {
    if (!loaded || loading || loadError || backgroundCheckStartedRef.current) return;
    let timer: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        if (!backgroundCheckStartedRef.current) void refreshPreset();
      }, 600);
    });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [loaded, loading, loadError, refreshPreset]);

  useLayoutEffect(() => {
    if (!legacyCandidate) { setOtherModalOpen(false); return; }
    const check = () => setOtherModalOpen(!!document.querySelector('[role="dialog"]:not([data-project-group-dialog])'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role'] });
    return () => observer.disconnect();
  }, [legacyCandidate]);

  const onboardingVisible = !!legacyCandidate && legacyPromptAllowed && !otherModalOpen
    && (!dialogState || dialogState.mode === 'create-group')
    && !presetDialogOpen && !storageSettingsOpen && !archiveDialog && !importTargetId && !restoringSystem && !dialog && !batchExporting;

  const closeProjectDialog = () => {
    if (saving || onboardingBusyRef.current) return;
    if (dialogState?.mode === 'create-group' || onboardingVisible) {
      presetGenerationRef.current += 1;
      presetRequestRef.current?.controller.abort();
      presetRequestRef.current = null;
      setLegacyCandidate(null);
      setLegacyPromptAllowed(false);
      setPresetLoading(false);
    }
    setDialogState(null);
  };

  const openCreateDialog = () => {
    setLegacyPromptAllowed(true);
    setDialogState({ mode: 'create-group', group: null, system: null, creationType: location.kind === 'groups' ? 'group' : 'independent' });
    if (!legacyCandidate) void refreshPreset();
  };

  const chooseLegacyPreset = async (adopt: boolean) => {
    if (!legacyCandidate || onboardingBusyRef.current) return;
    onboardingBusyRef.current = true;
    setOnboardingSaving(true);
    setOnboardingError('');
    const generation = presetGenerationRef.current;
    try {
      const next = await completeLegacyPresetOnboarding(adopt ? legacyCandidate : null);
      if (generation !== presetGenerationRef.current) return;
      setPreset(next);
      setLegacyCandidate(null);
    } catch (error) {
      if (generation === presetGenerationRef.current) setOnboardingError(`保存模板选择失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      onboardingBusyRef.current = false;
      if (generation === presetGenerationRef.current) setOnboardingSaving(false);
    }
  };

  useEffect(() => { void refreshProjects(); }, []);

  // 存量图片后台搬迁：只在列表页（没打开项目时）跑，避开编辑中的自动保存；
  // 延迟启动让首屏列表先渲染完，逐项目事务 + 进度可续跑，中途关窗不会损坏数据。
  useEffect(() => {
    const timer = setTimeout(() => {
      void migrateInlineImages().then((report) => {
        if (report.migrated > 0) {
          showToast(`已优化 ${report.migrated} 个系统的图片存储，之后拍照保存会快很多。`, 'success');
        }
      }).catch(() => { /* 搬迁失败不影响使用，错误已进诊断包 */ });
    }, 3000);
    return () => clearTimeout(timer);
  }, [showToast]);

  const filteredGroups = useMemo(() => filterGroups(projects, search), [projects, search]);
  const expandedGroupIds = search.trim()
    ? viewState.searchExpandedGroupIds ?? filteredGroups.map(summary => summary.id)
    : viewState.expandedGroupIds ?? projects.map(summary => summary.id);
  const filteredSystems = useMemo(() => filterSystems(independent, search), [independent, search]);
  const selectionGroup = filteredGroups.find(summary => summary.id === selectionGroupId);
  const selectableSystems = location.kind === 'independent' ? filteredSystems
    : selectionGroup && expandedGroupIds.includes(selectionGroup.id) ? filterGroupSystems(selectionGroup, search) : [];
  const selectedSystems = selectedVisibleSystems(selectableSystems, selectedProjectIds);
  const allFilteredSelected = filteredSystems.length > 0 && filteredSystems.every((system) => selectedProjectIds.has(system.id));
  const importTarget = groups.flatMap((group) => group.systems).find((system) => system.id === importTargetId);

  const getImportTargetName = (system: ProjectSummary): string => {
    const parentGroup = system.groupId ? groups.find((group) => group.id === system.groupId)?.group : null;
    return parentGroup ? `${getGroupDisplayName({ id: parentGroup.id, group: parentGroup, systems: [] })} / ${getSystemDisplayName(system)}` : getSystemDisplayName(system);
  };

  const navigate = (nextLocation: ProjectListLocation, clearSearch = false) => {
    setSelectedProjectIds(new Set());
    onViewStateChange(current => ({
      ...current,
      location: nextLocation,
      ...(clearSearch ? { searchExpandedGroupIds: null } : {}),
      positions: {
        ...current.positions,
        [locationKey]: { search, scrollY: window.scrollY },
        ...(clearSearch ? { [listLocationKey(nextLocation)]: { search: '', scrollY: 0 } } : {}),
      },
    }));
    if (listLocationKey(nextLocation) === locationKey && clearSearch) window.scrollTo(0, 0);
  };

  const changeSearch = (value: string) => {
    setSelectedProjectIds(new Set());
    onViewStateChange(current => ({ ...current, location,
      ...(location.kind === 'groups' ? { searchExpandedGroupIds: value.trim() ? filterGroups(projects, value).map(summary => summary.id) : null } : {}),
      positions: { ...current.positions, [locationKey]: { search: value, scrollY: 0 } },
    }));
  };

  const requestRestore = async (system: ProjectSummary) => {
    const info = system.archive;
    if (!info || restoringSystem) return;
    const ok = await confirm({
      title: '该系统已归档',
      message: `系统“${getSystemDisplayName(system)}”已于 ${formatTime(info.archivedAt)} 归档，本地没有图片，需要先恢复才能打开。\n\n请选择归档文件「${info.fileName}」（归档时保存在：${info.locationLabel}）。是否现在恢复？`,
      confirmText: '选择归档文件恢复',
      tone: 'default',
    });
    if (!ok || !restoreInputRef.current) return;
    setRestoringSystem(system);
    restoreInputRef.current.value = '';
    restoreInputRef.current.click();
  };

  const handleRestoreFile = async (file: File | undefined) => {
    const system = restoringSystem;
    if (!system) return;
    if (!file) { setRestoringSystem(null); return; }
    try {
      await restoreProject(system.id, file);
      showToast(`已恢复系统“${getSystemDisplayName(system)}”，图片已放回本地。`, 'success');
      await refreshProjects();
      reminder.recheck();
    } catch (err) {
      showToast(`恢复失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setRestoringSystem(null);
    }
  };

  const openSystem = (systemId: string) => {
    const target = groups.flatMap((summary) => summary.systems).find((system) => system.id === systemId);
    if (target?.archive) { void requestRestore(target); return; }
    onViewStateChange(current => ({ ...current, location,
      positions: { ...current.positions, [locationKey]: { search, scrollY: window.scrollY } },
    }));
    onOpenProject(systemId);
  };

  useLayoutEffect(() => {
    if (!loaded || loading || loadError) return;
    if (pendingReveal) {
      const targetLocation: ProjectListLocation = { kind: pendingReveal.groupId ? 'groups' : 'independent' };
      if (location.kind !== targetLocation.kind || search || (pendingReveal.groupId && !expandedGroupIds.includes(pendingReveal.groupId))) {
        navigate(targetLocation, true);
        const groupId = pendingReveal.groupId;
        if (groupId) onViewStateChange(current => ({ ...current,
          expandedGroupIds: [...new Set([...(current.expandedGroupIds ?? []), groupId])],
        }));
        return;
      }
      const target = document.getElementById(`system-${pendingReveal.systemId}`);
      if (!target) return;
      target.scrollIntoView({ block: 'center' });
      target.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      setPendingReveal(null);
      restoredLocationRef.current = locationKey;
      return;
    }
    if (!viewState.location) onViewStateChange(current => ({ ...current, location }));
    if (restoredLocationRef.current !== locationKey) {
      restoredLocationRef.current = locationKey;
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, viewState.positions[locationKey]?.scrollY ?? 0);
    }
  }, [loaded, loading, loadError, location, locationKey, pendingReveal, expandedGroupIds, search, viewState, onViewStateChange]);

  const toggleGroup = (groupId: string) => {
    if (selectionGroupId === groupId) setSelectedProjectIds(new Set());
    const panel = document.getElementById(`group-systems-${groupId}`);
    if (panel?.contains(document.activeElement)) document.getElementById(`group-toggle-${groupId}`)?.focus();
    const key = search.trim() ? 'searchExpandedGroupIds' : 'expandedGroupIds';
    onViewStateChange(current => {
      const ids = current[key] ?? expandedGroupIds;
      return { ...current, [key]: ids.includes(groupId) ? ids.filter(id => id !== groupId) : [...ids, groupId] };
    });
  };

  const toggleProjectSelection = (projectId: string, groupId: string | null) => {
    setSelectionGroupId(groupId);
    setSelectedProjectIds((current) => {
      const next = new Set(selectionGroupId === groupId ? current : []);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  const toggleAllFilteredProjects = (systems: ProjectSummary[], groupId: string | null) => {
    setSelectionGroupId(groupId);
    const allSelected = selectionGroupId === groupId && systems.every(system => selectedProjectIds.has(system.id));
    setSelectedProjectIds(allSelected ? new Set() : new Set(systems.map(system => system.id)));
  };

  const handleDeleteSelectedProjects = async () => {
    if (selectedSystems.length === 0) return;
    const names = selectedSystems.slice(0, 5).map(getSystemDisplayName).join('、');
    const suffix = selectedSystems.length > 5 ? ` 等 ${selectedSystems.length} 个系统` : '';
    if (!await confirm({ title: '删除选中系统', message: `确定要删除选中的 ${selectedSystems.length} 个系统吗？\n\n${names}${suffix}\n\n此操作会删除对应系统的资产、检查项和截图，且不可撤销。`, confirmText: '删除系统', tone: 'danger' })) return;
    try {
      await Promise.all(selectedSystems.map((system) => deleteProject(system.id)));
      setSelectedProjectIds(new Set());
      await refreshProjects();
    } catch (err) {
      showToast(`删除选中系统失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleDeleteSystem = async (system: ProjectSummary) => {
    if (!await confirm({ title: '删除系统', message: `确定要删除系统“${getSystemDisplayName(system)}”吗？\n\n此操作会删除该系统的所有资产、检查项和截图，且不可撤销。${system.archive ? `\n\n该系统已归档，删除不会删掉归档文件「${system.archive.fileName}」。` : ''}`, confirmText: '删除系统', tone: 'danger' })) return;
    try {
      await deleteProject(system.id);
      setSelectedProjectIds((current) => { const next = new Set(current); next.delete(system.id); return next; });
      await refreshProjects();
    } catch (err) {
      showToast(`删除系统失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleDeleteGroup = async (summary: ProjectGroupSummary) => {
    if (!summary.group) return;
    const archivedCount = summary.systems.filter((system) => system.archive).length;
    if (!await confirm({ title: '删除项目组', message: `确定要删除项目组“${getGroupDisplayName(summary)}”及其 ${summary.systems.length} 个系统吗？\n\n此操作会删除该项目组全部系统的资产、检查项和截图，且不可撤销。${archivedCount > 0 ? `\n\n其中 ${archivedCount} 个已归档，删除不会删掉归档文件。` : ''}`, confirmText: '删除项目组', tone: 'danger' })) return;
    try {
      await deleteProjectGroup(summary.group.id);
      setSelectedProjectIds((current) => {
        const next = new Set(current);
        summary.systems.forEach((system) => next.delete(system.id));
        return next;
      });
      await refreshProjects();
    } catch (err) {
      showToast(`删除项目组失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleExportSelected = async () => {
    if (batchControllerRef.current || compressingSystemId || restoringSystem || selectedSystems.length === 0) return;
    const targets = selectedSystems.map(system => ({ id: system.id, name: getSystemDisplayName(system), archived: Boolean(system.archive) }));
    const controller = new AbortController();
    batchControllerRef.current = controller;
    setBatchProgress(`准备导出 ${targets.length} 个系统…`);
    try {
      await exportBatchDataPackage(targets, message => {
        if (!controller.signal.aborted) setBatchProgress(message);
      }, controller.signal);
      showToast(`已生成 ${targets.length} 个系统的数据包并发起下载，解压后可逐个导入。`, 'success');
    } catch (error) {
      if (!controller.signal.aborted) showToast(`批量导出失败：${error instanceof Error ? error.message : '未知错误'}`, 'error');
    } finally {
      batchControllerRef.current = null;
      if (!controller.signal.aborted) setBatchProgress(null);
    }
  };

  const handleExportSystem = async (system: ProjectSummary) => {
    try {
      const document = await loadProject(system.id);
      if (!document) { showToast('导出失败：系统不存在或已被删除', 'error'); return; }
      await exportDataPackage(document.meta, document.categories, document.assets, document.id, document.profile);
    } catch (err) {
      showToast(`导出失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleCompressSystem = async (system: ProjectSummary) => {
    if (compressingSystemId) return;
    const ok = await confirm({
      title: '压缩现有图片',
      message: `将把系统“${getSystemDisplayName(system)}”中已存的图片就地压缩变小（长边 1920px、保持清晰），用于加快返回项目和导出报告。\n\n此操作会改写已存图片且不可撤销，导出报告的清晰度基本不变。是否继续？`,
      confirmText: '开始压缩',
      tone: 'default',
    });
    if (!ok) return;
    setCompressingSystemId(system.id);
    try {
      const document = await loadProject(system.id);
      if (!document) { showToast('压缩失败：系统不存在或已被删除', 'error'); return; }
      // 字节在独立 store：先补齐再压缩，写回时由 saveProjectWithImages 重新拆回 images store。
      const result = await compressProjectImages(await hydrateProjectImages(document));
      if (result.changedCount > 0) {
        await saveProjectWithImages(result.doc);
        await refreshProjects();
      }
      if (result.changedCount === 0 && result.failedCount === 0) {
        showToast(`共扫描 ${result.total} 张，没有需要压缩的图片，所有图片都已足够小。`, 'info');
        return;
      }
      if (result.changedCount === 0) {
        showToast(`共扫描 ${result.total} 张，压缩失败：${result.failedCount} 张未能处理，原图已保留。`, 'error');
        return;
      }
      const failNote = result.failedCount > 0 ? `，另有 ${result.failedCount} 张未能处理已保留原图` : '';
      showToast(`共扫描 ${result.total} 张，压缩 ${result.changedCount} 张，节省 ${formatBytes(result.savedBytes)}${failNote}。`, 'success');
    } catch (err) {
      showToast(`压缩失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setCompressingSystemId(null);
    }
  };

  const importIntoSystem = async (file: File, password: string, mode: 'overwrite' | 'merge'): Promise<{ success: boolean; message: string }> => {
    if (!importTargetId) return { success: false, message: '导入失败：未指定目标系统' };
    try {
      const targetDocument = await loadProject(importTargetId);
      if (!targetDocument) return { success: false, message: '导入失败：目标系统不存在或已被删除' };
      const result = isEvidencePackageFile(file)
        ? await importEncryptedDataPackage(file, password, mode, targetDocument.assets, targetDocument.categories, targetDocument.meta, targetDocument.profile, targetDocument.id)
        : await importDataPackage(file, mode, targetDocument.assets, targetDocument.categories, targetDocument.meta, targetDocument.profile, targetDocument.id);
      if (!result.success || !result.data) return { success: false, message: result.message };
      const group = targetDocument.groupId ? await getGroupForSystem(targetDocument.groupId) : null;
      const meta: ProjectMeta = group && mode === 'overwrite'
        ? { ...result.data.meta, projectCode: group.projectCode, projectName: group.projectName, unitName: group.unitName, reportDate: group.reportDate }
        : result.data.meta;
      const nextDocument: ProjectDocument = {
        id: targetDocument.id,
        groupId: targetDocument.groupId,
        meta,
        categories: result.data.categories,
        assets: result.data.assets,
        profile: result.data.profile,
        createdAt: targetDocument.createdAt,
        updatedAt: Date.now(),
      };
      await saveProjectWithImages(nextDocument);
      await refreshProjects();
      return { success: true, message: result.message };
    } catch (err) {
      return { success: false, message: `导入失败：${err instanceof Error ? err.message : '未知错误'}` };
    }
  };

  const getGroupForSystem = async (groupId: string): Promise<ProjectGroup | null> => {
    const summary = groups.find((group) => group.id === groupId);
    return summary?.group ?? null;
  };

  const handleSaveDialog = async ({ creationType, ...values }: ProjectGroupDialogValues): Promise<boolean> => {
    if (!dialogState || saving || (needsPreset && (presetLoading || presetError || (dialogState.mode === 'create-group' && legacyCandidate)))) return false;
    setSaving(true);
    try {
      let createdSystem: { groupId: string | null; systemId: string } | null = null;
      if (dialogState.mode === 'create-group') {
        const systemNames = splitSystemNames(values.systemName);
        if (creationType === 'independent') {
          if (systemNames.length !== 1) throw new Error('多个系统名称请选择系统组');
          const document = createProjectDocument({ ...values, systemName: systemNames[0] }, null, preset);
          await saveProject(document);
          createdSystem = { groupId: null, systemId: document.id };
        } else {
          const systems = await createProjectGroupWithSystems({ ...values, profile: preset.profile }, systemNames, preset);
          if (systems[0]) createdSystem = { groupId: systems[0].groupId, systemId: systems[0].id };
        }
      } else if (dialogState.mode === 'add-system' && dialogState.group) {
        const system = await createSystemForGroup(dialogState.group, values.systemName, preset);
        createdSystem = { groupId: dialogState.group.id, systemId: system.id };
      } else if (dialogState.mode === 'edit-group' && dialogState.group) {
        await updateProjectGroupAndSystems({
          ...dialogState.group,
          projectCode: values.projectCode,
          projectName: values.projectName,
          unitName: values.unitName,
          reportDate: values.reportDate,
          updatedAt: Date.now(),
        });
      } else if (dialogState.mode === 'edit-system' && dialogState.system && !dialogState.group && splitSystemNames(values.systemName, false).length > 1) {
        const systems = await convertIndependentSystemToGroup(dialogState.system.id, values, dialogState.system.updatedAt, preset);
        createdSystem = { groupId: systems[0].groupId, systemId: systems[0].id };
      } else if (dialogState.mode === 'edit-system' && dialogState.system) {
        const document = await loadProject(dialogState.system.id);
        if (!document) { showToast('保存失败：目标系统不存在或已被删除', 'error'); return false; }
        const meta = dialogState.group
          ? {
              ...document.meta,
              projectCode: dialogState.group.projectCode,
              projectName: dialogState.group.projectName,
              unitName: dialogState.group.unitName,
              reportDate: dialogState.group.reportDate,
              systemName: values.systemName,
            }
          : { ...document.meta, ...values };
        await saveProject({ ...document, meta, updatedAt: Date.now() });
      }
      setPendingReveal(createdSystem);
      setDialogState(null);
      onProjectMetadataSaved?.();
      await refreshProjects();
      return true;
    } catch (err) {
      showToast(`保存失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const archivedHint = '该系统已归档，请先恢复';
  const systemActions = (system: ProjectSummary): ProjectListAction[] => {
    const archived = Boolean(system.archive);
    const hint = archived ? archivedHint : undefined;
    return [
      ...(onStartLanCollector ? [{ label: '手机采集', className: 'md:hidden', disabled: archived, title: hint, onClick: () => onStartLanCollector(system.groupId, getSystemDisplayName(system), [system.id]) }] : []),
      { label: '编辑', onClick: () => { if (!system.groupId) void refreshPreset(); setDialogState({ mode: 'edit-system', group: groups.find(summary => summary.id === system.groupId)?.group ?? null, system }); } },
      { label: '导出数据包', disabled: archived, title: hint, onClick: () => void handleExportSystem(system) },
      { label: compressingSystemId === system.id ? '正在压缩…' : '压缩图片', disabled: compressingSystemId !== null || archived, title: hint, onClick: () => void handleCompressSystem(system) },
      { label: '导入数据包', disabled: archived, title: hint, onClick: () => setImportTargetId(system.id) },
      { label: '删除', danger: true, onClick: () => void handleDeleteSystem(system) },
    ];
  };
  /** 项目组级采集只带未归档系统（已归档的本地无图片且只读）。 */
  const collectableSystems = (summary: ProjectGroupSummary) => summary.systems.filter((system) => !system.archive);
  const archivedInGroup = (summary: ProjectGroupSummary) => summary.systems.filter((system) => system.archive).length;
  const groupActions = (summary: ProjectGroupSummary): ProjectListAction[] => {
    const group = summary.group;
    return [
      ...(onStartLanCollector ? [{ label: '手机采集', className: 'md:hidden', disabled: collectableSystems(summary).length === 0,
        onClick: () => onStartLanCollector(summary.id, getGroupDisplayName(summary), collectableSystems(summary).map(system => system.id)) }] : []),
      ...(group ? [
        { label: '编辑项目组', onClick: () => setDialogState({ mode: 'edit-group', group, system: null }) },
        { label: '删除项目组', danger: true, onClick: () => void handleDeleteGroup(summary) },
      ] : []),
    ];
  };
  const isGroupList = location.kind === 'groups';
  const realGroupCount = projects.filter(summary => summary.group).length;
  const orphanCount = projects.length - realGroupCount;
  const title = isGroupList ? '多系统项目' : '独立系统';
  const emptyMessage = search.trim() ? `没有找到匹配的${isGroupList ? '项目' : '系统'}`
    : isGroupList ? '暂无系统组，点击新建项目即可创建。'
    : '暂无独立系统，新建项目时填写一个系统名称即可创建。';

  const phoneIcon = (
    <svg className="h-3.5 w-3.5 shrink-0 text-[#8a94a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zm3 15h2" />
    </svg>
  );

  const renderSystemCard = (system: ProjectSummary, groupUnit?: string) => {
    const selected = selectedProjectIds.has(system.id);
    const hasAssets = system.assetCount > 0;
    const displayName = getSystemDisplayName(system);
    return (
      <article
        key={system.id}
        id={`system-${system.id}`}
        data-system-id={system.id}
        onClick={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest('button, input, label, details, summary, a')) return;
          if (system.archive) {
            if (restoringSystem === null) void requestRestore(system);
          } else {
            openSystem(system.id);
          }
        }}
        className={`group flex min-w-0 cursor-pointer flex-col justify-between rounded-[16px] border bg-white p-4 transition-all duration-150 ${
          selected
            ? 'border-[#78cfc5] bg-[#f8fdfc] shadow-[0_0_0_2px_rgba(13,148,136,0.12),0_6px_18px_rgba(15,23,42,0.05)]'
            : 'border-[#e3e7ef] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.035)] hover:border-[#cfd6e2] hover:shadow-[0_4px_12px_rgba(15,23,42,0.07),0_12px_26px_rgba(15,23,42,0.05)]'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors ${
                system.archive
                  ? 'border-[#e5e9f0] bg-[#f4f6fa] text-[#98a2b3]'
                  : hasAssets
                    ? 'border-[#c4eae5] bg-[#e8f7f5] text-[#0d7c73]'
                    : 'border-[#e6eaf1] bg-[#f4f6fa] text-[#8a94a6]'
              }`}
              aria-hidden="true"
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.85} d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </span>
            <label className="-mr-2.5 -mt-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px]">
              <input
                aria-label={`选择${displayName}`}
                type="checkbox"
                checked={selected}
                onChange={() => toggleProjectSelection(system.id, system.groupId)}
                className="h-4 w-4 rounded border-[#cfd6e2] accent-[#0d9488]"
              />
            </label>
          </div>

          <div className="mt-2.5 min-w-0">
            <button
              type="button"
              onClick={() => openSystem(system.id)}
              className={`min-h-11 break-words text-left text-[15px] font-semibold leading-snug tracking-[-0.01em] transition-colors hover:text-[#0d7c73] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d9488] lg:min-h-0 ${
                system.archive ? 'text-[#7b8496]' : 'text-[#1c2230]'
              }`}
            >
              {displayName}
            </button>
            {system.archive && (
              <span
                data-archived-tag
                title={`归档于 ${formatTime(system.archive.archivedAt)}，文件：${system.archive.fileName}`}
                className="ml-2 inline-block whitespace-nowrap rounded-md border border-[#e3e7ef] bg-[#f4f6fa] px-1.5 py-0.5 text-xs text-[#647084]"
              >
                已归档
              </span>
            )}
            {groupUnit === undefined && (
              <p className="mt-1 break-words text-xs text-[#8a94a6]">{system.meta.unitName || '未填写单位'}</p>
            )}
            {groupUnit !== undefined && system.meta.unitName && system.meta.unitName !== groupUnit && (
              <p className="mt-1 break-words text-xs text-[#8a94a6]">{system.meta.unitName}</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              data-column="assets"
              className={
                hasAssets
                  ? 'inline-flex items-center gap-1.5 rounded-md border border-[#d6ede9] bg-[#eef9f7] px-2 py-0.5 text-xs font-medium text-[#0b665f] tabular-nums'
                  : 'inline-flex items-center gap-1.5 text-xs text-[#949cad] tabular-nums'
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  hasAssets
                    ? 'bg-[#10b981] shadow-[0_0_0_3px_rgba(16,185,129,0.14)]'
                    : 'bg-[#cbd3df]'
                }`}
                aria-hidden="true"
              />
              {hasAssets ? `${system.assetCount} 项资产` : '暂无资产'}
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#eaedf3] pt-2.5">
          <span data-column="updated" className="whitespace-nowrap text-xs text-[#8a94a6] tabular-nums">
            {formatTime(system.updatedAt)}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {system.archive ? (
              <button
                type="button"
                disabled={restoringSystem !== null}
                onClick={() => void requestRestore(system)}
                className={`${cardActionButton} border-[#b8e6e0] bg-[#e6f6f4] px-3 font-semibold text-[#0b665f] hover:bg-[#d5f0ec]`}
              >
                {restoringSystem?.id === system.id ? '恢复中…' : '恢复'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openSystem(system.id)}
                className={`${cardActionButton} border-[#d6ede9] bg-[#eef9f7] px-3 font-semibold text-[#0b665f] hover:border-[#96dcd4] hover:bg-[#dff4f1]`}
              >
                打开
              </button>
            )}
            {onStartLanCollector && (
              <button
                type="button"
                disabled={Boolean(system.archive)}
                title={system.archive ? archivedHint : undefined}
                onClick={() => onStartLanCollector(system.groupId, displayName, [system.id])}
                className={`${cardActionButton} hidden border-transparent bg-transparent text-[#647084] hover:bg-[#edf1f6] hover:text-[#1c2230] md:inline-flex`}
              >
                {phoneIcon}
                <span>手机采集</span>
              </button>
            )}
            <ProjectActions label={`${displayName}的系统操作`} actions={systemActions(system)} />
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen craft-canvas">
      <fieldset disabled={batchExporting} className="min-w-0">
      <ProjectListHeader search={search} searchLabel={isGroupList ? '搜索项目或组内系统' : '搜索当前列表的系统'} showSelection={!isGroupList} selectedCount={selectedSystems.length} exportDisabled={compressingSystemId !== null || restoringSystem !== null} onExportSelected={handleExportSelected} onSearchChange={changeSearch} onDeleteSelected={handleDeleteSelectedProjects} onCreateProject={openCreateDialog} onOpenStorageSettings={() => setStorageSettingsOpen(true)} onOpenPresetSettings={() => { setPresetDialogOpen(true); void refreshPreset(); }} />
      <main className="mx-auto max-w-[1260px] px-4 py-5 sm:px-6">
        <h2 className="sr-only">项目管理中心</h2>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="项目分类" className={orphanCount === 0 ? 'relative inline-grid grid-cols-2 rounded-[12px] border border-[#e3e7ef] bg-[#e7ebf2] p-1' : 'flex flex-wrap gap-1 rounded-[12px] border border-[#e3e7ef] bg-[#e7ebf2] p-1'}>
            {orphanCount === 0 && (
              <span
                aria-hidden="true"
                className={`pointer-events-none col-start-1 row-start-1 h-full w-full rounded-[9px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  location.kind === 'independent' ? 'translate-x-full' : 'translate-x-0'
                }`}
              />
            )}
            <button type="button" aria-current={location.kind !== 'independent' ? 'page' : undefined} onClick={() => navigate({ kind: 'groups' })}
              className={`relative z-10 col-start-1 row-start-1 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border-0 px-3.5 py-1 text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488] lg:min-h-8 ${location.kind !== 'independent' ? `${orphanCount > 0 ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ' : 'bg-transparent '}font-semibold text-[#1c2230]` : 'bg-transparent text-[#647084] hover:text-[#1c2230]'}`}>
              多系统项目 <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${location.kind !== 'independent' ? 'bg-[#e6f6f4] font-semibold text-[#0d7c73]' : 'bg-black/[0.05] text-[#647084]'}`}>{realGroupCount}</span>{orphanCount > 0 && <span className="ml-2 text-xs text-[#c53030]">另有 {orphanCount} 个异常组</span>}
            </button>
            <button type="button" aria-current={location.kind === 'independent' ? 'page' : undefined} onClick={() => navigate({ kind: 'independent' })}
              className={`relative z-10 col-start-2 row-start-1 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[9px] border-0 px-3.5 py-1 text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488] lg:min-h-8 ${location.kind === 'independent' ? `${orphanCount > 0 ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ' : 'bg-transparent '}font-semibold text-[#1c2230]` : 'bg-transparent text-[#647084] hover:text-[#1c2230]'}`}>
              独立系统 <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${location.kind === 'independent' ? 'bg-[#e6f6f4] font-semibold text-[#0d7c73]' : 'bg-black/[0.05] text-[#647084]'}`}>{independent.length}</span>
            </button>
          </nav>
        </div>
        {batchProgress !== null && <p data-batch-status role="status" aria-live="polite" className="mb-4 break-words rounded-[14px] border border-[#b8e6e0] bg-[#eef9f7] px-4 py-3 text-sm text-[#0b665f]">{batchProgress}</p>}
        {reminder.result && reminder.result.level !== 'none' && <StorageReminderBanner result={reminder.result} onSnooze={reminder.snooze}
          onArchive={() => setArchiveDialog({ initialSelectedIds: reminder.result?.staleCandidates.map((candidate) => candidate.projectId) })} />}
        <section aria-labelledby="project-list-title">
          <h3 id="project-list-title" ref={headingRef} tabIndex={-1} className="sr-only">{title}</h3>
          {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#f5c6ca] bg-[#fff5f5] p-4 text-[#c53030]"><span>{loadError}{loaded ? '，下方保留上次成功加载的列表。' : ''}</span><button type="button" disabled={loading} onClick={() => void refreshProjects()} className={`${actionButton} border-[#f3b4b8] bg-white text-[#c53030]`}>重试</button></div>}
          <div key={locationKey + search} aria-busy={loading} className="space-y-6">
            {!isGroupList && filteredSystems.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#e3e7ef] bg-white/85 px-3.5 py-1.5 text-xs text-[#647084]">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium text-[#475266] lg:min-h-9">
                  <input aria-label="全选当前可见系统" type="checkbox" checked={allFilteredSelected} onChange={() => toggleAllFilteredProjects(filteredSystems, null)} disabled={filteredSystems.length === 0} className="h-4 w-4 rounded border-[#cfd6e2] accent-[#0d9488]" />
                  <span>全选当前可见系统（{filteredSystems.length}）</span>
                </label>
              </div>
            )}
            {!loaded ? <p className="rounded-[16px] border border-[#e3e7ef] bg-white px-6 py-12 text-center text-sm text-[#647084]">{loading ? '正在加载项目列表…' : '列表尚未加载，请重试。'}</p>
              : (isGroupList ? filteredGroups.length : filteredSystems.length) === 0 ? <div className="rounded-[16px] border border-[#e3e7ef] bg-white px-6 py-14 text-center text-sm text-[#647084] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"><p>{emptyMessage}</p>{search.trim() && <button type="button" onClick={() => changeSearch('')} className={`${actionButton} mt-3 border-[#d8dee8] bg-white text-[#3b4454] hover:bg-[#f6f8fb]`}>清除搜索</button>}</div>
              : isGroupList ? filteredGroups.map(summary => {
                const systems = filterGroupSystems(summary, search);
                const expanded = expandedGroupIds.includes(summary.id);
                const allSelected = systems.length > 0 && selectionGroupId === summary.id && systems.every(system => selectedProjectIds.has(system.id));
                const unitName = summary.group?.unitName || summary.systems[0]?.meta.unitName || '';
                return <div key={summary.id} data-group-id={summary.id} className="space-y-3">
                  <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                    <button id={`group-toggle-${summary.id}`} type="button" aria-expanded={expanded} aria-controls={`group-systems-${summary.id}`} onClick={() => toggleGroup(summary.id)} className="group flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-[12px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d9488]">
                      <span aria-hidden="true" className="-ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#dce1eb] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05)] transition-colors group-hover:border-[#cfd6e2] ${expanded ? 'text-[#0d7c73]' : 'text-[#7b8496] group-hover:text-[#1c2230]'}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ease-out ${expanded ? 'rotate-90' : ''}`}><path d="m9 6 6 6-6 6" /></svg>
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="block break-words text-[16.5px] font-bold tracking-[-0.02em] text-[#1c2230]">{getGroupDisplayName(summary)}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#7b8496]">
                          {unitName && unitName !== getGroupDisplayName(summary) && <span className="break-words text-[#556072]">{unitName}</span>}
                          <span className="whitespace-nowrap tabular-nums">{summary.systems.length} 个系统</span>
                          {archivedInGroup(summary) > 0 && <span data-group-archived className="whitespace-nowrap rounded-md border border-[#e3e7ef] bg-white px-1.5 py-0.5 text-[#647084]">{archivedInGroup(summary) === summary.systems.length ? '已归档' : `${archivedInGroup(summary)} 个已归档`}</span>}
                          <span aria-hidden="true">·</span>
                          <span className="whitespace-nowrap tabular-nums">更新于 {formatTime(groupUpdatedAt(summary))}</span>
                        </span>
                        {!summary.group && <span className="mt-1 block text-xs font-medium text-[#c53030]">项目组记录缺失 · 系统数据仍保留，可打开或导出</span>}
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {summary.group && <button type="button" onClick={() => { setDialogState({ mode: 'add-system', group: summary.group, system: null }); void refreshPreset(); }} className={`${cardActionButton} border-[#d8dee8] bg-white px-3 text-[#3b4454] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05)] hover:bg-[#f6f8fb]`}><svg className="h-3.5 w-3.5 text-[#7b8496]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 5v14M5 12h14" /></svg>添加系统</button>}
                      {onStartLanCollector && <button type="button" disabled={collectableSystems(summary).length === 0} onClick={() => onStartLanCollector(summary.id, getGroupDisplayName(summary), collectableSystems(summary).map(system => system.id))} className={`${cardActionButton} hidden border-transparent bg-transparent text-[#647084] hover:bg-white/80 hover:text-[#1c2230] md:inline-flex`}>{phoneIcon}<span>手机采集</span></button>}
                      {groupActions(summary).length > 0 && <div className={!summary.group ? 'md:hidden' : undefined}><ProjectActions label={`${getGroupDisplayName(summary)}的项目操作`} actions={groupActions(summary)} /></div>}
                    </div>
                  </div>
                  <div id={`group-systems-${summary.id}`} hidden={!expanded} aria-labelledby={`group-toggle-${summary.id}`}>
                    {expanded && (
                      systems.length === 0 ? (
                        <div className="rounded-[16px] border border-dashed border-[#d8dee8] bg-white/70 px-5 py-6 text-sm text-[#8a94a6]">此项目暂无系统。</div>
                      ) : (
                        <div className="space-y-3">
                          <div data-system-header className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#e3e7ef] bg-white/80 px-3 py-1 text-xs text-[#647084]">
                            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium text-[#475266] lg:min-h-8">
                              <input aria-label="全选当前可见系统" type="checkbox" checked={allSelected} onChange={() => toggleAllFilteredProjects(systems, summary.id)} className="h-4 w-4 rounded border-[#cfd6e2] accent-[#0d9488]" />
                              <span>全选本组{systems.length !== summary.systems.length ? `（匹配 ${systems.length} 个）` : ''}</span>
                            </label>
                            {selectionGroupId === summary.id && selectedSystems.length > 0 && (
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <span className="whitespace-nowrap font-semibold text-[#0b665f]">已选 {selectedSystems.length} 项</span>
                                <button type="button" disabled={compressingSystemId !== null || restoringSystem !== null} onClick={() => void handleExportSelected()} className={`${cardActionButton} border-[#b8e6e0] bg-[#edf9f7] px-3 font-semibold text-[#0b665f] hover:bg-[#dbf3ef]`}>导出选中</button>
                                <button type="button" onClick={handleDeleteSelectedProjects} className={`${cardActionButton} border-[#f5c6ca] bg-[#fff5f5] px-3 text-[#c53030] hover:bg-[#fdecec]`}>删除选中</button>
                                <span className="text-[11.5px] font-normal text-[#8a94a6]">解压后可逐个导入</span>
                              </div>
                            )}
                          </div>
                          <div className={SYSTEM_CARD_GRID}>
                            {systems.map(system => renderSystemCard(system, unitName))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>;
              }) : (
                <div className={SYSTEM_CARD_GRID}>
                  {filteredSystems.map(system => renderSystemCard(system))}
                </div>
              )}
          </div>
        </section>
      </main>
      </fieldset>
      <PresetDialog open={presetDialogOpen} preset={preset} loading={presetLoading} error={presetError} onRetry={refreshPreset} onClose={() => setPresetDialogOpen(false)} onSaved={(next) => { presetGenerationRef.current += 1; presetRequestRef.current?.controller.abort(); presetRequestRef.current = null; setLegacyCandidate(null); setLegacyPromptAllowed(false); setPreset(next); setPresetError(''); setPresetLoading(false); setPresetDialogOpen(false); showToast(`已设为默认预设：${next.name}`, 'success'); }} onError={(message) => showToast(message, 'error')} />
      <ProjectGroupDialog initialCreationType={dialogState?.creationType ?? 'independent'} open={!!dialogState || onboardingVisible} mode={dialogState?.mode ?? 'create-group'} group={dialogState?.group ?? null} system={dialogState?.system?.meta ?? null} onClose={closeProjectDialog} onSave={handleSaveDialog} legacyOnboarding={onboardingVisible} onboardingSaving={onboardingSaving} onboardingError={onboardingError} onChooseLegacyPreset={chooseLegacyPreset} unitFieldLabel={dialogProfile.unitFieldLabel} unitFieldRequired={dialogProfile.unitFieldRequired || Boolean(groupMembersRequired)} loading={needsPreset && presetLoading} loadError={needsPreset ? presetError : ''} onRetry={refreshPreset} />
      <ImportDialog isOpen={!!importTargetId} targetProjectName={importTarget ? getImportTargetName(importTarget) : '未知系统'} onClose={() => setImportTargetId(null)} onImportOverwrite={(file, password) => importIntoSystem(file, password, 'overwrite')} onImportMerge={(file, password) => importIntoSystem(file, password, 'merge')} />
      {storageSettingsOpen && <StorageSettingsDialog onClose={() => setStorageSettingsOpen(false)} onOpenArchive={() => { setStorageSettingsOpen(false); setArchiveDialog({}); }} onReminderSettingsChanged={reminder.recheck} />}
      {archiveDialog && <ArchiveDialog groups={groups} initialSelectedIds={archiveDialog.initialSelectedIds} onClose={() => setArchiveDialog(null)} onArchived={() => { void refreshProjects(); reminder.recheck(); }} />}
      <input ref={restoreInputRef} type="file" accept=".zip,application/zip" className="hidden" data-restore-input onChange={(event) => void handleRestoreFile(event.target.files?.[0])} />
      {dialog}
    </div>
  );
};

export default ProjectList;
