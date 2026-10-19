import type { MessageKey } from '@daligotchi/core';
import { useEffect, useState } from 'preact/hooks';
import { api, type FamilyTree } from '../api/client.ts';
import { t } from '../i18n/index.ts';

/** Qui regarder : un animal, ou un œuf dont on connaît les parents (avant adoption). */
export type GenealogyTarget =
  | { kind: 'animal'; id: string; name: string }
  | { kind: 'egg'; parentIds: string[] };

interface GenealogyPanelProps {
  target: GenealogyTarget;
  onClose: () => void;
}

/** Arbre des ascendants, jusqu'aux fondateurs (GDD §7). Jamais les allèles. */
export function GenealogyPanel({ target, onClose }: GenealogyPanelProps) {
  const [tree, setTree] = useState<FamilyTree | null>(null);

  useEffect(() => {
    if (target.kind === 'animal') {
      api.tree(target.id).then(setTree, () => setTree(null));
    } else {
      Promise.all(target.parentIds.map((id) => api.tree(id))).then(
        (parents) =>
          setTree({ id: 'egg', name: t('genealogy.egg'), form: 'renard', story: '', founder: false, deceased: false, parents }),
        () => setTree(null),
      );
    }
  }, [target]);

  const title = target.kind === 'animal' ? t('genealogy.title', { name: target.name }) : t('genealogy.eggTitle');

  return (
    <section class="panel panel--tall" aria-label={title}>
      <header class="panel__header">
        <h2>{title}</h2>
        <button type="button" class="card__close" onClick={onClose} aria-label={t('actions.close')}>
          ×
        </button>
      </header>
      {tree ? (
        <ul class="tree">
          <TreeNode node={tree} isEgg={target.kind === 'egg'} />
        </ul>
      ) : (
        <p class="panel__intro">{t('genealogy.loading')}</p>
      )}
    </section>
  );
}

function TreeNode({ node, isEgg = false }: { node: FamilyTree; isEgg?: boolean }) {
  return (
    <li class="tree__node">
      <div class={`tree__animal ${node.deceased ? 'tree__animal--deceased' : ''}`}>
        <strong>{node.name}</strong>
        {!isEgg && <span> · {t(`form.${node.form}` as MessageKey)}</span>}
        {node.deceased && <span> · ✦ {t('genealogy.deceased')}</span>}
        {node.founder && <div class="tree__note">{t('genealogy.founder')}</div>}
        {node.story && <div class="tree__story">« {node.story} »</div>}
      </div>
      {node.parents.length > 0 && (
        <ul class="tree">
          {node.parents.map((parent) => (
            <TreeNode key={parent.id} node={parent} />
          ))}
        </ul>
      )}
    </li>
  );
}
