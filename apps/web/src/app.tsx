const boundaries = ['Agent', 'API', 'PostgreSQL', 'Dashboard'];

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <a
          className="wordmark"
          href="#overview"
          aria-label="NEXUS Monitor home"
        >
          <span aria-hidden="true">NX</span>
          NEXUS Monitor
        </a>
        <span className="phase">Phase 0</span>
      </header>

      <section className="overview" id="overview" aria-labelledby="page-title">
        <div className="status" role="status">
          <span className="status-mark" aria-hidden="true" />
          Foundation online
        </div>

        <div className="headline">
          <p className="kicker">Open-source observability infrastructure</p>
          <h1 id="page-title">NEXUS Monitor</h1>
          <p className="summary">
            The monitoring workspace is ready for host registration and
            telemetry in the next phase.
          </p>
        </div>

        <dl className="boundary-grid" aria-label="System boundaries">
          {boundaries.map((boundary, index) => (
            <div className="boundary" key={boundary}>
              <dt>{boundary}</dt>
              <dd>{index === 0 ? 'Runtime ready' : 'Boundary ready'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer>
        <span>Built for local and distributed infrastructure</span>
        <a href="https://github.com" rel="noreferrer">
          Public repository foundation
        </a>
      </footer>
    </main>
  );
}
