import React, { useState, useEffect } from 'react';
import type { Category, CheckItemTemplate } from '../types';
import { genId } from '../context/appReducer';
import { useConfirmDialog } from './ConfirmDialog';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, DIALOG_BODY, DIALOG_DESCRIPTION, DIALOG_FOOTER, DIALOG_HEADER, DIALOG_OVERLAY, DIALOG_PANEL, DIALOG_TITLE, FIELD_CONTROL } from './dialogStyles';

interface TemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveTemplates: (categoryId: string, items: CheckItemTemplate[]) => void;
}

const TemplateDialog: React.FC<TemplateDialogProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveTemplates,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>(
    categories[0]?.id || ''
  );
  const [items, setItems] = useState<CheckItemTemplate[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const { confirm, dialog } = useConfirmDialog();

  // Load current category's template items
  useEffect(() => {
    const cat = categories.find((c) => c.id === selectedCatId);
    if (cat) {
      setItems(cat.defaultItems.map((item) => ({ ...item })));
    }
  }, [selectedCatId, categories]);

  if (!isOpen) return null;

  const selectedCat = categories.find((c) => c.id === selectedCatId);
  if (!selectedCat) return null;

  const handleAddItem = () => {
    if (!newLabel.trim()) return;
    const newItem: CheckItemTemplate = {
      id: genId(),
      label: newLabel.trim(),
      required: true,
    };
    setItems([...items, newItem]);
    setNewLabel('');
  };

  const handleRemoveItem = async (itemId: string) => {
    const item = items.find((currentItem) => currentItem.id === itemId);
    const confirmed = await confirm({
      title: '删除默认检查项',
      message: `确定要删除“${item?.label || '该默认检查项'}”吗？\n\n修改保存后会影响后续新建资产。`,
      confirmText: '删除默认项',
      tone: 'danger',
    });
    if (confirmed) {
      setItems(items.filter((currentItem) => currentItem.id !== itemId));
    }
  };

  const handleRenameItem = (itemId: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, label: newLabel.trim() } : item
      )
    );
  };

  const handleToggleRequired = (itemId: string) => {
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, required: !item.required } : item
      )
    );
  };

  const handleSave = () => {
    onSaveTemplates(selectedCatId, items);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="template-dialog-title" className={DIALOG_OVERLAY} onClick={onClose}>
      <div className={`${DIALOG_PANEL} max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className={DIALOG_HEADER}>
          <div>
            <h2 id="template-dialog-title" className={DIALOG_TITLE}>模板管理</h2>
            <p className={DIALOG_DESCRIPTION}>编辑各分类的默认检查项。修改只影响之后新建的资产，已有资产不变。</p>
          </div>
        </div>

        <div className="border-b border-slate-200 px-6 py-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="选择分类">
            {categories
              .filter((c) => c.type === 'checklist')
              .map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  aria-pressed={selectedCatId === cat.id}
                  className={`min-h-9 rounded-[2px] border px-3 text-sm transition-colors ${
                    selectedCatId === cat.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
          </div>
        </div>

        <div className={DIALOG_BODY}>
          <p className="mb-3 text-sm font-medium text-slate-700">
            {selectedCat.name} · 默认检查项 {items.length} 项
          </p>

          {items.length === 0 ? (
            <div className="border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
              暂无默认检查项，请在下方添加
            </div>
          ) : (
            <div className="border border-slate-200">
              {items.map((item) => (
                <TemplateItemRow
                  key={item.id}
                  item={item}
                  onRename={handleRenameItem}
                  onRemove={handleRemoveItem}
                  onToggleRequired={handleToggleRequired}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddItem();
              }}
              placeholder="添加默认检查项..."
              aria-label="新检查项名称"
              className={`${FIELD_CONTROL} flex-1`}
            />
            <button type="button" onClick={handleAddItem} disabled={!newLabel.trim()} className={BUTTON_SECONDARY}>
              添加
            </button>
          </div>
        </div>

        <div className={DIALOG_FOOTER}>
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>取消</button>
          <button type="button" onClick={handleSave} className={BUTTON_PRIMARY}>保存模板</button>
        </div>
      </div>
      {dialog}
    </div>
  );
};

// ---- Single template item row ----
interface TemplateItemRowProps {
  item: CheckItemTemplate;
  onRename: (itemId: string, newLabel: string) => void;
  onRemove: (itemId: string) => void;
  onToggleRequired: (itemId: string) => void;
}

const TemplateItemRow: React.FC<TemplateItemRowProps> = ({
  item,
  onRename,
  onRemove,
  onToggleRequired,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.label);

  const handleFinishEdit = () => {
    if (editValue.trim() && editValue.trim() !== item.label) {
      onRename(item.id, editValue.trim());
    }
    setEditing(false);
  };

  const iconButton = 'inline-flex h-8 w-8 items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

  return (
    <div className="flex min-h-11 items-center gap-2 border-b border-slate-100 px-3 py-1.5 last:border-b-0 hover:bg-slate-50">
      {editing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleFinishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleFinishEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="检查项名称"
          className="min-h-8 flex-1 rounded-[2px] border border-blue-500 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          autoFocus
        />
      ) : (
        <span className="min-w-0 flex-1 break-words text-sm text-slate-800">{item.label}</span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleRequired(item.id)}
          aria-pressed={item.required}
          title="切换必填/选填"
          className={`min-h-7 min-w-12 rounded-[2px] border px-2 text-xs transition-colors ${
            item.required
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          {item.required ? '必填' : '选填'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditValue(item.label);
            setEditing(true);
          }}
          className={`${iconButton} hover:text-blue-600`}
          title="重命名"
          aria-label={`重命名 ${item.label}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className={`${iconButton} hover:text-red-600`}
          title="删除"
          aria-label={`删除 ${item.label}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TemplateDialog;
