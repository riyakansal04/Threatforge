import { Navigate, Routes, Route } from 'react-router-dom';
import AppShell from './layout/AppShell.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import CodebaseHistory from './pages/CodebaseHistory.jsx';
import Settings from './pages/Settings.jsx';
import Placeholder from './pages/placeholder.jsx';
import Upload from './pages/Upload.jsx';
import Evidence from './pages/Evidence.jsx';
import PrescanArtifacts from './pages/PrescanArtifacts.jsx';
import LifecycleStage from './pages/LifecycleStage.jsx';
import IntelligenceStage from './pages/IntelligenceStage.jsx';
import ScanningStage from './pages/ScanningStage.jsx';
import TriagePrioritizationStage from './pages/TriagePrioritizationStage.jsx';
import ScanOverview from './pages/scanning/ScanOverview.jsx';
import ScanDetail from './pages/scanning/ScanDetail.jsx';
import Findings from './pages/scanning/Findings.jsx';
import Coverage from './pages/scanning/Coverage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="settings" element={<Settings />} />
        <Route path="history" element={<CodebaseHistory />} />
        <Route path="upload" element={<Upload />} />
        <Route path="flow" element={<Navigate to="/" replace />} />
        <Route path="pre-scan" element={<IntelligenceStage />} />
        <Route path="pre-scan/repository-intelligence" element={<Navigate to="/pre-scan?tab=repository-intelligence" replace />} />
        <Route path="pre-scan/architecture" element={<Navigate to="/pre-scan?tab=architecture" replace />} />
        <Route path="pre-scan/threat-model" element={<Navigate to="/pre-scan?tab=threat-modeling" replace />} />
        <Route path="pre-scan/security-review-plan" element={<Navigate to="/pre-scan?tab=scan-planning" replace />} />
        <Route path="pre-scan/security-baseline" element={<Navigate to="/pre-scan?tab=scan-planning" replace />} />
        <Route path="pre-scan/scan-planning" element={<Navigate to="/pre-scan?tab=scan-planning" replace />} />
        <Route path="pre-scan/evidence" element={<Navigate to="/evidence" replace />} />
        <Route path="evidence" element={<Evidence />} />
        <Route path="pre-scan/raw-artifacts" element={<PrescanArtifacts />} />
        <Route path="scanning" element={<ScanningStage />} />
        <Route path="scanning/overview" element={<ScanOverview />} />
        <Route path="scanning/scans" element={<Navigate to="/pre-scan/raw-artifacts" replace />} />
        <Route path="scanning/scans/:id" element={<ScanDetail />} />
        <Route path="scanning/findings" element={<Findings />} />
        <Route path="scanning/coverage" element={<Coverage />} />
        <Route path="scanning/artifacts" element={<Navigate to="/pre-scan/raw-artifacts" replace />} />
        <Route path="findings-cases" element={<TriagePrioritizationStage />} />
        <Route path="findings-cases/overview" element={<Navigate to="/findings-cases?tab=triage" replace />} />
        <Route path="findings-cases/triage" element={<Navigate to="/findings-cases?tab=triage" replace />} />
        <Route path="findings-cases/priority" element={<Navigate to="/findings-cases?tab=prioritization" replace />} />
        <Route path="findings-cases/investigation" element={<Navigate to="/findings-cases/remediation" replace />} />
        <Route path="findings-cases/remediation" element={<LifecycleStage key="lifecycle-investigation" stageKey="investigation" extraStageKeys={['remediation']} title="Remediation" />} />
        <Route path="findings-cases/after-remediation" element={<Navigate to="/findings-cases/remediation" replace />} />
        <Route path="findings-cases/remediation-outcome" element={<Navigate to="/findings-cases/remediation" replace />} />
        <Route path="post-scan/verification" element={<LifecycleStage key="lifecycle-verification-closure" stageKey="fix-verification" extraStageKeys={['regression', 'closure']} view="verification-workflow" initialWorkflowStep="verify" title="Verification & Closure" eyebrow="Verify fixes" />} />
        <Route path="post-scan/regression" element={<Navigate to="/post-scan/verification" replace />} />
        <Route path="post-scan/closure" element={<Navigate to="/post-scan/verification" replace />} />
        <Route path="*" element={<Placeholder title="Page not found" description="This address does not match any page." />} />
      </Route>
    </Routes>
  );
}
