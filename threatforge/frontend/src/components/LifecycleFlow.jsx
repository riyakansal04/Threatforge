import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Lock, ListChecks, Radar, ScanSearch, ShieldCheck, TrendingUp, Wrench } from 'lucide-react';

const ICONS = { Radar, ScanSearch, ListChecks, TrendingUp, Wrench, ShieldCheck };
const STAGE_COLORS = ['#37e4b2', '#66d9ff', '#ff6f66', '#f2b84b', '#a78bfa', '#37e4b2'];

export default function LifecycleFlow({ nodes, selectedId, openId, onSelect, onPreview, isPlaying = false, playIndex = -1 }) {
  const selectedIndex = nodes.findIndex((n) => n.stage.id === selectedId);

  return (
    <div className={`lifecycle-flow ${isPlaying ? 'is-playing' : ''}`} aria-label="ThreatForge workflow stages">
      <div className="lifecycle-flow__track" role="list">
        {nodes.map((node, index) => {
          const Icon = ICONS[node.stage.icon] || ShieldCheck;
          const isSelected = node.stage.id === selectedId;
          const isOpen = node.stage.id === openId;
          const prevComplete = index === 0 || nodes[index - 1].state === 'complete';
          const pathFilled = index > 0 && prevComplete && node.state !== 'pending';
          const isFocusEdge = index > 0 && index === selectedIndex;
          const isFlowEdge = isPlaying && playIndex === index;
          const isFlowPassed = isPlaying && playIndex > index;
          const approval = node.stage.approvalBefore;
          return (
            <Fragment key={node.stage.id}>
              {index > 0 && (
                <div
                  className={`lifecycle-flow__connector ${pathFilled ? 'is-filled' : ''} ${isFocusEdge ? 'is-focus' : ''} ${approval ? 'has-approval' : ''} ${isFlowEdge ? 'is-flow-edge' : ''} ${isFlowPassed ? 'is-flow-passed' : ''}`}
                  style={{ '--edge-index': index - 1 }}
                >
                  <span className="lifecycle-flow__connector-line" />
                  {approval && (
                    <Link to={approval.to} className="lifecycle-flow__approval" title={approval.description}>
                      <Lock size={12} aria-hidden="true" />
                      {approval.label}
                    </Link>
                  )}
                </div>
              )}
              <button
                type="button"
                role="listitem"
                className={`lifecycle-node lifecycle-node--${node.state} ${isSelected ? 'is-selected' : ''} ${isOpen ? 'is-open' : ''} ${playIndex === index ? 'is-flow-step' : ''}`}
                style={{ animationDelay: `${index * 70}ms`, '--node-index': index, '--stage-color': STAGE_COLORS[index % STAGE_COLORS.length] }}
                onClick={() => {
                  onSelect(node.stage.id);
                  onPreview?.(isOpen ? '' : node.stage.id);
                }}
                onFocus={() => onSelect(node.stage.id)}
                aria-pressed={isSelected}
                aria-expanded={isOpen}
              >
                <span className="lifecycle-node__glow" aria-hidden="true" />
                <span className="lifecycle-node__ring" aria-hidden="true">
                  <Icon size={25} />
                  {node.state === 'complete' && <CheckCircle2 className="lifecycle-node__check" size={15} />}
                </span>
                <span className="lifecycle-node__num">{node.stage.number}</span>
                <span className="lifecycle-node__title">{node.stage.title}</span>
                <span className="lifecycle-node__state">
                  {node.state === 'complete' && 'Mapped'}
                  {node.state === 'active' && 'In focus'}
                  {node.state === 'pending' && 'Not started'}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
